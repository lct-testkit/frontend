// Состояние экрана подписи: загрузка документа → запрос кода → ввод OTP → подпись / отказ.
// Одна и та же машина состояний обслуживает публичную страницу и внутренний экран (разница — в `SignAdapter`).
import { ApiError } from '$lib/api';
import type { SignAdapter } from './api';
import { signErrorMessage } from './errors';
import {
	OTP_DEFAULT_MAX_ATTEMPTS,
	OTP_MAX_SENDS,
	attemptsLeft,
	cooldownFromRetryAfter,
	isOtpComplete,
	normalizeOtp,
	resendState
} from './otp';
import type { ChallengeInfo, SignatureOut, SigningPage } from './types';

/** loading → (failed | ready | closed) ; ready → otp → (done | closed) */
export type Phase = 'loading' | 'failed' | 'ready' | 'otp' | 'done' | 'closed';

export type Outcome =
	| 'signed'
	| 'rejected'
	| 'signed_before'
	| 'rejected_before'
	| 'locked'
	| 'expired'
	| 'void'
	| 'waiting'
	| 'invalid'
	| 'mismatch';

const CLOSED_BY_STATUS: Record<string, Outcome> = {
	signed: 'signed_before',
	rejected: 'rejected_before',
	locked: 'locked',
	expired: 'expired',
	void: 'void',
	pending: 'waiting'
};

export class SignSession {
	page = $state<SigningPage | null>(null);
	phase = $state<Phase>('loading');
	outcome = $state<Outcome | null>(null);
	/** текст причины закрытия, когда стандартной подписи мало */
	note = $state<string | null>(null);
	loadError = $state<unknown>(null);

	challenge = $state<ChallengeInfo | null>(null);
	sentAt = $state<number | null>(null);
	cooldown = $state(60);
	sends = $state(0);
	failed = $state(0);
	otp = $state('');
	busy = $state(false);
	/** ошибка под полем кода */
	message = $state<string | null>(null);
	signature = $state<SignatureOut | null>(null);
	/** тик для таймера повторной отправки (обновляет компонент) */
	now = $state(Date.now());

	#adapter: SignAdapter;

	constructor(adapter: SignAdapter) {
		this.#adapter = adapter;
	}

	get resend() {
		return resendState(this.sentAt, this.now, this.cooldown);
	}
	get attemptsLeft() {
		return attemptsLeft(this.failed, OTP_DEFAULT_MAX_ATTEMPTS);
	}
	get sendsExhausted() {
		return this.sends >= OTP_MAX_SENDS;
	}
	get debugCode(): string | null {
		return this.challenge?.debug_code ?? null;
	}

	#close(outcome: Outcome, note: string | null = null) {
		this.phase = outcome === 'signed' || outcome === 'rejected' ? 'done' : 'closed';
		this.outcome = outcome;
		this.note = note;
	}

	async load(): Promise<void> {
		this.phase = 'loading';
		this.loadError = null;
		try {
			const page = await this.#adapter.load();
			this.page = page;
			const closed = CLOSED_BY_STATUS[page.my_status];
			if (closed) this.#close(closed);
			else this.phase = 'ready';
		} catch (e) {
			if (e instanceof ApiError && e.code === 'CRM-1504') this.#close('invalid');
			else {
				this.loadError = e;
				this.phase = 'failed';
			}
		}
	}

	/** «Подписать»: сразу просим код и открываем ввод. */
	async start(): Promise<void> {
		if (this.busy) return;
		this.phase = 'otp';
		if (!this.challenge) await this.requestCode();
	}

	back() {
		if (this.phase === 'otp' && !this.busy) {
			this.phase = 'ready';
			this.message = null;
		}
	}

	async requestCode(): Promise<void> {
		if (this.busy) return;
		this.busy = true;
		this.message = null;
		try {
			this.challenge = await this.#adapter.challenge();
			this.sends += 1;
			this.sentAt = Date.now();
			this.now = this.sentAt;
			this.cooldown = 60;
			this.otp = '';
		} catch (e) {
			this.#onError(e, 'send');
		} finally {
			this.busy = false;
		}
	}

	setOtp(value: string) {
		this.otp = normalizeOtp(value);
		if (this.message) this.message = null;
	}

	async submit(): Promise<void> {
		if (this.busy || this.phase !== 'otp' || !isOtpComplete(this.otp)) return;
		this.busy = true;
		this.message = null;
		try {
			this.signature = await this.#adapter.sign(this.otp);
			this.#close('signed');
		} catch (e) {
			this.#onError(e, 'sign');
		} finally {
			this.busy = false;
		}
	}

	async reject(reason: string): Promise<void> {
		this.busy = true;
		try {
			await this.#adapter.reject(reason.trim());
			this.#close('rejected');
		} catch (e) {
			if (e instanceof ApiError && e.code === 'CRM-1504') this.#close('invalid');
			else throw e;
		} finally {
			this.busy = false;
		}
	}

	#onError(e: unknown, during: 'send' | 'sign') {
		const err = e instanceof ApiError ? e : null;
		if (!err) {
			this.message = 'Не удалось выполнить действие. Проверьте соединение и повторите.';
			return;
		}
		if (err.isNetwork) {
			this.message = err.detail;
			return;
		}
		const info = signErrorMessage(err);
		switch (info.kind) {
			case 'token_invalid':
				this.#close('invalid');
				return;
			case 'locked':
				this.#close('locked');
				return;
			case 'already_signed':
				this.#close('signed_before');
				return;
			case 'hash_mismatch':
				this.#close('mismatch');
				return;
			case 'not_signable':
			case 'no_channel':
				if (info.fatal) {
					this.#close(info.requestStatus === 'expired' ? 'expired' : info.requestStatus === 'void' ? 'void' : 'invalid', info.message);
					return;
				}
				break;
			case 'invalid_code':
				if (during === 'sign') {
					this.failed += 1;
					this.otp = '';
					this.message = this.attemptsLeft > 0 ? `${info.message} Осталось попыток: ${this.attemptsLeft}.` : info.message;
					return;
				}
				break;
			case 'rate_limited':
				this.cooldown = cooldownFromRetryAfter(info.retryAfter);
				this.sentAt = Date.now();
				this.now = this.sentAt;
				break;
			case 'send_limit':
				this.sends = OTP_MAX_SENDS;
				break;
		}
		this.message = info.message;
	}
}
