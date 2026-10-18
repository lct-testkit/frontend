// Общие помощники импорта: статус задания, типы сущностей с сервера, скачивание отчёта об ошибках, ссылки на результат.
import { api, unwrap } from '$lib/api';
import { saveBytes } from '../../signing/download';
import type { ImportJob } from '../types';
import { IMPORT_ENTITY_INFO, IMPORT_JOB_STATUS_INFO, IMPORT_MODE_LABELS, type ImportEntityType, type ImportMode, type ImportJobStatus } from './mapping';

export const jobStatus = (status: string) => IMPORT_JOB_STATUS_INFO[status as ImportJobStatus] ?? { label: status, tone: 'neutral' as const, step: 0 };
export const entityLabel = (entity: string): string => IMPORT_ENTITY_INFO[entity]?.label ?? entity;
// Что за запись в строке файла: сначала поля, по которым её узнают (номер заявки, название, ФИО, договор, вендор, ПО), потом остальные.
// Ссылки на справочники (`…_id`, UUID) человеку ничего не говорят — в описание строки не попадают.
const IDENTIFYING = ['order_number', 'vendor_name', 'name', 'full_name', 'last_name', 'first_name', 'middle_name', 'code', 'inn', 'contract_number', 'vendor', 'product_name'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rowSummary(data: Record<string, unknown> | null | undefined, limit = 3): string {
	const row = data ?? {};
	const keys = [...IDENTIFYING.filter((k) => k in row), ...Object.keys(row).filter((k) => !IDENTIFYING.includes(k) && !k.endsWith('_id'))];
	return keys
		.map((k) => row[k])
		.filter((v) => v !== null && v !== '' && v !== undefined && typeof v !== 'object' && !(typeof v === 'string' && UUID.test(v)))
		.slice(0, limit)
		.join(' · ');
}

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
	payment: { href: '/deals', label: 'сделки' },
	direction: { href: '/catalog/directions', label: 'направления' },
	responsible: { href: '/organizations', label: 'организации' }
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

export type TemplateFormat = 'xlsx' | 'xls';
const TEMPLATE_MIME: Record<TemplateFormat, string> = { xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel' };

/** Шаблон файла для типа импорта с сервера: заголовки, учебные строки, лист «Инструкция» (в xlsx ещё выпадающие списки). Сохраняется как файл. */
export async function downloadImportTemplate(code: string, format: TemplateFormat): Promise<void> {
	const bytes = (await unwrap(api.GET('/api/imports/templates/{entity_type}', { params: { path: { entity_type: code }, query: { format } }, parseAs: 'arrayBuffer' }))) as ArrayBuffer;
	saveBytes(bytes, `${code}-template.${format}`, TEMPLATE_MIME[format]);
}

/** Сводка проверки: коды проблем с числом строк и примерами, что будет создано/обновлено; после применения — что сделано. */
export const loadImportSummary = (jobId: string) => unwrap(api.GET('/api/imports/{job_id}/summary', { params: { path: { job_id: jobId } } }));
