// Отчёты: запуск, ожидание готовности, ссылка и скачивание. Файл отчёта — единственный способ получить данные (JSON-выдачи у бэкенда нет).
import { api, unwrap, idem, ApiError } from '$lib/api';
import type { ReportJob } from '../types';
import type { ReportFormat } from './params';
import { isReportBusy } from './params';

export class ReportFailed extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ReportFailed';
	}
}

export const isRateLimited = (e: unknown): boolean => e instanceof ApiError && (e.status === 429 || e.code === 'CRM-1601');

export async function startReport(templateCode: string, format: ReportFormat, params: Record<string, unknown>): Promise<ReportJob> {
	return unwrap(api.POST('/api/reports', { body: { template_code: templateCode, format, params }, headers: idem() }));
}

export const getReport = (id: string, signal?: AbortSignal): Promise<ReportJob> => unwrap(api.GET('/api/reports/{report_id}', { params: { path: { report_id: id } }, signal }));

/** Опрашивает отчёт до `completed`; `failed` и таймаут — исключение с человеческим текстом. */
export async function waitForReport(job: ReportJob, opts: { interval?: number; timeout?: number; signal?: AbortSignal } = {}): Promise<ReportJob> {
	const { interval = 1500, timeout = 120_000, signal } = opts;
	const deadline = Date.now() + timeout;
	let current = job;
	while (isReportBusy(current.status)) {
		if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
		if (Date.now() > deadline) throw new ReportFailed('Отчёт формируется дольше обычного. Загляните в «Мои отчёты» чуть позже.');
		await new Promise((r) => setTimeout(r, interval));
		current = await getReport(current.id, signal);
	}
	if (current.status === 'failed') throw new ReportFailed(current.error || 'Не удалось сформировать отчёт.');
	return current;
}

/** Ссылка на файл (действует недолго). 422 у бэкенда — «файл ещё не готов» и «срок хранения истёк» (backend-issues #17). */
export async function reportUrl(id: string): Promise<string> {
	try {
		return (await unwrap(api.GET('/api/reports/{report_id}/download', { params: { path: { report_id: id } } }))).url;
	} catch (e) {
		if (e instanceof ApiError && e.status === 422) throw new ReportFailed('Срок хранения файла истёк. Запустите отчёт заново.');
		throw e;
	}
}

/** Скачивание без перехода со страницы: ссылка отдаёт файл как вложение. */
export function saveFromUrl(url: string): void {
	const a = document.createElement('a');
	a.href = url;
	a.rel = 'noopener';
	a.target = '_blank';
	document.body.appendChild(a);
	a.click();
	a.remove();
}

export async function downloadReport(id: string): Promise<void> {
	saveFromUrl(await reportUrl(id));
}
