// Подписи перечислений бэкенда по-русски (crm/models.py, catalog/models.py, files/schemas.py, notification/schemas.py,
// workflow/schemas.py). Ключи — значения из API; неизвестное значение возвращается как есть.

export type BadgeScheme = 'accent' | 'neutral' | 'success' | 'warning' | 'error' | 'info';

export const label = (map: Record<string, string>, key: string | null | undefined): string => (key ? (map[key] ?? key) : '—');

export const PRIORITY_LABELS: Record<string, string> = {
	low: 'Низкий',
	normal: 'Обычный',
	high: 'Высокий',
	critical: 'Критический'
};

export const PRIORITY_SCHEMES: Record<string, BadgeScheme> = {
	low: 'neutral',
	normal: 'info',
	high: 'warning',
	critical: 'error'
};

export const SLA_STATE_LABELS: Record<string, string> = {
	ok: 'В норме',
	warning: 'Истекает',
	breached: 'Нарушен',
	paused: 'Остановлен'
};

export const SIGNATURE_STATUS_LABELS: Record<string, string> = {
	none: 'Не требуется',
	pending: 'На подписи',
	partially_signed: 'Подписан частично',
	signed: 'Подписан',
	rejected: 'Отклонён',
	expired: 'Истёк срок',
	void: 'Аннулирован'
};

export const SIGNATURE_STATUS_SCHEMES: Record<string, BadgeScheme> = {
	none: 'neutral',
	pending: 'info',
	partially_signed: 'info',
	signed: 'success',
	rejected: 'error',
	expired: 'warning',
	void: 'neutral'
};

export const DEAL_TYPE_LABELS: Record<string, string> = { b2b: 'B2B', b2c: 'B2C' };

/** Тип статуса воронки → цвет, если у статуса не задан свой `color`. */
export const STATUS_TYPE_LABELS: Record<string, string> = {
	initial: 'Начальный',
	intermediate: 'Промежуточный',
	won: 'Успешно закрыта',
	lost: 'Отказ',
	parked: 'Заморожена'
};

export const STATUS_TYPE_SCHEMES: Record<string, BadgeScheme> = {
	initial: 'neutral',
	intermediate: 'accent',
	won: 'success',
	lost: 'error',
	parked: 'warning'
};

export const TASK_STATUS_LABELS: Record<string, string> = {
	open: 'Открыта',
	in_progress: 'В работе',
	done: 'Выполнена',
	cancelled: 'Отменена'
};

export const TASK_STATUS_SCHEMES: Record<string, BadgeScheme> = {
	open: 'info',
	in_progress: 'accent',
	done: 'success',
	cancelled: 'neutral'
};

export const PARTICIPANT_ROLE_LABELS: Record<string, string> = {
	watcher: 'Наблюдатель',
	co_owner: 'Соисполнитель',
	lawyer: 'Юрист',
	methodist: 'Методист'
};

export const HISTORY_REASON_LABELS: Record<string, string> = {
	manual: 'вручную',
	workflow_migration: 'перенос при изменении воронки',
	integration: 'интеграция',
	auto: 'автоматически',
	signature_rejected: 'подпись отклонена'
};

export const DEAL_EVENT_LABELS: Record<string, string> = {
	CREATED: 'Сделка создана',
	OWNER_CHANGED: 'Сменён ответственный',
	FIELD_CHANGED: 'Изменены поля',
	FILE_ADDED: 'Добавлен файл',
	SIGNATURE_REQUESTED: 'Запрошена подпись',
	SIGNATURE_SIGNED: 'Документ подписан',
	SIGNATURE_REJECTED: 'Подпись отклонена',
	IMPORT_APPLIED: 'Применён импорт',
	WORKFLOW_MIGRATION: 'Перенос между статусами воронки'
};

/** Подписи полей сделки — для формы перехода и диффов истории. */
export const DEAL_FIELD_LABELS: Record<string, string> = {
	title: 'Название',
	amount: 'Сумма',
	currency: 'Валюта',
	students_planned: 'Обучающихся (план)',
	expected_close_date: 'Плановая дата закрытия',
	priority: 'Приоритет',
	organization_id: 'Организация',
	contact_id: 'Контакт',
	loss_reason_id: 'Причина отказа',
	owner_id: 'Ответственный',
	status_id: 'Статус',
	source: 'Источник',
	signature_status: 'Статус подписи'
};

export const ATTACHMENT_CATEGORY_LABELS: Record<string, string> = {
	contract: 'Договор',
	presentation: 'Презентация',
	act: 'Акт',
	license: 'Лицензия',
	report: 'Отчёт',
	signature_container: 'Контейнер подписи',
	other: 'Прочее'
};

export const FILE_STATUS_LABELS: Record<string, string> = {
	pending: 'Загружается',
	ready: 'Готов',
	infected: 'Не прошёл проверку',
	quarantined: 'В карантине',
	deleted: 'Удалён'
};

export const ORG_TYPE_LABELS: Record<string, string> = {
	university: 'Вуз',
	college: 'Колледж',
	company: 'Компания',
	individual_entrepreneur: 'ИП'
};

export const REGISTRY_STATUS_LABELS: Record<string, string> = {
	active: 'Действует',
	reorganizing: 'Реорганизация',
	liquidating: 'Ликвидируется',
	liquidated: 'Ликвидирована',
	invalid: 'Недействительна'
};

export const REGISTRY_STATUS_SCHEMES: Record<string, BadgeScheme> = {
	active: 'success',
	reorganizing: 'warning',
	liquidating: 'error',
	liquidated: 'error',
	invalid: 'neutral'
};

export const TRANSFER_STATUS_LABELS: Record<string, string> = {
	not_started: 'Не начата',
	in_progress: 'В процессе',
	transferred: 'Передана',
	declined: 'Не состоялась'
};

export const TRANSFER_STATUS_SCHEMES: Record<string, BadgeScheme> = {
	not_started: 'neutral',
	in_progress: 'info',
	transferred: 'success',
	declined: 'error'
};

export const ORG_FIELD_LABELS: Record<string, string> = {
	name: 'Полное название',
	short_name: 'Краткое название',
	full_name: 'Полное название',
	org_type: 'Тип',
	inn: 'ИНН',
	kpp: 'КПП',
	ogrn: 'ОГРН',
	legal_address: 'Юридический адрес',
	registry_status: 'Статус в ЕГРЮЛ',
	actual_address: 'Фактический адрес',
	region_id: 'Регион',
	website: 'Сайт',
	main_phone: 'Телефон',
	main_email: 'E-mail',
	students_count: 'Студентов',
	owner_id: 'Ответственный',
	status: 'Статус в ЕГРЮЛ',
	opf_name: 'ОПФ',
	okved_main: 'Основной ОКВЭД',
	registration_date: 'Дата регистрации'
};

/** Предпочитаемые способы связи с человеком (`contact_methods`) — в шаблоне «Вендоры» это колонка «Способ связи». */
export const CONTACT_METHOD_LABELS: Record<string, string> = {
	email: 'Почта',
	phone: 'Звонок',
	telegram: 'Чат в Telegram',
	whatsapp: 'WhatsApp'
};

export const CONTACT_CHANNEL_LABELS: Record<string, string> = {
	telegram: 'Telegram',
	whatsapp: 'WhatsApp',
	phone_extra: 'Доп. телефон',
	email_extra: 'Доп. e-mail'
};

export const LOSS_REASON_CATEGORY_LABELS: Record<string, string> = {
	price: 'Цена',
	timing: 'Сроки',
	competitor: 'Конкурент',
	no_need: 'Нет потребности',
	no_budget: 'Нет бюджета',
	no_contact: 'Нет контакта',
	other: 'Другое'
};

export const NOTIFICATION_PRIORITY_LABELS: Record<string, string> = {
	normal: 'Обычный',
	high: 'Высокий',
	critical: 'Критический'
};

export const NOTIFICATION_CHANNEL_LABELS: Record<string, string> = {
	in_app: 'В приложении',
	email: 'E-mail',
	telegram: 'Telegram'
};

export const ENTITY_TYPE_LABELS: Record<string, string> = {
	deal: 'Сделка',
	organization: 'Организация',
	contact: 'Контакт',
	task: 'Задача',
	signature_document: 'Документ на подпись',
	report_job: 'Отчёт',
	import_job: 'Импорт',
	user: 'Пользователь'
};

export const DEAL_SOURCE_LABELS: Record<string, string> = {
	manual: 'Вручную',
	import: 'Импорт',
	cms: 'Сайт',
	bitrix: 'Bitrix24',
	lms: 'LMS',
	demo: 'Демо-данные'
};
