// DSL guard-условий и действий переходов — зеркало backend/app/modules/workflow/dsl.py.
// Здесь только типы, каталоги (с русскими подписями) и человекочитаемое описание; проверка — в dsl-validate.ts.

// --- Операторы -------------------------------------------------------------

export const OPERATORS = [
	'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'not_null', 'is_null', 'in', 'not_in', 'contains', 'exists', 'date_before', 'date_after'
] as const;
export type Operator = (typeof OPERATORS)[number];

export const OPERATOR_LABELS: Record<Operator, string> = {
	eq: 'равно',
	neq: 'не равно',
	gt: 'больше',
	gte: 'не меньше',
	lt: 'меньше',
	lte: 'не больше',
	not_null: 'заполнено',
	is_null: 'не заполнено',
	in: 'одно из',
	not_in: 'ни одно из',
	contains: 'содержит',
	exists: 'есть',
	date_before: 'раньше',
	date_after: 'позже'
};

export const VALUELESS_OPERATORS: ReadonlySet<Operator> = new Set<Operator>(['not_null', 'is_null', 'exists']);
export const LIST_OPERATORS: ReadonlySet<Operator> = new Set<Operator>(['in', 'not_in']);
export const NUMERIC_OPERATORS: ReadonlySet<Operator> = new Set<Operator>(['gt', 'gte', 'lt', 'lte']);
export const DATE_OPERATORS: ReadonlySet<Operator> = new Set<Operator>(['date_before', 'date_after']);

export const MAX_CONDITION_DEPTH = 5;
export const MAX_CONDITION_LEAVES = 50;

// --- Условия ----------------------------------------------------------------

export interface ConditionLeaf {
	field: string;
	op: Operator;
	value?: unknown;
}
export interface ConditionAll {
	all: ConditionNode[];
}
export interface ConditionAny {
	any: ConditionNode[];
}
export type ConditionGroup = ConditionAll | ConditionAny;
export type ConditionNode = ConditionLeaf | ConditionGroup;
/** Пустой объект — условие всегда истинно (так его хранит бэкенд). */
export type Condition = ConditionNode | Record<string, never>;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function isEmptyCondition(node: unknown): boolean {
	return node == null || (isRecord(node) && Object.keys(node).length === 0);
}
export function isGroup(node: unknown): node is ConditionGroup {
	return isRecord(node) && ('all' in node || 'any' in node);
}
export function isLeaf(node: unknown): node is ConditionLeaf {
	return isRecord(node) && !isGroup(node) && typeof node.field === 'string';
}
export function groupBranches(group: ConditionGroup): { kind: 'all' | 'any'; branches: ConditionNode[] } {
	return 'all' in group ? { kind: 'all', branches: group.all } : { kind: 'any', branches: group.any };
}

/** Плоский список листьев (как `flatten_leaves` на сервере) — для чек-листов. */
export function flattenLeaves(node: unknown): ConditionLeaf[] {
	if (isLeaf(node)) return [node];
	if (isGroup(node)) return groupBranches(node).branches.flatMap(flattenLeaves);
	return [];
}

// --- Каталог полей ------------------------------------------------------------

export type FieldKind = 'money' | 'number' | 'text' | 'enum' | 'date' | 'reference' | 'boolean' | 'attachment' | 'custom';
export type FieldGroup = 'deal' | 'custom' | 'attachment';

export interface FieldOption {
	key: string;
	value: string;
}
export interface FieldDef {
	key: string;
	label: string;
	kind: FieldKind;
	group: FieldGroup;
	options?: FieldOption[];
}

export const PRIORITY_OPTIONS: FieldOption[] = [
	{ key: 'low', value: 'Низкий' },
	{ key: 'normal', value: 'Обычный' },
	{ key: 'high', value: 'Высокий' },
	{ key: 'critical', value: 'Критический' }
];

/** Значения `deals.signature_status` (dop.md §10.6: guard `signature_status = signed`). */
export const SIGNATURE_STATUS_OPTIONS: FieldOption[] = [
	{ key: 'pending', value: 'Ожидает подписи' },
	{ key: 'signed', value: 'Подписан' },
	{ key: 'rejected', value: 'Отклонён' },
	{ key: 'expired', value: 'Срок истёк' },
	{ key: 'void', value: 'Аннулирован' }
];

/** Белый список полей проекции сделки (dsl.py `ALLOWED_FIELDS`). */
export const DEAL_FIELDS: readonly FieldDef[] = [
	{ key: 'amount', label: 'Сумма', kind: 'money', group: 'deal' },
	{ key: 'currency', label: 'Валюта', kind: 'enum', group: 'deal', options: [{ key: 'RUB', value: 'RUB' }] },
	{ key: 'owner_id', label: 'Ответственный', kind: 'reference', group: 'deal' },
	{ key: 'organization_id', label: 'Организация', kind: 'reference', group: 'deal' },
	{ key: 'contact_id', label: 'Контакт', kind: 'reference', group: 'deal' },
	{ key: 'priority', label: 'Приоритет', kind: 'enum', group: 'deal', options: PRIORITY_OPTIONS },
	{ key: 'loss_reason_id', label: 'Причина отказа', kind: 'reference', group: 'deal' },
	{ key: 'expected_close_date', label: 'Ожидаемая дата закрытия', kind: 'date', group: 'deal' },
	{ key: 'signature_status', label: 'Статус подписания', kind: 'enum', group: 'deal', options: SIGNATURE_STATUS_OPTIONS },
	{ key: 'students_planned', label: 'Планируемое число обучающихся', kind: 'number', group: 'deal' },
	{ key: 'tasks.open_count', label: 'Открытых задач', kind: 'number', group: 'deal' },
	{ key: 'products.count', label: 'Продуктов в сделке', kind: 'number', group: 'deal' }
];

/** Категории вложений (dsl.py `ATTACHMENT_CATEGORIES`). */
export const ATTACHMENT_CATEGORIES: FieldOption[] = [
	{ key: 'contract', value: 'Договор' },
	{ key: 'act', value: 'Акт' },
	{ key: 'license', value: 'Лицензия' },
	{ key: 'presentation', value: 'Презентация' },
	{ key: 'other', value: 'Прочее' }
];

export const ATTACHMENT_FIELDS: readonly FieldDef[] = ATTACHMENT_CATEGORIES.map((c) => ({
	key: `attachments.${c.key}`,
	label: `Вложение «${c.value}»`,
	kind: 'attachment',
	group: 'attachment'
}));

/** Какие операторы предлагать для поля данного типа. */
export const OPERATORS_BY_KIND: Record<FieldKind, Operator[]> = {
	money: ['not_null', 'is_null', 'gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
	number: ['not_null', 'is_null', 'gt', 'gte', 'lt', 'lte', 'eq', 'neq'],
	text: ['not_null', 'is_null', 'eq', 'neq', 'contains', 'in', 'not_in'],
	enum: ['eq', 'neq', 'in', 'not_in', 'not_null', 'is_null'],
	date: ['not_null', 'is_null', 'date_before', 'date_after'],
	reference: ['not_null', 'is_null', 'eq', 'neq', 'in', 'not_in'],
	boolean: ['eq', 'not_null', 'is_null'],
	attachment: ['exists'],
	custom: [...OPERATORS]
};

export interface CustomFieldLike {
	code: string;
	label: string;
	field_type: string;
}

/** Тип пользовательского поля (`custom_field_defs.field_type`) → тип поля условия. */
export function customFieldKind(fieldType: string): FieldKind {
	switch (fieldType) {
		case 'number':
			return 'number';
		case 'date':
			return 'date';
		case 'bool':
			return 'boolean';
		case 'select':
			return 'enum';
		case 'string':
		case 'multiselect':
			return 'text';
		default:
			return 'custom';
	}
}

/** Каталог полей для конструктора: поля сделки + пользовательские + вложения. */
export function fieldCatalogue(customFields: readonly CustomFieldLike[] = []): FieldDef[] {
	const custom: FieldDef[] = customFields.map((f) => ({
		key: `custom_fields.${f.code}`,
		label: f.label,
		kind: customFieldKind(f.field_type),
		group: 'custom'
	}));
	return [...DEAL_FIELDS, ...custom, ...ATTACHMENT_FIELDS];
}

export const DEFAULT_CATALOGUE: readonly FieldDef[] = fieldCatalogue();

/** Описание поля по ключу; неизвестное `custom_fields.*` описывается синтетически, чтобы UI не падал. */
export function findField(key: string, catalogue: readonly FieldDef[] = DEFAULT_CATALOGUE): FieldDef | undefined {
	const known = catalogue.find((f) => f.key === key);
	if (known) return known;
	if (key.startsWith('custom_fields.')) {
		return { key, label: key.slice('custom_fields.'.length), kind: 'custom', group: 'custom' };
	}
	return undefined;
}

export function fieldLabel(key: string, catalogue: readonly FieldDef[] = DEFAULT_CATALOGUE): string {
	return findField(key, catalogue)?.label ?? key;
}

// --- Человекочитаемое описание условия --------------------------------------

const formatDate = (raw: string): string => {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
	return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
};

function formatValue(value: unknown, field: FieldDef | undefined, op: Operator): string {
	if (Array.isArray(value)) return value.map((v) => formatValue(v, field, 'eq')).join(', ');
	if (typeof value === 'boolean') return value ? 'да' : 'нет';
	if (value == null) return '—';
	const raw = String(value);
	if (field?.options) {
		const option = field.options.find((o) => o.key === raw);
		if (option) return `«${option.value}»`;
	}
	if (DATE_OPERATORS.has(op) || field?.kind === 'date') return formatDate(raw);
	if (typeof value === 'number') return new Intl.NumberFormat('ru-RU').format(value);
	return `«${raw}»`;
}

function describeLeaf(leaf: ConditionLeaf, catalogue: readonly FieldDef[]): string {
	const field = findField(leaf.field, catalogue);
	const label = field?.label ?? leaf.field;
	const op = OPERATOR_LABELS[leaf.op] ?? leaf.op;
	if (VALUELESS_OPERATORS.has(leaf.op)) return `${label} ${op}`;
	return `${label} ${op} ${formatValue(leaf.value, field, leaf.op)}`;
}

/**
 * «Сумма заполнена и (Договор подписан или Вложение «Договор» есть)».
 * Пустое условие — «Без условий».
 */
export function describeCondition(node: unknown, catalogue: readonly FieldDef[] = DEFAULT_CATALOGUE, nested = false): string {
	if (isEmptyCondition(node)) return 'Без условий';
	if (isLeaf(node)) return describeLeaf(node, catalogue);
	if (isGroup(node)) {
		const { kind, branches } = groupBranches(node);
		if (branches.length === 0) return kind === 'all' ? 'Без условий' : 'Никогда';
		const parts = branches.map((b) => describeCondition(b, catalogue, true));
		if (parts.length === 1) return parts[0];
		const joined = parts.join(kind === 'all' ? ' и ' : ' или ');
		return nested ? `(${joined})` : joined;
	}
	return 'Некорректное условие';
}

// --- Действия -----------------------------------------------------------------

export const ACTION_TYPES = ['create_task', 'notify', 'request_signature', 'integration_event'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];
export const ACTION_LABELS: Record<ActionType, string> = {
	create_task: 'Создать задачу',
	notify: 'Отправить уведомление',
	request_signature: 'Запросить подпись',
	integration_event: 'Событие интеграции'
};

export const ROLES = ['KAM', 'HEAD', 'ADMIN', 'AUDITOR', 'INTEGRATION'] as const;
export type Role = (typeof ROLES)[number];
export const ROLE_LABELS: Record<Role, string> = {
	KAM: 'Менеджер (КАМ)',
	HEAD: 'Руководитель',
	ADMIN: 'Администратор',
	AUDITOR: 'Аудитор',
	INTEGRATION: 'Интеграция'
};
/** Роли, которые имеет смысл указывать в `allowed_roles` перехода. */
export const TRANSITION_ROLES: readonly Role[] = ['KAM', 'HEAD', 'ADMIN', 'INTEGRATION'];

export const TASK_ASSIGNEES = ['owner', 'manager', 'initiator'] as const;
export type TaskAssignee = (typeof TASK_ASSIGNEES)[number];
export const TASK_ASSIGNEE_LABELS: Record<TaskAssignee, string> = {
	owner: 'Ответственный по сделке',
	manager: 'Руководитель ответственного',
	initiator: 'Инициатор перехода'
};

export const TASK_PRIORITIES = ['low', 'normal', 'high', 'critical'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
	low: 'Низкий',
	normal: 'Обычный',
	high: 'Высокий',
	critical: 'Критический'
};

export const NOTIFY_CHANNELS = ['in_app', 'email', 'telegram'] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];
export const NOTIFY_CHANNEL_LABELS: Record<NotifyChannel, string> = {
	in_app: 'В системе',
	email: 'Электронная почта',
	telegram: 'Telegram'
};

export const NOTIFY_RECIPIENTS = ['owner', 'manager', 'participants', 'team_head', 'initiator', 'contact'] as const;
export type NotifyRecipient = (typeof NOTIFY_RECIPIENTS)[number];
export const NOTIFY_RECIPIENT_LABELS: Record<NotifyRecipient, string> = {
	owner: 'Ответственный',
	manager: 'Руководитель ответственного',
	participants: 'Участники сделки',
	team_head: 'Руководитель команды',
	initiator: 'Инициатор перехода',
	contact: 'Контакт организации'
};

export const SIGNATURE_ORDERS = ['sequential', 'parallel'] as const;
export type SignatureOrder = (typeof SIGNATURE_ORDERS)[number];
export const SIGNATURE_ORDER_LABELS: Record<SignatureOrder, string> = {
	sequential: 'По очереди',
	parallel: 'Одновременно'
};

export const ON_EXPIRED = ['notify_initiator', 'void', 'previous_status'] as const;
export type OnExpired = (typeof ON_EXPIRED)[number];
export const ON_EXPIRED_LABELS: Record<OnExpired, string> = {
	notify_initiator: 'Уведомить инициатора',
	void: 'Аннулировать запрос',
	previous_status: 'Вернуть сделку в предыдущий статус'
};

/** Специальное значение `on_rejected` — вернуть в предыдущий статус (иначе — код статуса воронки). */
export const ON_REJECTED_PREVIOUS = 'previous_status';

export const INTEGRATION_EVENTS = [
	'LEARNING_TRANSFER_REQUESTED', 'LEARNING_ENROLLMENT_SENT', 'LEARNING_PROGRESS_REQUESTED', 'CMS_LEAD_ACCEPTED'
] as const;
export type IntegrationEvent = (typeof INTEGRATION_EVENTS)[number];
export const INTEGRATION_EVENT_LABELS: Record<IntegrationEvent, string> = {
	LEARNING_TRANSFER_REQUESTED: 'Передать материалы в LMS',
	LEARNING_ENROLLMENT_SENT: 'Зачислить в LMS',
	LEARNING_PROGRESS_REQUESTED: 'Запросить прогресс из LMS',
	CMS_LEAD_ACCEPTED: 'Подтвердить лид на сайте (CMS)'
};

export interface Signer {
	role?: Role;
	contact_role?: string;
	user_id?: string;
}
export interface CreateTaskAction {
	type: 'create_task';
	title: string;
	assignee_role?: Role;
	assignee?: TaskAssignee;
	due_days?: number;
	priority?: TaskPriority;
}
export interface NotifyAction {
	type: 'notify';
	event_code: string;
	channels?: NotifyChannel[];
	recipients?: NotifyRecipient[];
}
export interface RequestSignatureAction {
	type: 'request_signature';
	template: string;
	signers: Signer[];
	order?: SignatureOrder;
	deadline_days?: number;
	on_rejected?: string;
	on_expired?: OnExpired;
}
export interface IntegrationEventAction {
	type: 'integration_event';
	event_code: IntegrationEvent;
	payload?: Record<string, unknown>;
}
export type TransitionAction = CreateTaskAction | NotifyAction | RequestSignatureAction | IntegrationEventAction;

/** Заготовка действия для кнопки «Добавить действие». */
export function newAction(type: ActionType): TransitionAction {
	switch (type) {
		case 'create_task':
			return { type, title: '', assignee: 'owner', due_days: 3, priority: 'normal' };
		case 'notify':
			return { type, event_code: 'DEAL_EVENT', channels: ['in_app'], recipients: ['owner'] };
		case 'request_signature':
			return { type, template: '', signers: [{ role: 'HEAD' }], order: 'sequential', deadline_days: 7, on_rejected: ON_REJECTED_PREVIOUS, on_expired: 'notify_initiator' };
		case 'integration_event':
			return { type, event_code: 'LEARNING_ENROLLMENT_SENT' };
	}
}

const listOf = <T extends string>(items: readonly T[] | undefined, labels: Record<T, string>): string =>
	(items ?? []).map((i) => labels[i] ?? i).join(', ');

export interface DescribeActionContext {
	/** code статуса → название (для `on_rejected`). */
	statusNames?: Record<string, string>;
	/** code шаблона документа → название. */
	templateNames?: Record<string, string>;
}

/** Одна строка для карточки действия: «Создать задачу «Юридическое согласование» руководителю, срок 3 дн., высокий приоритет». */
export function describeAction(action: unknown, ctx: DescribeActionContext = {}): string {
	if (!isRecord(action) || typeof action.type !== 'string') return 'Некорректное действие';
	const a = action as unknown as TransitionAction;
	switch (a.type) {
		case 'create_task': {
			const who = a.assignee_role ? ROLE_LABELS[a.assignee_role] ?? a.assignee_role : a.assignee ? TASK_ASSIGNEE_LABELS[a.assignee] ?? a.assignee : 'без исполнителя';
			const parts = [`Задача «${a.title || '…'}» — ${who}`];
			if (a.due_days) parts.push(`срок ${a.due_days} дн.`);
			if (a.priority && a.priority !== 'normal') parts.push(`приоритет: ${TASK_PRIORITY_LABELS[a.priority] ?? a.priority}`);
			return parts.join(', ');
		}
		case 'notify': {
			const parts = [`Уведомление «${a.event_code || '…'}»`];
			if (a.recipients?.length) parts.push(`кому: ${listOf(a.recipients, NOTIFY_RECIPIENT_LABELS)}`);
			if (a.channels?.length) parts.push(`каналы: ${listOf(a.channels, NOTIFY_CHANNEL_LABELS)}`);
			return parts.join(', ');
		}
		case 'request_signature': {
			const template = ctx.templateNames?.[a.template] ?? a.template ?? '…';
			const signers = (a.signers ?? [])
				.map((s) => (s.role ? ROLE_LABELS[s.role] ?? s.role : s.contact_role ? `контакт: ${s.contact_role}` : s.user_id ? 'пользователь' : '?'))
				.join(', ');
			const parts = [`Подпись «${template}» — ${signers || 'подписанты не указаны'}`];
			if (a.order) parts.push(SIGNATURE_ORDER_LABELS[a.order].toLowerCase());
			if (a.deadline_days) parts.push(`срок ${a.deadline_days} дн.`);
			const rejected = a.on_rejected ?? ON_REJECTED_PREVIOUS;
			parts.push(
				rejected === ON_REJECTED_PREVIOUS ? 'при отклонении — в предыдущий статус' : `при отклонении — в «${ctx.statusNames?.[rejected] ?? rejected}»`
			);
			if (a.on_expired) parts.push(`при истечении — ${ON_EXPIRED_LABELS[a.on_expired]?.toLowerCase() ?? a.on_expired}`);
			return parts.join(', ');
		}
		case 'integration_event':
			return `Интеграция: ${INTEGRATION_EVENT_LABELS[a.event_code] ?? a.event_code}`;
		default:
			return `Неизвестное действие «${String((action as Record<string, unknown>).type)}»`;
	}
}
