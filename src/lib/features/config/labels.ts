// Русские подписи перечислений области «Настройка и данные» (значения — из схем бэкенда).

export interface Option<K extends string = string> {
	key: K;
	value: string;
}

export const labelOf = <K extends string>(options: readonly Option<K>[], key: string | null | undefined, fallback = '—'): string =>
	options.find((o) => o.key === key)?.value ?? (key ? String(key) : fallback);

// --- Справочники -----------------------------------------------------------------

export const PRODUCT_FORMATS: readonly Option[] = [
	{ key: 'online', value: 'Онлайн' },
	{ key: 'offline', value: 'Очно' },
	{ key: 'blended', value: 'Смешанный' }
];

export const LOSS_REASON_CATEGORIES: readonly Option[] = [
	{ key: 'price', value: 'Цена' },
	{ key: 'timing', value: 'Сроки' },
	{ key: 'competitor', value: 'Конкурент' },
	{ key: 'no_need', value: 'Нет потребности' },
	{ key: 'no_budget', value: 'Нет бюджета' },
	{ key: 'no_contact', value: 'Нет контакта' },
	{ key: 'other', value: 'Другое' }
];

export const CUSTOM_FIELD_ENTITIES: readonly Option[] = [
	{ key: 'deal', value: 'Сделка' },
	{ key: 'organization', value: 'Организация' },
	{ key: 'contact', value: 'Контакт' },
	{ key: 'product', value: 'Продукт' }
];

export const CUSTOM_FIELD_TYPES: readonly Option[] = [
	{ key: 'string', value: 'Текст' },
	{ key: 'number', value: 'Число' },
	{ key: 'date', value: 'Дата' },
	{ key: 'bool', value: 'Да / нет' },
	{ key: 'select', value: 'Выбор из списка' },
	{ key: 'multiselect', value: 'Несколько из списка' },
	{ key: 'file', value: 'Файл' }
];

export const ORG_TYPES: readonly Option[] = [
	{ key: 'university', value: 'Вуз' },
	{ key: 'college', value: 'Колледж' },
	{ key: 'company', value: 'Компания' },
	{ key: 'individual_entrepreneur', value: 'ИП' }
];

// --- Реестр ЕГРЮЛ -------------------------------------------------------------------

export const REGISTRY_SOURCES: readonly Option[] = [
	{ key: 'fns_egrul', value: 'ФНС — ЕГРЮЛ' },
	{ key: 'rosobrnadzor', value: 'Рособрнадзор' },
	{ key: 'manual', value: 'Вручную' }
];
/** Фоновая задача разбирает только выгрузку ФНС (registry/tasks.py). */
export const SUPPORTED_REGISTRY_SOURCES: ReadonlySet<string> = new Set(['fns_egrul']);

export const REGISTRY_STATUSES: readonly Option[] = [
	{ key: 'pending', value: 'В очереди' },
	{ key: 'running', value: 'Загружается' },
	{ key: 'completed', value: 'Загружена' },
	{ key: 'failed', value: 'Ошибка' }
];
export const isRegistryBusy = (status: string): boolean => status === 'pending' || status === 'running';

// --- Интеграции -----------------------------------------------------------------------

export const INTEGRATION_SOURCES: readonly Option[] = [
	{ key: 'cms', value: 'Сайт (CMS)' },
	{ key: 'lms', value: 'LMS' },
	{ key: 'bitrix24', value: 'Bitrix24' }
];

export const AUTH_TYPES: readonly Option[] = [
	{ key: 'hmac', value: 'HMAC-подпись' },
	{ key: 'bearer', value: 'Bearer-токен' },
	{ key: 'basic', value: 'Логин и пароль' },
	{ key: 'none', value: 'Без авторизации' }
];

export const OUTBOX_STATUSES: readonly Option[] = [
	{ key: 'pending', value: 'Ожидает' },
	{ key: 'sent', value: 'Отправлено' },
	{ key: 'failed', value: 'Ошибка, будет повтор' },
	{ key: 'dead', value: 'Не доставлено' }
];

export const INBOUND_STATUSES: readonly Option[] = [
	{ key: 'received', value: 'Получено' },
	{ key: 'processed', value: 'Обработано' },
	{ key: 'failed', value: 'Ошибка' },
	{ key: 'duplicate', value: 'Дубликат' }
];

export const SYNC_DIRECTIONS: readonly Option[] = [
	{ key: 'inbound', value: 'Входящая' },
	{ key: 'outbound', value: 'Исходящая' }
];

export const HEALTH_STATUSES: readonly Option[] = [
	{ key: 'ok', value: 'Все системы работают' },
	{ key: 'degraded', value: 'Частичная деградация' },
	{ key: 'unavailable', value: 'Недоступно' }
];

export const HEALTH_DEPENDENCY_LABELS: Record<string, string> = {
	postgres: 'База данных',
	redis: 'Redis',
	keycloak: 'Keycloak',
	jwks: 'Keycloak (ключи)',
	storage: 'Файловое хранилище',
	seaweedfs: 'Файловое хранилище',
	queue: 'Очередь задач'
};

/** Паспорт вебхука для карточки источника (машинные ручки `POST /api/v1/integrations/*`). */
export interface WebhookPassport {
	path: string;
	headers: string[];
	body: string;
}
export const WEBHOOK_PASSPORTS: Record<string, WebhookPassport> = {
	cms: {
		path: '/api/v1/integrations/cms/leads',
		headers: ['Content-Type: application/json', 'X-Signature: sha256=<HMAC-SHA256 тела секретом>', 'Idempotency-Key: <уникальный id доставки>'],
		body: '{ "lead_id": "…", "name": "…", "phone": "…", "email": "…", "course": "…" }'
	},
	lms: {
		path: '/api/v1/integrations/lms/progress',
		headers: ['Content-Type: application/json', 'X-Signature: sha256=<HMAC-SHA256 тела секретом>'],
		body: '{ "external_id": "<id доставки>", "items": [ { "deal_id": "…", "external_course_id": "…", "progress_pct": 40 } ] }'
	},
	bitrix24: {
		path: '/api/v1/integrations/bitrix/webhook',
		headers: ['Content-Type: application/json', 'X-Signature: sha256=<HMAC-SHA256 тела секретом>'],
		body: '{ "external_id": "<id события>", "bitrix_id": "42", "version": 2, "fields": { "title": "…" } }'
	}
};

// --- Уведомления ----------------------------------------------------------------------

export const NOTIFICATION_CHANNELS: readonly Option[] = [
	{ key: 'in_app', value: 'В системе' },
	{ key: 'email', value: 'Электронная почта' },
	{ key: 'telegram', value: 'Telegram' }
];

/** Известные коды событий и переменные их шаблонов (из notification/seed.py). */
export const NOTIFICATION_EVENT_CODES: readonly { key: string; value: string; variables: string[] }[] = [
	{ key: 'USER_PASSWORD_CHANGED', value: 'Пароль изменён', variables: ['changed_at', 'ip'] },
	{ key: 'USER_PASSWORD_RESET', value: 'Пароль сброшен администратором', variables: ['reason'] },
	{ key: 'USER_ACCOUNT_BLOCKED', value: 'Учётная запись заблокирована', variables: ['reason'] },
	{ key: 'USER_ACCOUNT_UNBLOCKED', value: 'Учётная запись разблокирована', variables: ['reason'] },
	{ key: 'USER_ROLE_CHANGED', value: 'Роль изменена', variables: ['old_role', 'new_role'] },
	{ key: 'USER_OFFBOARD_SUCCESSOR', value: 'Переданы сделки уволенного', variables: ['deals'] },
	{ key: 'ERASURE_REQUEST_BLOCKED', value: 'Запрос на удаление заблокирован', variables: ['blockers'] },
	{ key: 'ERASURE_COMPLETED', value: 'Запрос на удаление исполнен', variables: ['mode'] },
	{ key: 'SIGNATURE_REQUESTED', value: 'Документ направлен на подпись', variables: ['template'] },
	{ key: 'SIGNATURE_DOCUMENT_SIGNED', value: 'Документ подписан', variables: [] },
	{ key: 'SIGNATURE_DOCUMENT_REJECTED', value: 'Подписание отклонено', variables: ['reason'] },
	{ key: 'SIGNATURE_DOCUMENT_EXPIRED', value: 'Срок подписания истёк', variables: [] },
	{ key: 'SIGNATURE_OTP_LOCKED', value: 'Запрос на подпись заблокирован', variables: [] },
	{ key: 'EDM_AGREEMENT_MISSING', value: 'Нет соглашения об ЭДО', variables: [] },
	{ key: 'ORG_REQUISITES_DRIFT_DETECTED', value: 'Изменились реквизиты организации', variables: ['fields'] },
	{ key: 'ORG_DRIFT_APPLIED', value: 'Реквизиты применены из реестра', variables: [] },
	{ key: 'ORG_LIQUIDATION_DETECTED', value: 'Контрагент ликвидируется', variables: [] },
	{ key: 'DEAL_SLA_WARNING', value: 'SLA: истекает срок', variables: [] },
	{ key: 'DEAL_SLA_BREACHED', value: 'SLA нарушен', variables: [] },
	{ key: 'DEAL_REASSIGNED', value: 'Назначена сделка', variables: [] },
	{ key: 'DEAL_EVENT', value: 'Событие по сделке', variables: [] }
];
