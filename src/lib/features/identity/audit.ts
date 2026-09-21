// Журнал аудита: разбор `changes` (форматы `{field: {old, new}}`, `{field: [old, new]}` и скаляры).

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
