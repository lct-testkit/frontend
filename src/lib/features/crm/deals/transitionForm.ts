// Сборка диалога перехода по статусу (new_spec §4.9 п.5, dop.md §10.6).
//
// Вход: переход из `GET /deals/{id}/available-transitions` (плоские листья условий с `satisfied`), дерево условий
// того же перехода из графа `GET /workflows/{id}` (там сохранена структура `all`/`any`), целевой статус
// (`required_fields`), сделка и определения пользовательских полей. Выход: какие поля спросить прямо в диалоге
// (`fields` в `POST /transition`), какие подсказки показать для условий, которые полем не закрыть (вложения, подпись,
// открытые задачи, роль), нужен ли комментарий и можно ли вообще отправлять.
//
// Белый список полей, которые бэкенд принимает через `fields` (crm/service.py `_TRANSITION_DIRECT_FIELDS`
// + `custom_fields.*`), зашит здесь: остальное правится через PATCH до перехода.

import { ATTACHMENT_CATEGORY_LABELS, BUILTIN_CUSTOM_FIELD_LABELS, DEAL_FIELD_LABELS, SIGNATURE_STATUS_LABELS } from '../shared/labels';

export interface ConditionLeaf {
	field: string;
	op: string;
	expected?: unknown;
	actual?: unknown;
	satisfied: boolean;
}

export interface AvailableTransitionLike {
	id: string;
	name: string;
	to_status_id: string;
	requires_comment: boolean;
	role_allowed: boolean;
	satisfied: boolean;
	conditions: ConditionLeaf[];
	actions?: Array<Record<string, unknown>>;
}

/** Узел дерева условий DSL (раздел 8): лист `{field, op, value}` или группа `{all: [...]}` / `{any: [...]}`. */
export type ConditionNode =
	| { all: ConditionNode[] }
	| { any: ConditionNode[] }
	| { field: string; op: string; value?: unknown }
	| Record<string, unknown>;

export interface StatusLike {
	id: string;
	name: string;
	type: string;
	required_fields: string[];
}

export interface CustomFieldDefLike {
	code: string;
	label: string;
	field_type: string;
	options?: Record<string, unknown> | null;
	is_required?: boolean;
	is_active?: boolean;
	workflow_id?: string | null;
}

export interface DealLike {
	amount?: string | number | null;
	currency?: string | null;
	expected_close_date?: string | null;
	loss_reason_id?: string | null;
	students_planned?: number | null;
	title?: string;
	custom_fields?: Record<string, unknown> | null;
}

export type FormFieldInput = 'money' | 'currency' | 'date' | 'number' | 'text' | 'select' | 'multiselect' | 'bool';

export interface TransitionFormField {
	/** Ключ для `fields` запроса: `amount`, `expected_close_date`, `custom_fields.resume_at` … */
	key: string;
	label: string;
	input: FormFieldInput;
	required: boolean;
	/** Откуда взялось поле: невыполненное условие перехода или `required_fields` статуса. */
	source: 'condition' | 'required_field';
	/** Для `eq`-условий с ожидаемым значением (например `custom_fields.contact_verified == true`). */
	expected?: unknown;
	currentValue: unknown;
	options?: Array<{ key: string; value: string }>;
	/** Поле из группы «одно из» (any): само по себе не обязательно, нужно заполнить хотя бы одно поле группы (см. unmetAlternatives). */
	alternative?: boolean;
}

/** Условия-файлы: `attachments.<категория>` — файл в сделке вообще, `step_attachments.<категория>` — файл, приложенный на ЭТОМ шаге. */
export function fileLeaf(field: string): { category: string; stepScoped: boolean } | null {
	for (const [prefix, stepScoped] of [
		['step_attachments.', true],
		['attachments.', false]
	] as const) {
		if (field.startsWith(prefix) && field.length > prefix.length) return { category: field.slice(prefix.length), stepScoped };
	}
	return null;
}

export interface FileRequirement {
	field: string;
	category: string;
	label: string;
	/** файл нужен именно на этом шаге (приложенный раньше не считается) */
	stepScoped: boolean;
	/** сервер уже считает условие выполненным */
	satisfied: boolean;
	/** условие из группы «одно из»: достаточно любого из условий группы (например, подписанный документ ИЛИ договор) */
	alternative: boolean;
}

/** Поля, входящие в группы «одно из» (any из двух и более веток) на любой глубине дерева. */
export function anyGroupFields(node: ConditionNode | null | undefined): Set<string> {
	const out = new Set<string>();
	const walk = (n: ConditionNode | null | undefined) => {
		if (!n || typeof n !== 'object' || !isGroup(n)) return;
		const any = n.any ?? [];
		if (any.length > 1) for (const b of any) for (const l of flattenLeaves(b)) out.add(l.field);
		for (const b of [...(n.all ?? []), ...any]) walk(b);
	};
	walk(node);
	return out;
}

/** Файловые требования перехода по листьям условий (и выполненные, и нет — выполненные показываем как «приложен»). */
export function fileRequirements(conditions: readonly ConditionLeaf[], tree?: ConditionNode | null): FileRequirement[] {
	const alt = anyGroupFields(tree ?? null);
	const out: FileRequirement[] = [];
	for (const leaf of conditions) {
		const f = fileLeaf(leaf.field);
		if (!f) continue;
		out.push({
			field: leaf.field,
			category: f.category,
			label: ATTACHMENT_CATEGORY_LABELS[f.category] ?? f.category,
			stepScoped: f.stepScoped,
			satisfied: leaf.satisfied,
			alternative: alt.has(leaf.field)
		});
	}
	return out;
}

/**
 * Хватит ли файлов, приложенных в диалоге (категории `pending`), чтобы выполнить условия-файлы: лист-файл считается выполненным,
 * если его уже выполнил сервер или в диалоге приложен файл этой категории. Остальные листья считаем как есть (их закрывают поля и сервер).
 * Возвращает поля файловых условий, которые всё ещё нужны (пусто — файлов достаточно).
 */
export function missingFileFields(conditions: readonly ConditionLeaf[], tree: ConditionNode | null | undefined, pending: ReadonlySet<string>): string[] {
	const satisfiedNow = new Set(conditions.filter((c) => c.satisfied).map((c) => c.field));
	const fileFields = conditions.filter((c) => !c.satisfied && fileLeaf(c.field)).map((c) => c.field);
	if (!fileFields.length) return [];
	const leafOk = (leaf: { field: string }) => {
		if (satisfiedNow.has(leaf.field)) return true;
		const f = fileLeaf(leaf.field);
		if (f) return pending.has(f.category);
		return isFillableField(leaf.field); // поля закрывает форма диалога; подпись, задачи и т. п. — только если уже выполнены
	};
	const ok = tree ? treeSatisfiable(tree, leafOk) : conditions.every((c) => leafOk(c));
	return ok ? [] : fileFields.filter((f) => !pending.has(fileLeaf(f)!.category));
}

export type TransitionHintKind = 'attachment' | 'signature' | 'tasks' | 'products' | 'edit' | 'role' | 'other';

export interface TransitionHint {
	kind: TransitionHintKind;
	field: string;
	text: string;
	satisfied: boolean;
	/** для `attachment`: категория файла и нужен ли он именно на этом шаге */
	category?: string;
	stepScoped?: boolean;
}

export interface TransitionForm {
	fields: TransitionFormField[];
	hints: TransitionHint[];
	needsComment: boolean;
	/** Есть группа `any`, где условия альтернативны — показать «выполните одно из». */
	groups: Array<{ mode: 'all' | 'any'; fields: string[] }>;
	/** Группы «одно из» (any из двух и более веток): поля каждой группы, все листья — поля диалога (иначе решает бэкенд). */
	alternatives: string[][];
	/** Отправлять нельзя: роль не подходит или есть условие, которое нельзя закрыть в диалоге. */
	blocked: boolean;
	blockedReason?: string;
}

const DIRECT_FIELDS: Record<string, FormFieldInput> = {
	amount: 'money',
	currency: 'currency',
	expected_close_date: 'date',
	loss_reason_id: 'select',
	students_planned: 'number',
	title: 'text'
};

const CUSTOM_PREFIX = 'custom_fields.';

export function isFillableField(field: string): boolean {
	return field in DIRECT_FIELDS || (field.startsWith(CUSTOM_PREFIX) && field.length > CUSTOM_PREFIX.length);
}

const isGroup = (node: unknown): node is { all?: ConditionNode[]; any?: ConditionNode[] } =>
	typeof node === 'object' && node !== null && ('all' in node || 'any' in node);

const isLeaf = (node: unknown): node is { field: string; op: string; value?: unknown } =>
	typeof node === 'object' && node !== null && typeof (node as { field?: unknown }).field === 'string';

/** Все листья дерева условий в порядке обхода (как `dsl.flatten_leaves` на бэкенде). */
export function flattenLeaves(node: ConditionNode | null | undefined): Array<{ field: string; op: string; value?: unknown }> {
	if (!node || typeof node !== 'object') return [];
	if (isGroup(node)) {
		const out: Array<{ field: string; op: string; value?: unknown }> = [];
		for (const branch of [...(node.all ?? []), ...(node.any ?? [])]) out.push(...flattenLeaves(branch));
		return out;
	}
	return isLeaf(node) ? [node] : [];
}

/**
 * Выполнимо ли дерево, если считать выполненными листья, для которых `leafOk(field, op)` вернёт true.
 * Пустое дерево — выполнимо.
 */
export function treeSatisfiable(node: ConditionNode | null | undefined, leafOk: (leaf: { field: string; op: string; value?: unknown }) => boolean): boolean {
	if (!node || typeof node !== 'object') return true;
	if (isGroup(node)) {
		const all = node.all ?? [];
		const any = node.any ?? [];
		const allOk = all.every((branch) => treeSatisfiable(branch, leafOk));
		const anyOk = any.length === 0 || any.some((branch) => treeSatisfiable(branch, leafOk));
		return allOk && anyOk;
	}
	return isLeaf(node) ? leafOk(node) : true;
}

/** Группы верхнего уровня для подписи «все условия» / «одно из условий». */
export function topLevelGroups(node: ConditionNode | null | undefined): Array<{ mode: 'all' | 'any'; fields: string[] }> {
	if (!node || typeof node !== 'object') return [];
	if (isGroup(node)) {
		const groups: Array<{ mode: 'all' | 'any'; fields: string[] }> = [];
		if (node.all?.length) groups.push({ mode: 'all', fields: node.all.flatMap((b) => flattenLeaves(b).map((l) => l.field)) });
		if (node.any?.length) groups.push({ mode: 'any', fields: node.any.flatMap((b) => flattenLeaves(b).map((l) => l.field)) });
		return groups;
	}
	return isLeaf(node) ? [{ mode: 'all', fields: [node.field] }] : [];
}

/** Группы «одно из» дерева: any из двух и более веток, в которых все листья закрываются полем диалога. */
export function alternativeGroups(node: ConditionNode | null | undefined): string[][] {
	if (!node || typeof node !== 'object' || !isGroup(node)) return [];
	const out: string[][] = [];
	const any = node.any ?? [];
	if (any.length > 1) {
		const fields = [...new Set(any.flatMap((b) => flattenLeaves(b).map((l) => l.field)))];
		if (fields.every(isFillableField)) out.push(fields);
	}
	for (const branch of node.all ?? []) out.push(...alternativeGroups(branch));
	return out;
}

/** Группы «одно из», где не заполнено ни одно поле и ни одно условие ещё не выполнено: их поля получают ошибку «заполните одно из». */
export function unmetAlternatives(form: Pick<TransitionForm, 'alternatives'>, values: Record<string, unknown>, satisfiedFields: ReadonlySet<string>): Set<string> {
	const bad = new Set<string>();
	for (const group of form.alternatives) {
		if (group.some((key) => satisfiedFields.has(key) || !isEmptyValue(values[key]))) continue;
		for (const key of group) bad.add(key);
	}
	return bad;
}

const isEmptyValue = (value: unknown): boolean =>
	value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

function dealValue(deal: DealLike, field: string): unknown {
	if (field.startsWith(CUSTOM_PREFIX)) return deal.custom_fields?.[field.slice(CUSTOM_PREFIX.length)];
	return (deal as Record<string, unknown>)[field];
}

function customOptions(def: CustomFieldDefLike | undefined): Array<{ key: string; value: string }> | undefined {
	const raw = def?.options;
	if (!raw) return undefined;
	const list = (raw.items ?? raw.values ?? raw.options) as unknown;
	if (!Array.isArray(list)) return undefined;
	return list.map((item) => {
		if (typeof item === 'object' && item !== null) {
			const o = item as { key?: unknown; value?: unknown; label?: unknown };
			const key = String(o.key ?? o.value ?? '');
			return { key, value: String(o.label ?? o.value ?? key) };
		}
		return { key: String(item), value: String(item) };
	});
}

function inputFor(field: string, op: string, def: CustomFieldDefLike | undefined, expected?: unknown): FormFieldInput {
	if (field in DIRECT_FIELDS) return DIRECT_FIELDS[field];
	switch (def?.field_type) {
		case 'number':
			return 'number';
		case 'date':
			return 'date';
		case 'bool':
			return 'bool';
		case 'select':
			return 'select';
		case 'multiselect':
			return 'multiselect';
		case 'string':
			return 'text';
		default:
			break;
	}
	// Определения нет: угадываем по оператору, ожидаемому значению и имени поля.
	if ((op === 'eq' || op === 'neq') && typeof expected === 'boolean') return 'bool';
	if (op === 'date_before' || op === 'date_after' || /(_at|_date|date_)/.test(field)) return 'date';
	if (op === 'gt' || op === 'gte' || op === 'lt' || op === 'lte') return 'number';
	return 'text';
}

function labelFor(field: string, def: CustomFieldDefLike | undefined): string {
	if (def) return def.label;
	if (field in DEAL_FIELD_LABELS) return DEAL_FIELD_LABELS[field];
	if (field.startsWith(CUSTOM_PREFIX)) {
		const code = field.slice(CUSTOM_PREFIX.length);
		return BUILTIN_CUSTOM_FIELD_LABELS[code] ?? code.replace(/_/g, ' ');
	}
	return field;
}

function hintFor(leaf: ConditionLeaf): TransitionHint | null {
	const { field, satisfied } = leaf;
	const file = fileLeaf(field);
	if (file) {
		const label = ATTACHMENT_CATEGORY_LABELS[file.category] ?? file.category;
		return {
			kind: 'attachment',
			field,
			satisfied,
			category: file.category,
			stepScoped: file.stepScoped,
			text: file.stepScoped ? `Приложите файл «${label}» на этом шаге` : `Приложите файл «${label}»`
		};
	}
	if (field === 'signature_status') {
		const expected = typeof leaf.expected === 'string' ? leaf.expected : 'signed';
		return {
			kind: 'signature',
			field,
			satisfied,
			text: expected === 'signed' ? 'Требуется подписанный документ — вкладка «Подписание»' : `Статус подписи должен быть «${SIGNATURE_STATUS_LABELS[String(expected)] ?? expected}»`
		};
	}
	if (field === 'tasks.open_count') {
		const open = typeof leaf.actual === 'number' ? leaf.actual : null;
		return { kind: 'tasks', field, satisfied, text: open ? `Закройте открытые задачи (${open})` : 'Закройте открытые задачи' };
	}
	if (field === 'products.count') {
		return { kind: 'products', field, satisfied, text: 'Добавьте продукты в сделку' };
	}
	if (isFillableField(field)) return null;
	const label = DEAL_FIELD_LABELS[field] ?? field;
	return { kind: 'edit', field, satisfied, text: `Заполните поле «${label}» в карточке сделки («Редактировать»)` };
}

export interface BuildTransitionFormInput {
	transition: AvailableTransitionLike;
	/** Дерево условий этого перехода из графа воронки (`transitions[].conditions`); без него — только плоские листья. */
	conditionTree?: ConditionNode | null;
	targetStatus?: StatusLike | null;
	deal: DealLike;
	customFieldDefs?: CustomFieldDefLike[];
	/** у пользователя есть право загружать файлы: условия-файлы закрываются прямо в диалоге */
	canUploadFiles?: boolean;
}

export function buildTransitionForm({ transition, conditionTree, targetStatus, deal, customFieldDefs = [], canUploadFiles = true }: BuildTransitionFormInput): TransitionForm {
	const defs = new Map(customFieldDefs.filter((d) => d.is_active !== false).map((d) => [CUSTOM_PREFIX + d.code, d]));
	const fields = new Map<string, TransitionFormField>();
	const hints: TransitionHint[] = [];
	const alternatives = alternativeGroups(conditionTree ?? null);

	const addField = (key: string, source: 'condition' | 'required_field', op = 'not_null', expected?: unknown) => {
		if (fields.has(key)) return;
		const def = defs.get(key);
		fields.set(key, {
			key,
			label: labelFor(key, def),
			input: inputFor(key, op, def, expected),
			// поле из группы «одно из» не обязательно само по себе: хватит любого поля группы
			required: source === 'required_field' || !alternatives.some((g) => g.includes(key)),
			alternative: source === 'condition' && alternatives.some((g) => g.includes(key)) ? true : undefined,
			source,
			expected: op === 'eq' ? expected : undefined,
			currentValue: dealValue(deal, key),
			options: customOptions(def)
		});
	};

	// 1. Невыполненные условия перехода: заполняемые → поля, остальные → подсказки.
	for (const leaf of transition.conditions) {
		if (leaf.satisfied) {
			const hint = hintFor(leaf);
			if (hint) hints.push(hint);
			continue;
		}
		if (isFillableField(leaf.field)) {
			addField(leaf.field, 'condition', leaf.op, leaf.expected);
		} else {
			const hint = hintFor(leaf);
			if (hint) hints.push(hint);
		}
	}

	// 2. Обязательные поля целевого статуса, которые ещё пусты (сервер их не проверяет, но форма честнее с ними).
	for (const field of targetStatus?.required_fields ?? []) {
		if (!isEmptyValue(dealValue(deal, field))) continue;
		if (isFillableField(field)) {
			addField(field, 'required_field');
			// статус требует это поле само по себе, как бы ни читалась группа «одно из»
			const known = fields.get(field);
			if (known) fields.set(field, { ...known, required: true, alternative: undefined });
		} else {
			hints.push({ kind: 'edit', field, satisfied: false, text: `Заполните поле «${DEAL_FIELD_LABELS[field] ?? field}» в карточке сделки` });
		}
	}

	// 3. Выполнимость: лист считается закрываемым, если он уже выполнен или его можно заполнить полем диалога.
	const satisfiedNow = new Set(transition.conditions.filter((c) => c.satisfied).map((c) => c.field));
	// файл закрывается загрузкой прямо в диалоге — если есть право на файлы
	const leafOk = (leaf: { field: string }) => satisfiedNow.has(leaf.field) || isFillableField(leaf.field) || (canUploadFiles && fileLeaf(leaf.field) !== null);
	const satisfiable = conditionTree ? treeSatisfiable(conditionTree, leafOk) : transition.conditions.every(leafOk);

	let blocked = false;
	let blockedReason: string | undefined;
	if (!transition.role_allowed) {
		blocked = true;
		blockedReason = 'Переход недоступен для вашей роли';
		hints.unshift({ kind: 'role', field: '', satisfied: false, text: blockedReason });
	} else if (!satisfiable) {
		blocked = true;
		blockedReason = 'Сначала выполните условия перехода';
	}

	return {
		fields: [...fields.values()],
		hints,
		needsComment: transition.requires_comment,
		groups: topLevelGroups(conditionTree ?? null),
		alternatives,
		blocked,
		blockedReason
	};
}

/** Тело `fields` для `POST /transition`: только заполненные значения, даты и числа — в формате API. */
export function serializeTransitionFields(values: Record<string, unknown>, fields: TransitionFormField[]): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const field of fields) {
		const value = values[field.key];
		if (isEmptyValue(value)) continue;
		switch (field.input) {
			case 'date':
				out[field.key] = value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
				break;
			case 'number':
				out[field.key] = typeof value === 'number' ? value : Number(String(value).replace(/\s/g, '').replace(',', '.'));
				break;
			case 'money':
				out[field.key] = String(value).replace(/\s/g, '').replace(',', '.');
				break;
			case 'bool':
				out[field.key] = Boolean(value);
				break;
			default:
				out[field.key] = value;
		}
	}
	return out;
}

/** «Другая причина» (категория `other` причины отказа, вариант «Другое / Иная причина» в списке): к такому выбору нужно описание словами. */
export function isOtherReason(name: string | null | undefined, category?: string | null): boolean {
	// у причины отказа есть категория — ей и верим («Другой поставщик» — это категория competitor, а не «другая причина»)
	if (category) return category === 'other';
	return /^\s*(друг(ая|ое|ие)|ин(ая|ое|ые)|проч(ая|ее|ие)|other)(\s+причин[а-яё]*)?\s*$/i.test(name ?? '');
}
