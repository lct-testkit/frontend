// Запуск одного отчёта из панели: форма → очередь → готово / ошибка / лимит. Ход отчёта у бэкенда не отдаётся (`progress_pct` всегда 0),
// поэтому вместо процентов — состояние (в очереди / формируется) и сколько прошло. Тяжёлые отчёты берутся в работу раз в минуту — это норма.
import { onDestroy } from 'svelte';
import { errorMessage } from '$lib/api';
import { toast } from '$lib/ui/toast.svelte';
import { Poller } from '../shared/polling.svelte';
import type { ReportJob } from '../types';
import { ReportFailed, ReportStillRunning, countUnfinished, downloadReport, isReportLimit, startReport, waitForReport } from './api';
import { canDownloadReport, isReportBusy } from './params';
import { track } from './tracker.svelte';

export type RunPhase = 'form' | 'running' | 'background' | 'done' | 'failed' | 'limit';

/** Лимит незавершённых отчётов на сотрудника (`reports_max_concurrent` бэкенда); точное число берётся из текста ответа. */
export const REPORTS_LIMIT = 10;

/** Лимит из текста сервера: «Не завершено отчётов: 10 (лимит 10)…». */
export function limitFrom(detail: string): number {
	const m = /лимит\s+(\d+)/i.exec(detail);
	return m ? Number(m[1]) : REPORTS_LIMIT;
}

export class ReportRun {
	phase = $state<RunPhase>('form');
	job = $state<ReportJob | null>(null);
	message = $state('');
	/** очередь или обработка — по последнему опросу */
	jobStatus = $state<'queued' | 'processing'>('queued');
	/** сколько секунд идёт запуск */
	elapsed = $state(0);
	/** сколько отчётов пользователя не завершено (в фазе «лимит») */
	unfinished = $state<number | null>(null);
	limit = $state(REPORTS_LIMIT);
	#ctrl: AbortController | null = null;
	#timer: ReturnType<typeof setInterval> | undefined;
	#startedAt = 0;
	#poller = new Poller(async () => {
		this.unfinished = await countUnfinished();
		return this.phase === 'limit';
	}, { interval: 3000, maxErrors: 20, pauseHidden: true });
	#templateName = '';

	/** повторить можно, когда у пользователя освободился слот */
	get canRetry(): boolean {
		return this.phase !== 'limit' || (this.unfinished !== null && this.unfinished < this.limit);
	}

	reset(): void {
		this.#ctrl?.abort();
		this.#stopTimer();
		this.#poller.stop();
		this.phase = 'form';
		this.job = null;
		this.message = '';
		this.unfinished = null;
	}

	async run(templateCode: string, format: string, params: Record<string, unknown>, templateName = templateCode): Promise<void> {
		this.#ctrl?.abort();
		this.#poller.stop();
		const ctrl = (this.#ctrl = new AbortController());
		this.#templateName = templateName;
		this.phase = 'running';
		this.message = '';
		this.jobStatus = 'queued';
		this.job = null;
		this.#startTimer();
		try {
			const created = await startReport(templateCode, format, params);
			this.job = created;
			this.#seen(created);
			this.job = isReportBusy(created.status) ? await waitForReport(created, { signal: ctrl.signal, onUpdate: (j) => this.#seen(j) }) : created;
			if (this.job.status === 'failed') throw new ReportFailed(this.job.error || 'Не удалось сформировать отчёт.');
			this.phase = 'done';
		} catch (e) {
			if (ctrl.signal.aborted) return;
			if (e instanceof ReportStillRunning) {
				// задание живо: пусть доделывается, а о готовности скажет тост
				this.job = e.job;
				this.phase = 'background';
				track(e.job, this.#templateName);
			} else if (isReportLimit(e)) {
				this.message = errorMessage(e);
				this.limit = limitFrom(this.message);
				this.unfinished = null;
				this.phase = 'limit';
				this.#poller.start(true);
			} else {
				this.message = e instanceof ReportFailed ? e.message : errorMessage(e);
				this.phase = 'failed';
			}
		} finally {
			if (this.phase !== 'running') this.#stopTimer();
		}
	}

	/** «Свернуть»: отчёт доделывается сам, о готовности скажет тост на любом экране. */
	minimize(): void {
		if (this.phase !== 'running' || !this.job) return;
		this.#ctrl?.abort();
		track(this.job, this.#templateName);
		this.#stopTimer();
		this.phase = 'form';
		this.job = null;
	}

	async download(): Promise<void> {
		if (!this.job || !canDownloadReport(this.job)) {
			toast.warning('Срок хранения файла истёк', 'Запустите отчёт заново');
			return;
		}
		try {
			await downloadReport(this.job.id);
		} catch (e) {
			toast.error(e);
		}
	}

	dispose(): void {
		this.#ctrl?.abort();
		this.#stopTimer();
		this.#poller.stop();
	}

	#seen(job: ReportJob): void {
		if (job.status === 'processing' || job.status === 'queued') this.jobStatus = job.status;
	}

	#startTimer(): void {
		this.#stopTimer();
		this.#startedAt = Date.now();
		this.elapsed = 0;
		this.#timer = setInterval(() => (this.elapsed = Math.floor((Date.now() - this.#startedAt) / 1000)), 1000);
	}

	#stopTimer(): void {
		clearInterval(this.#timer);
		this.#timer = undefined;
	}
}

/** Создаёт запуск и снимает опрос при уходе со страницы (свёрнутый отчёт отслеживает `tracker`, а не панель). */
export function useReportRun(): ReportRun {
	const run = new ReportRun();
	onDestroy(() => run.dispose());
	return run;
}

/** «0:12» */
export function clock(seconds: number): string {
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
