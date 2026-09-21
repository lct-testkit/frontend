// Запуск одного отчёта из панели: форма → очередь → готово / ошибка. Ход отчёта у бэкенда не отдаётся (`progress_pct` всегда 0), поэтому индикатор неопределённый.
import { onDestroy } from 'svelte';
import { errorMessage } from '$lib/api';
import { toast } from '$lib/ui';
import type { ReportJob } from '../types';
import { ReportFailed, downloadReport, isRateLimited, startReport, waitForReport } from './api';
import { canDownloadReport, isReportBusy, type ReportFormat } from './params';

export type RunPhase = 'form' | 'running' | 'done' | 'failed';

export class ReportRun {
	phase = $state<RunPhase>('form');
	job = $state<ReportJob | null>(null);
	message = $state('');
	/** после «Слишком много отчётов» кнопка запуска ждёт несколько секунд */
	cooldown = $state(false);
	#ctrl: AbortController | null = null;

	reset(): void {
		this.#ctrl?.abort();
		this.phase = 'form';
		this.job = null;
		this.message = '';
	}

	async run(templateCode: string, format: ReportFormat, params: Record<string, unknown>): Promise<void> {
		this.#ctrl?.abort();
		const ctrl = (this.#ctrl = new AbortController());
		this.phase = 'running';
		this.message = '';
		try {
			const created = await startReport(templateCode, format, params);
			this.job = created;
			this.job = isReportBusy(created.status) ? await waitForReport(created, { signal: ctrl.signal }) : created;
			if (this.job.status === 'failed') throw new ReportFailed(this.job.error || 'Не удалось сформировать отчёт.');
			this.phase = 'done';
		} catch (e) {
			if (ctrl.signal.aborted) return;
			if (isRateLimited(e)) {
				this.message = 'Слишком много отчётов в работе. Подождите немного и повторите.';
				this.cooldown = true;
				setTimeout(() => (this.cooldown = false), 10_000);
			} else this.message = e instanceof ReportFailed ? e.message : errorMessage(e);
			this.phase = 'failed';
		}
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
	}
}

/** Создаёт запуск и снимает опрос при уходе со страницы. */
export function useReportRun(): ReportRun {
	const run = new ReportRun();
	onDestroy(() => run.dispose());
	return run;
}
