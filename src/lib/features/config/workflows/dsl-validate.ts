// Клиентское зеркало `validate_condition` / `validate_actions` из backend/app/modules/workflow/dsl.py.
// Нужно для валидации «на лету» без похода на сервер (серверный /validate пишет аудит на каждый вызов).

import {
	ATTACHMENT_CATEGORIES,
	DATE_OPERATORS,
	DEAL_FIELDS,
	INTEGRATION_EVENTS,
	LIST_OPERATORS,
	MAX_CONDITION_DEPTH,
	MAX_CONDITION_LEAVES,
	NOTIFY_CHANNELS,
	NOTIFY_RECIPIENTS,
	NUMERIC_OPERATORS,
	ON_EXPIRED,
	ON_REJECTED_PREVIOUS,
	OPERATORS,
	ROLES,
	SIGNATURE_ORDERS,
	TASK_ASSIGNEES,
	TASK_PRIORITIES,
	VALUELESS_OPERATORS,
	type Operator
} from './dsl';

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmptyString = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const ALLOWED_FIELDS: ReadonlySet<string> = new Set(DEAL_FIELDS.map((f) => f.key));
const ATTACHMENT_KEYS: ReadonlySet<string> = new Set(ATTACHMENT_CATEGORIES.map((c) => c.key));
const OPERATOR_SET: ReadonlySet<string> = new Set(OPERATORS);

const toDecimal = (v: unknown): number | null => {
	if (typeof v === 'boolean' || v == null) return null;
	if (typeof v === 'number') return Number.isFinite(v) ? v : null;
	if (typeof v === 'string') {
		const n = Number(v.trim().replace(',', '.'));
		return v.trim() && Number.isFinite(n) ? n : null;
	}
	return null;
};
const toDate = (v: unknown): boolean => {
	if (typeof v !== 'string') return false;
	const raw = v.trim();
	if (!raw) return false;
	if (raw === 'today' || raw === 'now') return true;
	return !Number.isNaN(Date.parse(raw));
};

export interface ConditionValidationOptions {
	/** Коды пользовательских полей (`custom_field_defs.code`); если задан — неизвестное поле считается ошибкой. */
	knownCustomFields?: ReadonlySet<string>;
	path?: string;
}

function validateFieldName(field: string, path: string, known: ReadonlySet<string> | undefined): string[] {
	if (ALLOWED_FIELDS.has(field)) return [];
	for (const prefix of ['custom_fields.', 'attachments.'] as const) {
		if (!field.startsWith(prefix)) continue;
		const tail = field.slice(prefix.length);
		if (!tail || tail.includes('.')) return [`${path}: после «${prefix}» ожидается одно имя без точек`];
		if (prefix === 'attachments.' && !ATTACHMENT_KEYS.has(tail)) return [`${path}: неизвестная категория вложения «${tail}»`];
		if (prefix === 'custom_fields.' && known && !known.has(tail)) return [`${path}: пользовательское поле «${tail}» не определено`];
		return [];
	}
	return [`${path}: поле «${field}» нельзя использовать в условиях`];
}

/** Возвращает список ошибок (пусто — условие корректно). Пустой объект допустим. */
export function validateCondition(node: unknown, options: ConditionValidationOptions = {}): string[] {
	const counter = { leaves: 0 };
	return walk(node, options.path ?? 'Условия', 1, options.knownCustomFields, counter);
}

function walk(node: unknown, path: string, depth: number, known: ReadonlySet<string> | undefined, counter: { leaves: number }): string[] {
	if (node == null || (isRecord(node) && Object.keys(node).length === 0)) return [];
	if (!isRecord(node)) return [`${path}: ожидается объект условия`];
	if (depth > MAX_CONDITION_DEPTH) return [`${path}: слишком глубокая вложенность условий (больше ${MAX_CONDITION_DEPTH})`];

	const keys = Object.keys(node);
	if (keys.includes('all') || keys.includes('any')) {
		const errors: string[] = [];
		if (keys.length > 1) errors.push(`${path}: группа должна содержать только «все» или только «любое»`);
		for (const group of ['all', 'any'] as const) {
			if (!(group in node)) continue;
			const branches = node[group];
			if (!Array.isArray(branches)) {
				errors.push(`${path}: ожидается список условий`);
				continue;
			}
			if (branches.length === 0) errors.push(`${path}: пустая группа условий`);
			branches.forEach((branch, index) => errors.push(...walk(branch, `${path} › ${index + 1}`, depth + 1, known, counter)));
		}
		return errors;
	}

	counter.leaves += 1;
	if (counter.leaves > MAX_CONDITION_LEAVES) return [`${path}: слишком много условий в одном переходе (больше ${MAX_CONDITION_LEAVES})`];

	const errors: string[] = [];
	const unexpected = keys.filter((k) => !['field', 'op', 'value'].includes(k));
	if (unexpected.length) errors.push(`${path}: неизвестные ключи условия: ${unexpected.join(', ')}`);

	const field = node.field;
	if (!nonEmptyString(field)) errors.push(`${path}: не выбрано поле`);
	else errors.push(...validateFieldName(field, path, known));

	const rawOp = node.op;
	if (typeof rawOp !== 'string' || !OPERATOR_SET.has(rawOp)) {
		errors.push(`${path}: неизвестный оператор «${String(rawOp)}»`);
		return errors;
	}
	const op = rawOp as Operator;
	const hasValue = 'value' in node;
	if (VALUELESS_OPERATORS.has(op) && hasValue) errors.push(`${path}: оператор «${op}» не принимает значение`);
	if (!VALUELESS_OPERATORS.has(op) && !hasValue) errors.push(`${path}: укажите значение`);

	const value = node.value;
	if (LIST_OPERATORS.has(op) && !Array.isArray(value)) errors.push(`${path}: для «${op}» нужен список значений`);
	if (NUMERIC_OPERATORS.has(op) && hasValue && toDecimal(value) === null) errors.push(`${path}: значение должно быть числом`);
	if (DATE_OPERATORS.has(op) && hasValue && !toDate(value)) errors.push(`${path}: значение должно быть датой`);
	return errors;
}

// --- Действия -----------------------------------------------------------------

export interface ActionsValidationOptions {
	/** Коды живых статусов воронки — для проверки `on_rejected`. */
	statusCodes?: ReadonlySet<string>;
	path?: string;
}

const rejectUnknown = (action: Record<string, unknown>, allowed: readonly string[], path: string): string[] => {
	const unexpected = Object.keys(action).filter((k) => !allowed.includes(k));
	return unexpected.length ? [`${path}: неизвестные ключи: ${unexpected.join(', ')}`] : [];
};
const validateEnumList = (value: unknown, allowed: readonly string[], path: string): string[] => {
	if (value == null) return [];
	if (!Array.isArray(value) || value.length === 0) return [`${path}: нужен непустой список`];
	const unknown = value.filter((v) => !allowed.includes(String(v)));
	return unknown.length ? [`${path}: недопустимые значения: ${unknown.join(', ')}`] : [];
};
const isDays = (v: unknown): boolean => Number.isInteger(v) && (v as number) > 0 && (v as number) <= 365;

function validateCreateTask(a: Record<string, unknown>, path: string): string[] {
	const errors = rejectUnknown(a, ['type', 'title', 'assignee_role', 'assignee', 'due_days', 'priority'], path);
	if (!nonEmptyString(a.title)) errors.push(`${path}: укажите заголовок задачи`);
	if (a.assignee_role != null && !(ROLES as readonly string[]).includes(String(a.assignee_role))) errors.push(`${path}: неизвестная роль исполнителя`);
	if (a.assignee != null && !(TASK_ASSIGNEES as readonly string[]).includes(String(a.assignee))) errors.push(`${path}: неизвестный исполнитель`);
	if (a.assignee_role == null && a.assignee == null) errors.push(`${path}: выберите исполнителя задачи`);
	if (a.due_days != null && !isDays(a.due_days)) errors.push(`${path}: срок — целое число дней от 1 до 365`);
	if (a.priority != null && !(TASK_PRIORITIES as readonly string[]).includes(String(a.priority))) errors.push(`${path}: неизвестный приоритет`);
	return errors;
}

function validateNotify(a: Record<string, unknown>, path: string): string[] {
	const errors = rejectUnknown(a, ['type', 'event_code', 'channels', 'recipients'], path);
	if (!nonEmptyString(a.event_code)) errors.push(`${path}: укажите код события уведомления`);
	errors.push(...validateEnumList(a.channels, NOTIFY_CHANNELS, `${path} › каналы`));
	errors.push(...validateEnumList(a.recipients, NOTIFY_RECIPIENTS, `${path} › получатели`));
	return errors;
}

function validateRequestSignature(a: Record<string, unknown>, path: string, statusCodes?: ReadonlySet<string>): string[] {
	const errors = rejectUnknown(a, ['type', 'template', 'signers', 'order', 'deadline_days', 'on_rejected', 'on_expired'], path);
	if (!nonEmptyString(a.template)) errors.push(`${path}: выберите шаблон документа`);
	const signers = a.signers;
	if (!Array.isArray(signers) || signers.length === 0) errors.push(`${path}: добавьте хотя бы одного подписанта`);
	else {
		signers.forEach((signer, index) => {
			const sp = `${path} › подписант ${index + 1}`;
			if (!isRecord(signer)) {
				errors.push(`${sp}: некорректная запись`);
				return;
			}
			const keys = Object.keys(signer);
			if (keys.some((k) => !['role', 'contact_role', 'user_id'].includes(k))) errors.push(`${sp}: допустимы роль, роль контакта или пользователь`);
			if (!keys.some((k) => ['role', 'contact_role', 'user_id'].includes(k))) errors.push(`${sp}: укажите роль, роль контакта или пользователя`);
			if ('role' in signer && !(ROLES as readonly string[]).includes(String(signer.role))) errors.push(`${sp}: неизвестная роль`);
		});
	}
	if (a.order != null && !(SIGNATURE_ORDERS as readonly string[]).includes(String(a.order))) errors.push(`${path}: неизвестный порядок подписания`);
	if (a.deadline_days != null && !isDays(a.deadline_days)) errors.push(`${path}: срок подписания — целое число дней от 1 до 365`);
	if (a.on_expired != null && !(ON_EXPIRED as readonly string[]).includes(String(a.on_expired))) errors.push(`${path}: неизвестное действие при истечении срока`);
	const onRejected = a.on_rejected;
	if (onRejected != null && !nonEmptyString(onRejected)) errors.push(`${path}: при отклонении — предыдущий статус или код статуса воронки`);
	else if (nonEmptyString(onRejected) && onRejected !== ON_REJECTED_PREVIOUS && statusCodes && !statusCodes.has(onRejected)) {
		errors.push(`${path}: статус «${onRejected}» для возврата при отклонении не найден в воронке`);
	}
	return errors;
}

function validateIntegrationEvent(a: Record<string, unknown>, path: string): string[] {
	const errors = rejectUnknown(a, ['type', 'event_code', 'payload'], path);
	if (!(INTEGRATION_EVENTS as readonly string[]).includes(String(a.event_code))) errors.push(`${path}: неизвестное событие интеграции`);
	if (a.payload != null && !isRecord(a.payload)) errors.push(`${path}: данные события должны быть объектом`);
	return errors;
}

/** Возвращает список ошибок массива действий перехода (пусто — всё корректно). */
export function validateActions(actions: unknown, options: ActionsValidationOptions = {}): string[] {
	if (actions == null || (Array.isArray(actions) && actions.length === 0)) return [];
	if (!Array.isArray(actions)) return [`${options.path ?? 'Действия'}: ожидается список действий`];
	const base = options.path ?? 'Действие';
	const errors: string[] = [];
	actions.forEach((action, index) => {
		const path = `${base} ${index + 1}`;
		if (!isRecord(action)) {
			errors.push(`${path}: некорректная запись`);
			return;
		}
		switch (action.type) {
			case 'create_task':
				errors.push(...validateCreateTask(action, path));
				break;
			case 'notify':
				errors.push(...validateNotify(action, path));
				break;
			case 'request_signature':
				errors.push(...validateRequestSignature(action, path, options.statusCodes));
				break;
			case 'integration_event':
				errors.push(...validateIntegrationEvent(action, path));
				break;
			default:
				errors.push(`${path}: неизвестный тип действия «${String(action.type)}»`);
		}
	});
	return errors;
}
