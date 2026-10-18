// Журнал аудита: разбор `changes` (форматы `{field: {old, new}}`, `{field: [old, new]}` и скаляры).
import { SvelteMap } from 'svelte/reactivity';
import { api, unwrap } from '$lib/api';
import { people } from '$lib/api/people.svelte';
import { session } from '$lib/auth/session.svelte';
import { EntityCache, contactCache, contactLabel, dealLabel, orgCache, orgLabel, preloadDeals } from '$lib/features/crm/shared/entityCache.svelte';
import { dealFieldDefs, directions, lossReasons, products } from '$lib/features/crm/shared/refs.svelte';
import { getDocumentsBatch } from '$lib/features/signing/api';
import { Lazy } from '$lib/features/crm/shared/lazy.svelte';
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_CODES, labelOf } from '$lib/features/config/labels';
import { formatDate } from '$lib/utils/format';

export interface ChangeRow {
	field: string;
	oldValue: string;
	newValue: string;
	/** Значение не менялось (например, `required` в ACCESS_DENIED — просто факт). */
	isFact: boolean;
}

export function formatValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return '—';
	if (typeof value === 'boolean') return value ? 'Да' : 'Нет';
	if (typeof value === 'number') return new Intl.NumberFormat('ru-RU').format(value);
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '—';
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function isOldNew(v: unknown): v is { old?: unknown; new?: unknown } {
	return !!v && typeof v === 'object' && !Array.isArray(v) && ('old' in v || 'new' in v);
}

export function formatChanges(changes: Record<string, unknown> | null | undefined): ChangeRow[] {
	if (!changes) return [];
	return Object.entries(changes).map(([field, raw]) => {
		if (isOldNew(raw)) {
			return { field, oldValue: formatValue(raw.old), newValue: formatValue(raw.new), isFact: raw.old === undefined || raw.old === null };
		}
		if (Array.isArray(raw) && raw.length === 2 && !raw.some((x) => Array.isArray(x))) {
			return { field, oldValue: formatValue(raw[0]), newValue: formatValue(raw[1]), isFact: raw[0] == null };
		}
		return { field, oldValue: '—', newValue: formatValue(raw), isFact: true };
	});
}

/** Подписи полей `changes`, встречающихся в identity/signing/admin (остальные — как есть). */
const FIELD_LABEL: Record<string, string> = {
	role: 'Роль',
	status: 'Статус',
	team_id: 'Команда',
	manager_id: 'Руководитель',
	display_name: 'Отображаемое имя',
	position: 'Должность',
	locale: 'Локаль',
	timezone: 'Часовой пояс',
	email: 'Email',
	reason: 'Причина',
	auto_unblock_at: 'Авторазблокировка',
	sessions_terminated: 'Сессий завершено',
	signature_requests_voided: 'Запросов подписи аннулировано',
	signatures_disputed: 'Подписей оспорено',
	successor_id: 'Преемник',
	deals_reassigned: 'Сделок переназначено',
	signature_requests_reassigned: 'Запросов подписи переадресовано',
	policy_version: 'Версия политики',
	expires_at: 'Действует до',
	method: 'Способ',
	local_only: 'Только локально',
	self_service: 'Самостоятельно',
	sessions_removed: 'Сессий удалено',
	required: 'Требуемые права',
	granted: 'Имеющиеся права',
	operation: 'Операция',
	mode: 'Режим',
	legal_basis: 'Правовое основание',
	blockers: 'Блокеры',
	grace_until: 'Отсрочка до',
	subject_id: 'Субъект',
	subject_type: 'Тип субъекта',
	is_enabled: 'Включён',
	rollout: 'Раскатка, %',
	description: 'Описание',
	key: 'Ключ',
	value: 'Значение',
	is_secret: 'Секрет',
	rows: 'Строк',
	filters: 'Фильтры',
	doc_type: 'Тип документа',
	entity_type: 'Тип сущности',
	entity_id: 'Сущность',
	signers: 'Подписантов',
	channel: 'Канал',
	attempts: 'Попыток',
	signature_id: 'Подпись',
	viewed_at: 'Просмотрено',
	party_type: 'Тип стороны',
	party_id: 'Сторона',
	conclusion_method: 'Способ заключения',
	template: 'Шаблон',
	deal_id: 'Сделка',
	name: 'Название',
	parent_id: 'Родитель',
	head_id: 'Руководитель команды',
	region_id: 'Регион',
	require_totp: 'Требуется TOTP',
	keycloak_id: 'Keycloak ID',
	source: 'Источник',
	detected_at: 'Обнаружено на этапе'
};

export const fieldLabel = (field: string): string => FIELD_LABEL[field] ?? field;

/** Короткий id для таблиц: `0192a1b2…5a6b`. */
export function shortId(id: string | null | undefined): string {
	if (!id) return '—';
	return id.length > 13 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

/** Запись журнала в том виде, в каком её читают резолверы названий. */
export interface AuditEntryLike {
	action?: string | null;
	entity_type?: string | null;
	entity_id?: string | null;
	changes?: Record<string, unknown> | null;
}

// --- названия остальных типов сущностей (F3-12). Бэкенд имя в запись не пишет (ПДн не оседают в неизменяемой цепочке),
// поэтому имя берётся при показе: по id (кэш на сессию, до 6 запросов одновременно) или из справочника-списка.
const teamCache = new EntityCache<{ id: string; name: string }>((id) => unwrap(api.GET('/api/admin/teams/{team_id}', { params: { path: { team_id: id } } })), 6);
const workflowCache = new EntityCache<{ id: string; name: string }>((id) => unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: id } } })).then((g) => g.workflow), 6);
const dashboardCache = new EntityCache<{ id: string; name: string }>((id) => unwrap(api.GET('/api/dashboards/{dashboard_id}', { params: { path: { dashboard_id: id } } })), 6);
const reportCache = new EntityCache<{ id: string; format: string; created_at: string }>((id) => unwrap(api.GET('/api/reports/{report_id}', { params: { path: { report_id: id } } })), 6);
const importCache = new EntityCache<{ id: string; entity_type: string; created_at: string }>((id) => unwrap(api.GET('/api/imports/{job_id}', { params: { path: { job_id: id } } })), 6);
const licenseCache = new EntityCache<{ id: string; contract_number?: string | null; product_name: string }>((id) => unwrap(api.GET('/api/organization-licenses/{license_id}', { params: { path: { license_id: id } } })), 6);

/** Документы на подпись — одним запросом на пачку id (ручка `batch`), а не по одному. */
const documentTitles = new SvelteMap<string, string | null>();
function ensureDocuments(ids: string[]): void {
	const want = [...new Set(ids)].filter((id) => !documentTitles.has(id));
	if (!want.length) return;
	for (const id of want) documentTitles.set(id, null);
	void getDocumentsBatch(want)
		.then((docs) => {
			for (const d of docs) documentTitles.set(d.id, d.title);
		})
		.catch(() => {});
}

// справочники администратора: шаблоны уведомлений, источники интеграций, версии реестра ЕГРЮЛ (у ручек нет чтения по id или оно дороже списка)
const templateList = new Lazy<{ id: string; code: string; channel: string }[]>(async () => (await unwrap(api.GET('/api/admin/notification-templates', { params: { query: { limit: 100 } } }))).items);
const sourceList = new Lazy<{ id: string; name: string }[]>(async () => await unwrap(api.GET('/api/admin/integrations/sources')));
const registryCache = new EntityCache<{ id: string; created_at: string; imported_at?: string | null }>((id) => unwrap(api.GET('/api/admin/registry/versions/{version_id}', { params: { path: { version_id: id } } })), 6);

const IMPORT_OF: Record<string, string> = { organization: 'организаций', contact: 'контактов', deal: 'сделок', user: 'сотрудников' };

interface Resolver {
	/** кто видит такие сущности: у остальных запрос был бы 403 (Аудитор через резолвер не ходит, у него запасной путь из `changes`) */
	roles: readonly string[] | null;
	ensure(ids: string[]): void;
	label(id: string): string | null;
}

const ensureLazy = (lazy: { ensure(): Promise<unknown> }) => void lazy.ensure().catch(() => {});
const byCache = <T extends { id: string }>(cache: EntityCache<T>, roles: readonly string[] | null, text: (x: T) => string | null): Resolver => ({
	roles,
	ensure: (ids) => cache.ensure(ids),
	label: (id) => {
		const x = cache.get(id);
		return x ? text(x) : null;
	}
});
const byList = <T extends { id: string }>(lazy: { ensure(): Promise<unknown>; value: T[] | undefined }, roles: readonly string[] | null, text: (x: T) => string): Resolver => ({
	roles,
	ensure: () => ensureLazy(lazy),
	label: (id) => {
		const x = lazy.value?.find((r) => r.id === id);
		return x ? text(x) : null;
	}
});
const STAFF = ['KAM', 'HEAD', 'ADMIN'] as const;

/** Реестр резолверов по типу сущности. Типы без записи (файл, задача, комментарий…) остаются на запасном пути `labelFromChanges`. */
const RESOLVERS: Record<string, Resolver> = {
	team: byCache(teamCache, ['ADMIN'], (t) => t.name),
	workflow: byCache(workflowCache, null, (w) => w.name),
	dashboard: byCache(dashboardCache, STAFF, (d) => d.name),
	report_job: byCache(reportCache, STAFF, (r) => `${r.format.toUpperCase()} от ${formatDate(r.created_at)}`),
	import_job: byCache(importCache, ['HEAD', 'ADMIN'], (j) => `${IMPORT_OF[j.entity_type] ? `${IMPORT_OF[j.entity_type]} ` : ''}от ${formatDate(j.created_at)}`),
	organization_license: byCache(licenseCache, STAFF, (l) => l.contract_number || l.product_name),
	notification_template: byList(templateList, ['ADMIN'], (t) => `${NOTIFICATION_EVENT_CODES.find((e) => e.key === t.code)?.value ?? t.code} · ${labelOf(NOTIFICATION_CHANNELS, t.channel)}`),
	integration_source: byList(sourceList, ['ADMIN'], (s) => s.name),
	registry_version: byCache(registryCache, ['ADMIN'], (v) => `Выгрузка ЕГРЮЛ от ${formatDate(v.imported_at ?? v.created_at)}`),
	signature_document: { roles: null, ensure: ensureDocuments, label: (id) => documentTitles.get(id) ?? null },
	product: byList(products, null, (p) => p.name),
	direction: byList(directions, null, (d) => d.name),
	loss_reason: byList(lossReasons, STAFF, (r) => r.name),
	custom_field_def: byList(dealFieldDefs, STAFF, (f) => f.label)
};

const allowed = (r: Resolver): boolean => !r.roles || (!!session.role && r.roles.includes(session.role));

const NAME_KEYS = ['name', 'title', 'original_filename', 'code', 'date'] as const;
const pickChange = (raw: unknown, deleted: boolean): unknown => {
	if (isOldNew(raw)) return deleted ? (raw.old ?? raw.new) : (raw.new ?? raw.old);
	if (Array.isArray(raw) && raw.length === 2) return deleted ? (raw[0] ?? raw[1]) : (raw[1] ?? raw[0]);
	return raw;
};

/** Запасной путь: имя из самой записи — первое непустое из name, title, original_filename, code, date (новое значение; при удалении — старое). */
export function labelFromChanges(entry: AuditEntryLike | null | undefined): string | null {
	const changes = entry?.changes;
	if (!changes) return null;
	const deleted = /DELETED|REMOVED|ARCHIVED/.test(entry?.action ?? '');
	for (const key of NAME_KEYS) {
		const v = pickChange(changes[key], deleted);
		if (typeof v === 'string' && v.trim()) return v.trim();
	}
	return null;
}

/** Подгружает сущности события в те же кэши, что уже держат имена в карточках и списках CRM. */
export function ensureAuditEntities(items: readonly { entity_type?: string | null; entity_id?: string | null }[]): void {
	const ids = (type: string) => items.filter((i) => i.entity_type === type && i.entity_id).map((i) => i.entity_id as string);
	// сделки — только тем, кто их видит (Аудитору сделки недоступны: каждый запрос был бы 403), и списком, а не по одной (удалённые не дают 404)
	if (session.can('deal:read')) void preloadDeals(ids('deal')).catch(() => {});
	orgCache.ensure(ids('organization'));
	contactCache.ensure(ids('contact'));
	people.ensure(ids('user'));
	for (const [type, resolver] of Object.entries(RESOLVERS)) {
		const list = ids(type);
		if (list.length && allowed(resolver)) resolver.ensure(list);
	}
}

/** Название сущности события: по кэшам, затем из `changes` записи; `null` — имени нет (вызывающий показывает короткий id). */
export function entityLabel(type: string | null | undefined, id: string | null | undefined, entry?: AuditEntryLike | null): string | null {
	if (!id) return null;
	switch (type) {
		case 'deal':
			return session.can('deal:read') ? dealLabel(id) : null;
		case 'organization':
			return orgLabel(id);
		case 'contact':
			return contactLabel(id);
		case 'user':
			return people.name(id);
		default: {
			const resolver = type ? RESOLVERS[type] : undefined;
			const named = resolver && allowed(resolver) ? resolver.label(id) : null;
			return named ?? labelFromChanges(entry);
		}
	}
}
