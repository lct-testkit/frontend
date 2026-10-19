// Отчёты: запуск, ожидание готовности, JSON-данные для дашбордов, ссылка и скачивание файла.
import { api, unwrap, idem, ApiError } from '$lib/api';
import type { ReportDataOut, ReportJob } from '../types';
import { exportFileName, saveBlob } from './chart-export';
import type { ReportFormat } from './params';
import { isReportBusy } from './params';

export class ReportFailed extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ReportFailed';
	}
}

/** Лимит отчётов в работе (CRM-1601): незавершённых не больше `reports_max_concurrent`. */
export const isReportLimit = (e: unknown): boolean => e instanceof ApiError && (e.code === 'CRM-1601' || (e.status === 429 && /Не завершено отчётов/.test(e.detail)));
/** Любой другой 429, например общий лимит запросов (CRM-8429). */
export const isTooManyRequests = (e: unknown): boolean => e instanceof ApiError && e.status === 429 && !isReportLimit(e);

/** Задание живо, но не завершилось за время ожидания: оно идёт в очереди или в обработке, это не сбой. */
export class ReportStillRunning extends Error {
	readonly job: ReportJob;
	constructor(job: ReportJob) {
		super('Отчёт ещё формируется');
		this.name = 'ReportStillRunning';
		this.job = job;
	}
}

/** Сколько отчётов пользователя не завершено (очередь и обработка) — по последним 50 заданиям. */
export async function countUnfinished(): Promise<number> {
	const res = await unwrap(api.GET('/api/reports', { params: { query: { limit: 50 } } }));
	return res.items.filter((j) => isReportBusy(j.status)).length;
}

/** Сколько строк даст отчёт с параметрами — до запуска (`exact=false` — оценка тяжёлого отчёта). */
export async function previewReport(templateCode: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<{ row_count: number; exact: boolean }> {
	return unwrap(api.POST('/api/reports/preview', { body: { template_code: templateCode, params }, signal }));
}

export async function startReport(templateCode: string, format: ReportFormat, params: Record<string, unknown>): Promise<ReportJob> {
	return unwrap(api.POST('/api/reports', { body: { template_code: templateCode, format: format as ReportJob['format'], params }, headers: idem() }));
}

export const getReport = (id: string, signal?: AbortSignal): Promise<ReportJob> => unwrap(api.GET('/api/reports/{report_id}', { params: { path: { report_id: id } }, signal }));

/** Опрашивает отчёт до `completed`; `failed` — исключение с текстом ошибки, таймаут — `ReportStillRunning` (задание живо). `onUpdate` вызывается на каждом опросе. */
export async function waitForReport(job: ReportJob, opts: { interval?: number; timeout?: number; signal?: AbortSignal; onUpdate?: (job: ReportJob) => void } = {}): Promise<ReportJob> {
	const { interval = 1500, timeout = 180_000, signal, onUpdate } = opts;
	const deadline = Date.now() + timeout;
	let current = job;
	while (isReportBusy(current.status)) {
		if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
		if (Date.now() > deadline) throw new ReportStillRunning(current);
		await new Promise((r) => setTimeout(r, interval));
		current = await getReport(current.id, signal);
		onUpdate?.(current);
	}
	if (current.status === 'failed') throw new ReportFailed(current.error || 'Не удалось сформировать отчёт.');
	return current;
}

/** Данные готового задания в JSON — то же, что рендерится в файл, без похода в S3 и без разбора xlsx в браузере (backend-issues #19).
 * Пересчитывается на каждый вызов по параметрам задания: свежие данные, но и не бесплатно — не звать чаще, чем «Обновить данные». */
export const fetchReportData = (id: string, signal?: AbortSignal): Promise<ReportDataOut> =>
	unwrap(api.GET('/api/reports/{report_id}/data', { params: { path: { report_id: id } }, signal }));

/** Срок хранения файла истёк или файла нет в хранилище (410, CRM-1603). */
export class ReportExpired extends ReportFailed {
	constructor(message = 'Файл отчёта уже удалён из хранилища. Запустите отчёт заново') {
		super(message);
		this.name = 'ReportExpired';
	}
}

/** Отчёт ещё не готов или завершился ошибкой (409, CRM-1602). */
export class ReportNotReady extends ReportFailed {
	constructor(message = 'Отчёт ещё не готов или завершился с ошибкой') {
		super(message);
		this.name = 'ReportNotReady';
	}
}

/**
 * «Скачать JSON»: данные отчёта (то же, что рендерится в файл) считаются заново по параметрам задания и сохраняются как есть, с отступом в 2 пробела.
 * 403 — отчёт «только файлом» (содержит ПДн), 422 — параметры задания стали невалидны: тексты сервера идут наружу как есть.
 */
export async function downloadReportJson(job: Pick<ReportJob, 'id'>, templateName: string, save: (blob: Blob, fileName: string) => void = saveBlob): Promise<void> {
	const data = await fetchReportData(job.id);
	save(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), exportFileName(templateName, new Date(), 'json'));
}

/** Ссылка на файл (действует недолго). 410 / CRM-1603 — срок хранения истёк или файла нет, 409 / CRM-1602 — отчёт не готов. */
export async function reportUrl(id: string): Promise<string> {
	try {
		return (await unwrap(api.GET('/api/reports/{report_id}/download', { params: { path: { report_id: id } } }))).url;
	} catch (e) {
		if (e instanceof ApiError && (e.status === 410 || e.code === 'CRM-1603')) throw new ReportExpired();
		if (e instanceof ApiError && (e.status === 409 || e.code === 'CRM-1602')) throw new ReportNotReady();
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
