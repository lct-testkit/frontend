// Общие помощники импорта: статус задания, скачивание отчёта об ошибках, ссылки на результат.
import { api, unwrap } from '$lib/api';
import type { ImportJob } from '../types';
import { IMPORT_ENTITY_LABELS, IMPORT_JOB_STATUS_INFO, IMPORT_MODE_LABELS, type ImportEntity, type ImportMode, type ImportJobStatus } from './mapping';

export const jobStatus = (status: string) => IMPORT_JOB_STATUS_INFO[status as ImportJobStatus] ?? { label: status, tone: 'neutral' as const, step: 0 };
export const entityLabel = (entity: string): string => IMPORT_ENTITY_LABELS[entity as ImportEntity]?.label ?? entity;
export const modeLabel = (mode: string): string => IMPORT_MODE_LABELS[mode as ImportMode]?.label ?? mode;

/** Незавершённое задание: пользователь может продолжить мастер. */
export const isDraftJob = (job: Pick<ImportJob, 'status'>): boolean => ['uploaded', 'mapped', 'validated'].includes(job.status);

/** Куда вести из результата: организации и продукты открываются в своих разделах. */
export const resultHref = (entity: string): string => (entity === 'product' ? '/catalog/products' : '/organizations');

/** Отчёт об ошибках проверки — .xlsx в хранилище; ссылка живёт несколько минут. */
export async function openErrorReport(job: Pick<ImportJob, 'id' | 'result_file_id'>): Promise<void> {
	if (!job.result_file_id) return;
	const res = await unwrap(
		api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: job.result_file_id }, query: { entity_type: 'import_job', entity_id: job.id } } })
	);
	window.open(res.download_url, '_blank', 'noopener');
}
