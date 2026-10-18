// «Забрать сейчас»: POST ставит запрос в очередь, воркер подхватывает его на ближайшем тике (до минуты) и пишет итог в `last_run`.
// Состояние запуска узнаём опросом `GET …/status`: пока `pull_request` не пуст — в очереди; пока нет `last_run` новее запроса — идёт; иначе готово.
import { api, errorMessage, unwrap } from '$lib/api';
import { createPoller, type Poller } from '../shared/polling.svelte';
import type { SourceStatus } from '../types';
import { parseRun, type LastRun } from './sourceState';

export type PullPhase = 'idle' | 'starting' | 'queued' | 'running' | 'done' | 'failed' | 'timeout';

export interface PullDeps {
	start(code: string): Promise<{ requested_at: string }>;
	status(code: string): Promise<Pick<SourceStatus, 'pull_request' | 'last_run'>>;
	now(): number;
}

const POLL_INTERVAL = 2000;
/** Тик воркера — раз в минуту, плюс время самого забора. */
export const POLL_TIMEOUT = 120_000;

const liveDeps: PullDeps = {
	start: (code) => unwrap(api.POST('/api/admin/integrations/sources/{code}/pull', { params: { path: { code } }, body: {} })),
	status: (code) => unwrap(api.GET('/api/admin/integrations/sources/{code}/status', { params: { path: { code } } })),
	now: () => Date.now()
};

/** Фаза по ответу статуса: запрос ещё в очереди, запуск идёт или итог уже записан. */
export function phaseOf(status: Pick<SourceStatus, 'pull_request' | 'last_run'>, requestedAt: number): { phase: 'queued' | 'running' | 'done'; run: LastRun | null } {
	if (status.pull_request) return { phase: 'queued', run: null };
	const run = parseRun(status.last_run);
	const finished = run?.finishedAt ? Date.parse(run.finishedAt) : NaN;
	if (run && Number.isFinite(finished) && finished >= requestedAt) return { phase: 'done', run };
	return { phase: 'running', run: null };
}

export class PullRun {
	phase = $state<PullPhase>('idle');
	/** итог запуска, начатого в этой сессии */
	run = $state<LastRun | null>(null);
	/** причина, если запустить не удалось (409, 429) или запуск закончился ошибкой */
	error = $state<string | null>(null);
	errorCode = $state<string | null>(null);

	#deps: PullDeps;
	#onDone: () => void;
	#poller: Poller | null = null;

	constructor(onDone: () => void, deps: PullDeps = liveDeps) {
		this.#deps = deps;
		this.#onDone = onDone;
	}

	get busy(): boolean {
		return this.phase === 'starting' || this.phase === 'queued' || this.phase === 'running';
	}

	async start(code: string): Promise<void> {
		if (this.busy) return;
		this.phase = 'starting';
		this.error = null;
		this.errorCode = null;
		this.run = null;
		let requestedAt: number;
		try {
			const accepted = await this.#deps.start(code);
			requestedAt = Date.parse(accepted.requested_at);
		} catch (e) {
			this.phase = 'failed';
			this.error = errorMessage(e);
			this.errorCode = (e as { code?: string | null }).code ?? null;
			return;
		}
		if (!Number.isFinite(requestedAt)) requestedAt = this.#deps.now();
		const deadline = this.#deps.now() + POLL_TIMEOUT;
		this.phase = 'queued';
		this.#poller?.stop();
		this.#poller = createPoller(
			async () => {
				const next = phaseOf(await this.#deps.status(code), requestedAt);
				this.phase = next.phase;
				if (next.phase === 'done') {
					this.run = next.run;
					if (next.run?.error) {
						this.phase = 'failed';
						this.error = next.run.error;
					}
					this.#onDone();
					return false;
				}
				if (this.#deps.now() >= deadline) {
					this.phase = 'timeout';
					return false;
				}
				return true;
			},
			{ interval: POLL_INTERVAL, pauseHidden: false }
		);
		this.#poller.start(true);
	}

	stop(): void {
		this.#poller?.stop();
	}
}
