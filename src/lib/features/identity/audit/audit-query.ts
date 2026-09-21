// Фильтры журнала аудита ↔ адресная строка ↔ параметры API. Даты в UI — календарные (`2026-09-20`), в API — момент времени.

export interface AuditFilters {
	action: string;
	entity_type: string;
	result: string;
	actor_id: string;
	entity_id: string;
	request_id: string;
	from: string;
	to: string;
}

export const AUDIT_FILTER_KEYS = ['action', 'entity_type', 'result', 'actor_id', 'entity_id', 'request_id', 'from', 'to'] as const;

export const emptyFilters = (): AuditFilters => ({ action: '', entity_type: '', result: '', actor_id: '', entity_id: '', request_id: '', from: '', to: '' });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Начало дня по локальному времени → ISO. */
export const dayStart = (day: string): string | undefined => (day ? new Date(`${day}T00:00:00`).toISOString() : undefined);
/** Конец дня включительно. */
export const dayEnd = (day: string): string | undefined => (day ? new Date(`${day}T23:59:59.999`).toISOString() : undefined);

export function apiQuery(f: AuditFilters) {
	return {
		action: f.action || undefined,
		entity_type: f.entity_type || undefined,
		result: f.result || undefined,
		actor_id: UUID.test(f.actor_id) ? f.actor_id : undefined,
		entity_id: UUID.test(f.entity_id) ? f.entity_id : undefined,
		request_id: f.request_id || undefined,
		from: dayStart(f.from),
		to: dayEnd(f.to)
	};
}

/** Сколько фильтров включено (для бейджа на кнопке «Фильтры»). */
export const activeCount = (f: AuditFilters): number => Object.values(f).filter(Boolean).length;

/** Куда вести ссылку «Открыть» у сущности события (null — экрана у сущности нет). */
export function entityHref(type: string | null | undefined, id: string | null | undefined): string | null {
	if (!type || !id) return null;
	switch (type) {
		case 'deal':
			return `/deals/${id}`;
		case 'organization':
			return `/organizations/${id}`;
		case 'contact':
			return `/contacts/${id}`;
		case 'user':
			return `/admin/users/${id}`;
		case 'signature_document':
			return `/signing/${id}`;
		case 'data_erasure_request':
			return `/admin/erasure/${id}`;
		case 'workflow':
			return `/workflows/${id}`;
		case 'import_job':
			return `/imports/${id}`;
		default:
			return null;
	}
}

/** Файл выгрузки: `audit-2026-09-20.ndjson`. */
export const exportFilename = (now = new Date()): string => `audit-${now.toISOString().slice(0, 10)}.ndjson`;
