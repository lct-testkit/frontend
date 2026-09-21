import type {
	ApprovalOperation,
	ApprovalStatus,
	AuditResult,
	ErasureMode,
	ErasureStatus,
	ErasureSubjectType,
	Role,
	StatusMeta,
	UserStatus
} from './types';

export const ROLE_LABEL: Record<Role, string> = {
	KAM: 'Менеджер (КАМ)',
	HEAD: 'Руководитель',
	ADMIN: 'Администратор',
	AUDITOR: 'Аудитор',
	INTEGRATION: 'Интеграция'
};

/** Роли, которые администратор может назначить вручную (INTEGRATION — сервисная, через сиды). */
export const ASSIGNABLE_ROLES: Role[] = ['KAM', 'HEAD', 'ADMIN', 'AUDITOR'];

const USER_STATUS: Record<UserStatus, StatusMeta> = {
	invited: { label: 'Приглашён', tone: 'info' },
	active: { label: 'Активен', tone: 'success' },
	blocked: { label: 'Заблокирован', tone: 'error' },
	terminated: { label: 'Уволен', tone: 'neutral' },
	anonymized: { label: 'Обезличен', tone: 'neutral' }
};

const ERASURE_STATUS: Record<ErasureStatus, StatusMeta> = {
	pending: { label: 'Отсрочка', tone: 'info' },
	blocked: { label: 'Заблокирован', tone: 'error' },
	approved: { label: 'Отсрочка', tone: 'info' },
	rejected: { label: 'Отклонён', tone: 'neutral' },
	completed: { label: 'Исполнен', tone: 'success' }
};

const APPROVAL_STATUS: Record<ApprovalStatus, StatusMeta> = {
	pending: { label: 'Ожидает', tone: 'warning' },
	approved: { label: 'Подтверждена', tone: 'success' },
	rejected: { label: 'Отклонена', tone: 'error' },
	expired: { label: 'Истекла', tone: 'neutral' },
	consumed: { label: 'Выполнена', tone: 'neutral' }
};

const APPROVAL_OPERATION: Record<ApprovalOperation, string> = {
	'user.create_admin': 'Создание администратора',
	'user.erasure': 'Удаление/обезличивание сотрудника',
	'contact.erasure': 'Удаление/обезличивание контакта',
	'organization.erasure': 'Удаление/обезличивание ИП'
};

export const ERASURE_MODE_LABEL: Record<ErasureMode, string> = {
	anonymize: 'Обезличивание',
	hard_delete: 'Жёсткое удаление'
};

export const ERASURE_SUBJECT_LABEL: Record<ErasureSubjectType, string> = {
	user: 'Сотрудник',
	contact: 'Контакт',
	organization: 'ИП'
};

const AUDIT_RESULT: Record<AuditResult, StatusMeta> = {
	success: { label: 'Успех', tone: 'success' },
	denied: { label: 'Отказ', tone: 'warning' },
	error: { label: 'Ошибка', tone: 'error' }
};

const unknown = (label: string): StatusMeta => ({ label, tone: 'neutral' });

export const roleLabel = (role: string): string => ROLE_LABEL[role as Role] ?? role;
export const userStatusMeta = (s: string): StatusMeta => USER_STATUS[s as UserStatus] ?? unknown(s);
export const erasureStatusMeta = (s: string): StatusMeta => ERASURE_STATUS[s as ErasureStatus] ?? unknown(s);
export const approvalStatusMeta = (s: string): StatusMeta => APPROVAL_STATUS[s as ApprovalStatus] ?? unknown(s);
export const approvalOperationLabel = (op: string): string => APPROVAL_OPERATION[op as ApprovalOperation] ?? op;
export const auditResultMeta = (r: string): StatusMeta => AUDIT_RESULT[r as AuditResult] ?? unknown(r);

/** Блокеры запроса на удаление (admin_service.collect_erasure_blockers + catalog) → подсказка, как снять. */
export interface BlockerHint {
	label: string;
	hint: string;
	/** Куда вести кнопкой «Исправить»: маршрут относительно субъекта (null — снять нельзя). */
	action: 'offboard' | 'tasks' | 'users' | 'block' | null;
}

const BLOCKERS: Record<string, BlockerHint> = {
	last_admin: { label: 'Последний администратор', hint: 'Назначьте роль ADMIN другому активному пользователю.', action: 'users' },
	active_deals: { label: 'Активные сделки', hint: 'Передайте дела преемнику через мастер увольнения.', action: 'offboard' },
	open_tasks: { label: 'Незакрытые задачи', hint: 'Закройте или переназначьте задачи.', action: 'tasks' },
	has_signatures: {
		label: 'Есть подписи',
		hint: 'Подписи не обезличиваются: подпись без идентификации подписанта теряет юридическую силу (ст. 6 ч. 1 п. 5, 7 152-ФЗ).',
		action: null
	},
	account_active: { label: 'Учётная запись активна', hint: 'Сначала заблокируйте или увольте сотрудника.', action: 'block' },
	active_contract: { label: 'Действующий договор', hint: 'Обработка законна до окончания договора и срока хранения — запрос можно обоснованно отклонить.', action: null },
	subject_missing: { label: 'Субъект не найден', hint: 'Запись субъекта удалена.', action: null }
};

export function blockerHint(code: string, fallbackDetail = ''): BlockerHint {
	return BLOCKERS[code] ?? { label: code, hint: fallbackDetail, action: null };
}

/** Закрытый перечень действий аудита (backend/app/modules/audit/actions.py) с подписями для фильтра и таблицы. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
	USER_CREATED: 'Пользователь создан',
	USER_INVITED: 'Приглашение выдано',
	USER_ACTIVATED: 'Пользователь активирован',
	USER_UPDATED: 'Пользователь изменён',
	USER_BLOCKED: 'Пользователь заблокирован',
	USER_UNBLOCKED: 'Пользователь разблокирован',
	USER_ROLE_CHANGED: 'Роль изменена',
	USER_OFFBOARDED: 'Дела переданы',
	USER_TERMINATED: 'Пользователь уволен',
	PASSWORD_CHANGED: 'Пароль изменён',
	PASSWORD_RESET: 'Пароль сброшен',
	CONSENT_ACCEPTED: 'Согласие принято',
	SESSIONS_TERMINATED: 'Сессии завершены',
	TEAM_CREATED: 'Команда создана',
	TEAM_UPDATED: 'Команда изменена',
	DEAL_CREATED: 'Сделка создана',
	DEAL_UPDATED: 'Сделка изменена',
	DEAL_STATUS_CHANGED: 'Статус сделки изменён',
	DEAL_OWNER_CHANGED: 'Ответственный изменён',
	DEAL_CLOSED: 'Сделка закрыта',
	DEAL_REASSIGNED_BULK: 'Массовое переназначение',
	PARTICIPANT_ADDED: 'Участник добавлен',
	PARTICIPANT_REMOVED: 'Участник удалён',
	TASK_CREATED: 'Задача создана',
	TASK_UPDATED: 'Задача изменена',
	TASK_COMPLETED: 'Задача выполнена',
	COMMENT_CREATED: 'Комментарий добавлен',
	COMMENT_UPDATED: 'Комментарий изменён',
	COMMENT_DELETED: 'Комментарий удалён',
	FILE_UPLOAD_INTENT: 'Загрузка файла начата',
	FILE_COMMITTED: 'Файл сохранён',
	FILE_INFECTED: 'Файл заражён',
	FILE_TOO_LARGE: 'Файл слишком большой',
	FILE_DOWNLOADED: 'Файл скачан',
	FILE_DELETED: 'Файл удалён',
	ATTACHMENT_CREATED: 'Вложение добавлено',
	ATTACHMENT_DELETED: 'Вложение удалено',
	IMPORT_STARTED: 'Импорт запущен',
	IMPORT_VALIDATED: 'Импорт проверен',
	IMPORT_APPLIED: 'Импорт применён',
	IMPORT_ROLLBACK: 'Импорт откачен',
	IMPORT_PRESET_CREATED: 'Пресет импорта создан',
	REPORT_EXPORTED: 'Отчёт выгружен',
	REPORT_FAILED: 'Отчёт не сформирован',
	INTEGRATION_SOURCE_UPDATED: 'Источник интеграции изменён',
	DASHBOARD_CREATED: 'Дашборд создан',
	DASHBOARD_UPDATED: 'Дашборд изменён',
	DASHBOARD_DELETED: 'Дашборд удалён',
	DASHBOARD_WIDGET_ADDED: 'Виджет добавлен',
	DASHBOARD_WIDGET_UPDATED: 'Виджет изменён',
	DASHBOARD_WIDGET_REMOVED: 'Виджет удалён',
	WORKFLOW_CREATED: 'Воронка создана',
	WORKFLOW_PUBLISHED: 'Воронка опубликована',
	WORKFLOW_VALIDATED: 'Воронка проверена',
	STATUS_ARCHIVED: 'Статус архивирован',
	STATUS_MAPPING_STARTED: 'Перенос сделок начат',
	STATUS_MAPPING_COMPLETED: 'Перенос сделок завершён',
	ORGANIZATION_CREATED: 'Организация создана',
	ORGANIZATION_UPDATED: 'Организация изменена',
	ORGANIZATION_DUPLICATE_FOUND: 'Найден дубликат организации',
	ORG_REGISTRY_IMPORTED: 'Реестр ЕГРЮЛ импортирован',
	ORG_DRIFT_APPLIED: 'Изменения из ЕГРЮЛ приняты',
	ORG_LIQUIDATION_DETECTED: 'Обнаружена ликвидация',
	CONTACT_CREATED: 'Контакт создан',
	CONTACT_UPDATED: 'Контакт изменён',
	PRODUCT_CREATED: 'Продукт создан',
	PRODUCT_UPDATED: 'Продукт изменён',
	DIRECTION_CREATED: 'Направление создано',
	DIRECTION_UPDATED: 'Направление изменено',
	LOSS_REASON_CREATED: 'Причина отказа создана',
	LOSS_REASON_UPDATED: 'Причина отказа изменена',
	HOLIDAY_CREATED: 'Праздник добавлен',
	HOLIDAY_UPDATED: 'Праздник изменён',
	CUSTOM_FIELD_DEF_CREATED: 'Поле создано',
	CUSTOM_FIELD_DEF_UPDATED: 'Поле изменено',
	NOTIFICATION_TEMPLATE_CREATED: 'Шаблон уведомления создан',
	NOTIFICATION_TEMPLATE_UPDATED: 'Шаблон уведомления изменён',
	SIGNATURE_DOCUMENT_CREATED: 'Документ на подпись создан',
	SIGNATURE_DOCUMENT_SENT: 'Документ отправлен на подпись',
	SIGNATURE_VIEWED: 'Документ просмотрен подписантом',
	SIGNATURE_CHALLENGED: 'Код подтверждения отправлен',
	SIGNATURE_SIGNED: 'Документ подписан',
	SIGNATURE_REJECTED: 'Подпись отклонена',
	SIGNATURE_VOID: 'Документ аннулирован',
	SIGNATURE_VERIFIED: 'Подпись проверена',
	SIGNATURE_OTP_FAILED: 'Неверный код подтверждения',
	SIGNATURE_KEY_COMPROMISED: 'Компрометация ключа подписи',
	EDM_AGREEMENT_CREATED: 'Соглашение об ЭДО оформлено',
	EDM_AGREEMENT_REVOKED: 'Соглашение об ЭДО отозвано',
	ERASURE_REQUEST_CREATED: 'Запрос на удаление создан',
	ERASURE_REQUEST_BLOCKED: 'Запрос на удаление заблокирован',
	ERASURE_REQUEST_APPROVED: 'Запрос на удаление одобрен',
	ERASURE_REQUEST_REJECTED: 'Запрос на удаление отклонён',
	ERASURE_REQUEST_RESTORED: 'Удаление отменено (восстановлено)',
	ERASURE_EXECUTED: 'Удаление исполнено',
	PII_ACCESS: 'Доступ к ПДн',
	PII_REVEALED: 'ПДн раскрыты',
	MASS_EXPORT: 'Массовая выгрузка',
	LOGIN_SUCCEEDED: 'Вход выполнен',
	LOGIN_FAILED: 'Неудачный вход',
	LOGOUT: 'Выход',
	SESSION_TERMINATED: 'Сессия завершена',
	AUDIT_EXPORTED: 'Журнал аудита выгружен',
	ADMIN_APPROVAL_REQUESTED: 'Запрошено подтверждение второго администратора',
	ADMIN_APPROVAL_GRANTED: 'Подтверждение выдано',
	ADMIN_APPROVAL_REJECTED: 'Подтверждение отклонено',
	FEATURE_FLAG_CHANGED: 'Флаг функции изменён',
	SYSTEM_SETTING_CHANGED: 'Системная настройка изменена',
	ACCESS_DENIED: 'Отказ в доступе'
};

export const auditActionLabel = (action: string): string => AUDIT_ACTION_LABEL[action] ?? action;

export const ENTITY_TYPE_LABEL: Record<string, string> = {
	user: 'Пользователь',
	team: 'Команда',
	deal: 'Сделка',
	task: 'Задача',
	comment: 'Комментарий',
	file: 'Файл',
	attachment: 'Вложение',
	organization: 'Организация',
	contact: 'Контакт',
	workflow: 'Воронка',
	workflow_status: 'Статус воронки',
	import_job: 'Импорт',
	report_job: 'Отчёт',
	dashboard: 'Дашборд',
	signature_document: 'Документ на подпись',
	signature_request: 'Запрос подписи',
	edm_agreement: 'Соглашение об ЭДО',
	data_erasure_request: 'Запрос на удаление',
	admin_approval: 'Согласование',
	consent: 'Согласие',
	feature_flag: 'Флаг функции',
	system_setting: 'Системная настройка',
	audit_log: 'Журнал аудита',
	notification_template: 'Шаблон уведомления',
	integration_source: 'Источник интеграции',
	product: 'Продукт',
	direction: 'Направление',
	loss_reason: 'Причина отказа',
	holiday: 'Праздник',
	custom_field_def: 'Пользовательское поле',
	import_preset: 'Пресет импорта',
	registry_version: 'Версия реестра',
	participant: 'Участник сделки',
	organization_registry: 'Реестр ЕГРЮЛ'
};

export const entityTypeLabel = (type: string | null | undefined): string =>
	type ? (ENTITY_TYPE_LABEL[type] ?? type) : '—';
