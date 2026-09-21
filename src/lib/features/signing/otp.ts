// Логика ввода одноразового кода и таймера повторной отправки (dop.md §10.4 п.11–13, §10.8).
// Ничего не знает об API и DOM: время передаётся снаружи, чтобы всё было тестируемо.

export const OTP_LENGTH = 6;
/** Совпадает с `signature_otp_max_attempts` бэкенда; сервер остаток не отдаёт, поэтому считаем сами. */
export const OTP_DEFAULT_MAX_ATTEMPTS = 3;
/** Совпадает с окном rate-limit `signature:otp:send` (1 раз в 60 с). */
export const OTP_RESEND_COOLDOWN_SEC = 60;
/** Не более 5 кодов на один запрос подписи. */
export const OTP_MAX_SENDS = 5;

/** Оставляет только цифры и режет до длины кода — для вставки «123 456» и ввода с мобильной клавиатуры. */
export function normalizeOtp(raw: string): string {
	return raw.replace(/\D+/g, '').slice(0, OTP_LENGTH);
}

export const isOtpComplete = (value: string): boolean => normalizeOtp(value).length === OTP_LENGTH;

export interface ResendState {
	canResend: boolean;
	secondsLeft: number;
}

/**
 * Состояние кнопки «Отправить повторно»: `sentAt` — момент последней отправки (мс),
 * `cooldownSec` — окно (по умолчанию 60 с, либо `Retry-After` от сервера).
 */
export function resendState(sentAt: number | null, now: number, cooldownSec = OTP_RESEND_COOLDOWN_SEC): ResendState {
	if (sentAt === null) return { canResend: true, secondsLeft: 0 };
	const elapsed = (now - sentAt) / 1000;
	const left = Math.ceil(cooldownSec - elapsed);
	return left > 0 ? { canResend: false, secondsLeft: left } : { canResend: true, secondsLeft: 0 };
}

/** Окно ожидания после 429: берём `Retry-After`, если он есть и разумен, иначе стандартные 60 с. */
export function cooldownFromRetryAfter(retryAfterSec: number | undefined | null, fallbackSec = OTP_RESEND_COOLDOWN_SEC): number {
	if (typeof retryAfterSec !== 'number' || !Number.isFinite(retryAfterSec) || retryAfterSec <= 0) return fallbackSec;
	return Math.min(Math.ceil(retryAfterSec), 3600);
}

export const attemptsLeft = (failed: number, max = OTP_DEFAULT_MAX_ATTEMPTS): number => Math.max(0, max - failed);

export const sendsLeft = (sent: number, max = OTP_MAX_SENDS): number => Math.max(0, max - sent);

/** «0:59» — для таймеров на кнопках. */
export function formatCountdown(totalSeconds: number): string {
	const s = Math.max(0, Math.floor(totalSeconds));
	const minutes = Math.floor(s / 60);
	const seconds = s % 60;
	return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Секунды до истечения кода (`expires_in_seconds` от сервера), не меньше 0. */
export function secondsUntil(expiresAtMs: number, now: number): number {
	return Math.max(0, Math.ceil((expiresAtMs - now) / 1000));
}

/** Склонение: 1 попытка, 2 попытки, 5 попыток. */
export function attemptsWord(n: number): string {
	const abs = Math.abs(n) % 100;
	const last = abs % 10;
	if (abs > 10 && abs < 20) return 'попыток';
	if (last === 1) return 'попытка';
	if (last >= 2 && last <= 4) return 'попытки';
	return 'попыток';
}
