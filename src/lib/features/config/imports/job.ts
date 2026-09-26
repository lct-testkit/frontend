// Общие помощники импорта: статус задания, типы сущностей с сервера, скачивание отчёта об ошибках, ссылки на результат.
import { api, unwrap } from '$lib/api';
import type { ImportJob } from '../types';
import { IMPORT_ENTITY_INFO, IMPORT_JOB_STATUS_INFO, IMPORT_MODE_LABELS, type ImportEntityType, type ImportMode, type ImportJobStatus } from './mapping';

export const jobStatus = (status: string) => IMPORT_JOB_STATUS_INFO[status as ImportJobStatus] ?? { label: status, tone: 'neutral' as const, step: 0 };
export const entityLabel = (entity: string): string => IMPORT_ENTITY_INFO[entity]?.label ?? entity;
export const modeLabel = (mode: string): string => IMPORT_MODE_LABELS[mode as ImportMode]?.label ?? mode;

/** Незавершённое задание: пользователь может продолжить мастер. */
export const isDraftJob = (job: Pick<ImportJob, 'status'>): boolean => ['uploaded', 'mapped', 'validated'].includes(job.status);

/** Куда вести из результата: у каждого типа свой раздел. */
const RESULTS: Record<string, { href: string; label: string }> = {
	organization: { href: '/organizations', label: 'организации' },
	license: { href: '/organizations', label: 'организации' },
	product: { href: '/catalog/products', label: 'продукты' },
	vendor_contact: { href: '/contacts', label: 'контакты' },
	learner: { href: '/contacts', label: 'контакты' },
	payment: { href: '/deals', label: 'сделки' }
};
export const resultHref = (entity: string): string => RESULTS[entity]?.href ?? '/organizations';
export const resultLabel = (entity: string): string => RESULTS[entity]?.label ?? entityLabel(entity).toLowerCase();

// Типы сущностей (поля, форматы, что обязательно) — с сервера, один запрос на сессию страницы.
let typesRequest: Promise<ImportEntityType[]> | null = null;
export function loadEntityTypes(): Promise<ImportEntityType[]> {
	typesRequest ??= unwrap(api.GET('/api/imports/entity-types'))
		.then((r) => r.items)
		.catch((e) => {
			typesRequest = null;
			throw e;
		});
	return typesRequest;
}

/** Отчёт об ошибках проверки — .xlsx в хранилище; ссылка живёт несколько минут. */
export async function openErrorReport(job: Pick<ImportJob, 'id' | 'result_file_id'>): Promise<void> {
	if (!job.result_file_id) return;
	const res = await unwrap(
		api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: job.result_file_id }, query: { entity_type: 'import_job', entity_id: job.id } } })
	);
	window.open(res.download_url, '_blank', 'noopener');
}
