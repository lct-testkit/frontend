// Черновик графа воронки: серверный граф ↔ редактируемая модель ↔ узлы/рёбра @xyflow/svelte, автораскладка.
// Ничего из общего слоя не импортирует — чистая логика, покрыта graph.test.ts.

import type { Edge, Node } from '@xyflow/svelte';
import type { Condition, TransitionAction } from './dsl';

// --- Перечисления -------------------------------------------------------------

export const STATUS_TYPES = ['initial', 'intermediate', 'won', 'lost', 'parked'] as const;
export type StatusType = (typeof STATUS_TYPES)[number];
export const STATUS_TYPE_LABELS: Record<StatusType, string> = {
	initial: 'Начальный',
	intermediate: 'Промежуточный',
	won: 'Успех',
	lost: 'Отказ',
	parked: 'Заморозка'
};
export const TERMINAL_TYPES: ReadonlySet<StatusType> = new Set<StatusType>(['won', 'lost', 'parked']);

export const WORKFLOW_STATES = ['draft', 'published', 'archived'] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];
export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
	draft: 'Черновик',
	published: 'Опубликована',
	archived: 'В архиве'
};

export const DEAL_TYPES = ['b2b', 'b2c'] as const;
export type DealType = (typeof DEAL_TYPES)[number];
export const DEAL_TYPE_LABELS: Record<DealType, string> = { b2b: 'B2B (организации)', b2c: 'B2C (физлица)' };

export const SLA_MODES = ['recalculate', 'keep', 'reset'] as const;
export type SlaMode = (typeof SLA_MODES)[number];
export const SLA_MODE_LABELS: Record<SlaMode, { label: string; hint: string }> = {
	recalculate: { label: 'Пересчитать', hint: 'Срок считается заново по SLA целевого статуса' },
	keep: { label: 'Сохранить', hint: 'Накопленное время и срок остаются как были' },
	reset: { label: 'Сбросить', hint: 'Таймер начинается с нуля без учёта прошлого' }
};

/** Формат кода статуса/воронки на сервере: `^[a-z][a-z0-9_]{1,63}$`. */
export const CODE_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

// --- Черновик --------------------------------------------------------------------

export interface StatusDraft {
	/** Стабильный ключ узла на холсте: `id` сохранённого статуса или `new-N` у нового. */
	key: string;
	id: string | null;
	code: string;
	name: string;
	type: StatusType;
	color: string | null;
	sort_order: number;
	required_fields: string[];
	is_archived: boolean;
	archived_at: string | null;
	replaced_by_status_id: string | null;
}

export interface TransitionDraft {
	key: string;
	id: string | null;
	/** Ключи статусов (`StatusDraft.key`). */
	from: string;
	to: string;
	name: string;
	allowed_roles: string[];
	conditions: Condition;
	actions: TransitionAction[];
	requires_comment: boolean;
	sort_order: number;
}

export interface SlaDraft {
	key: string;
	status: string;
	max_duration_hours: number;
	warn_threshold_pct: number;
	/** доля срока в процентах, после которой сделка эскалируется (100–1000; по умолчанию 150) */
	escalate_threshold_pct: number;
	escalate_to_role: string | null;
	escalate_to_user_id: string | null;
	channels: string[];
	count_business_days: boolean;
	is_active: boolean;
}

export interface GraphDraft {
	statuses: StatusDraft[];
	transitions: TransitionDraft[];
	sla_rules: SlaDraft[];
}

export interface GraphIssue {
	severity: 'error' | 'warning';
	code: string;
	message: string;
	statusKeys: string[];
	transitionKeys: string[];
	source: 'client' | 'server';
}

// --- Серверные формы (структурно совместимы с GraphOut / GraphIn из OpenAPI) ---------

export interface ServerStatus {
	id: string;
	code: string;
	name: string;
	type: string;
	color?: string | null;
	sort_order: number;
	required_fields: string[];
	is_archived: boolean;
	archived_at?: string | null;
	replaced_by_status_id?: string | null;
}
export interface ServerTransition {
	id: string;
	from_status_id: string;
	to_status_id: string;
	name: string;
	allowed_roles: string[];
	conditions: Record<string, unknown>;
	actions: Record<string, unknown>[];
	requires_comment: boolean;
	sort_order: number;
}
export interface ServerSlaRule {
	id: string;
	status_id: string;
	max_duration_hours: number;
	warn_threshold_pct: number;
	escalate_threshold_pct?: number;
	escalate_to_role?: string | null;
	escalate_to_user_id?: string | null;
	channels: string[];
	count_business_days: boolean;
	is_active: boolean;
}
export interface ServerGraph {
	statuses: ServerStatus[];
	transitions: ServerTransition[];
	sla_rules: ServerSlaRule[];
}

export interface GraphPayloadStatus {
	id?: string | null;
	code: string;
	name: string;
	type: StatusType;
	color: string | null;
	sort_order: number;
	required_fields: string[];
	is_archived: boolean;
}
export interface GraphPayloadTransition {
	id?: string | null;
	from_status: string;
	to_status: string;
	name: string;
	allowed_roles: string[];
	conditions: Record<string, unknown>;
	actions: Record<string, unknown>[];
	requires_comment: boolean;
	sort_order: number;
}
export interface GraphPayloadSla {
	status: string;
	max_duration_hours: number;
	warn_threshold_pct: number;
	/** доля срока в процентах, после которой сделка эскалируется (100–1000; по умолчанию 150) */
	escalate_threshold_pct: number;
	escalate_to_role: string | null;
	escalate_to_user_id: string | null;
	channels: string[];
	count_business_days: boolean;
	is_active: boolean;
}
/** Тело `PUT /api/workflows/{id}/graph`. */
export interface GraphPayload {
	statuses: GraphPayloadStatus[];
	transitions: GraphPayloadTransition[];
	sla_rules: GraphPayloadSla[];
}

const asStatusType = (t: string): StatusType => ((STATUS_TYPES as readonly string[]).includes(t) ? (t as StatusType) : 'intermediate');

export function fromServer(graph: ServerGraph): GraphDraft {
	return {
		statuses: graph.statuses.map((s) => ({
			key: s.id,
			id: s.id,
			code: s.code,
			name: s.name,
			type: asStatusType(s.type),
			color: s.color ?? null,
			sort_order: s.sort_order,
			required_fields: [...s.required_fields],
			is_archived: s.is_archived,
			archived_at: s.archived_at ?? null,
			replaced_by_status_id: s.replaced_by_status_id ?? null
		})),
		transitions: graph.transitions.map((t) => ({
			key: t.id,
			id: t.id,
			from: t.from_status_id,
			to: t.to_status_id,
			name: t.name,
			allowed_roles: [...t.allowed_roles],
			conditions: t.conditions as Condition,
			actions: t.actions as unknown as TransitionAction[],
			requires_comment: t.requires_comment,
			sort_order: t.sort_order
		})),
		sla_rules: graph.sla_rules.map((r) => ({
			key: r.id,
			status: r.status_id,
			max_duration_hours: r.max_duration_hours,
			warn_threshold_pct: r.warn_threshold_pct,
			escalate_threshold_pct: r.escalate_threshold_pct ?? 150,
			escalate_to_role: r.escalate_to_role ?? null,
			escalate_to_user_id: r.escalate_to_user_id ?? null,
			channels: [...r.channels],
			count_business_days: r.count_business_days,
			is_active: r.is_active
		}))
	};
}

/**
 * Тело `PUT /graph`. Архивные статусы и всё, что на них ссылается, в тело не попадают:
 * сервер их не редактирует и отвергает попытку (service.py `save_graph`).
 * Ссылка на статус — его `id`, у нового статуса — `code`.
 */
export function toServer(draft: GraphDraft): GraphPayload {
	const live = draft.statuses.filter((s) => !s.is_archived);
	const ref = new Map(live.map((s) => [s.key, s.id ?? s.code] as const));
	return {
		statuses: live.map((s) => ({
			...(s.id ? { id: s.id } : {}),
			code: s.code,
			name: s.name,
			type: s.type,
			color: s.color,
			sort_order: s.sort_order,
			required_fields: [...s.required_fields],
			is_archived: false
		})),
		transitions: draft.transitions
			.filter((t) => ref.has(t.from) && ref.has(t.to))
			.map((t) => ({
				...(t.id ? { id: t.id } : {}),
				from_status: ref.get(t.from) as string,
				to_status: ref.get(t.to) as string,
				name: t.name,
				allowed_roles: [...t.allowed_roles],
				conditions: (t.conditions ?? {}) as Record<string, unknown>,
				actions: (t.actions ?? []) as unknown as Record<string, unknown>[],
				requires_comment: t.requires_comment,
				sort_order: t.sort_order
			})),
		sla_rules: draft.sla_rules
			.filter((r) => ref.has(r.status))
			.map((r) => ({
				status: ref.get(r.status) as string,
				max_duration_hours: r.max_duration_hours,
				warn_threshold_pct: r.warn_threshold_pct,
				escalate_threshold_pct: r.escalate_threshold_pct,
				escalate_to_role: r.escalate_to_role,
				escalate_to_user_id: r.escalate_to_user_id,
				channels: [...r.channels],
				count_business_days: r.count_business_days,
				is_active: r.is_active
			}))
	};
}

// --- Правки черновика (иммутабельно) ---------------------------------------------

let newCounter = 0;
/** Ключ нового элемента; уникален в пределах вкладки. */
export const newKey = (prefix = 'new'): string => `${prefix}-${++newCounter}-${Date.now().toString(36)}`;

const TRANSLIT: Record<string, string> = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
	о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
	э: 'e', ю: 'yu', я: 'ya'
};

export function transliterate(text: string): string {
	return text
		.toLowerCase()
		.split('')
		.map((ch) => TRANSLIT[ch] ?? ch)
		.join('');
}

/** Код из названия: транслит → snake_case → латиница/цифры/_, уникальный среди `taken`. */
export function makeCode(name: string, taken: Iterable<string> = [], fallback = 'status'): string {
	const used = new Set(taken);
	let base = transliterate(name)
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '')
		.replace(/_{2,}/g, '_')
		.slice(0, 48);
	if (!base || !/^[a-z]/.test(base)) base = base ? `${fallback}_${base}` : fallback;
	if (base.length < 2) base = `${base}_1`;
	let code = base;
	let n = 2;
	while (used.has(code)) code = `${base}_${n++}`;
	return code;
}

export function statusByKey(draft: GraphDraft, key: string): StatusDraft | undefined {
	return draft.statuses.find((s) => s.key === key);
}

/** Шаги воронки: не архивные начальный и промежуточные статусы по `sort_order` (при равном порядке — как в черновике). */
export function stepsOf(draft: GraphDraft): StatusDraft[] {
	return draft.statuses
		.map((s, i) => [s, i] as const)
		.filter(([s]) => !s.is_archived && (s.type === 'initial' || s.type === 'intermediate'))
		.sort((a, b) => a[0].sort_order - b[0].sort_order || a[1] - b[1])
		.map(([s]) => s);
}

/** Порядок завершающих статусов начинается с этого числа: шаги всегда левее (шагов не больше 99). */
export const TERMINAL_ORDER_FROM = 1000;

export function newStatus(draft: GraphDraft, init: Partial<Pick<StatusDraft, 'name' | 'type' | 'color'>> = {}): StatusDraft {
	const name = init.name?.trim() || 'Новый статус';
	// шаг встаёт за последним шагом (а не за «Заморожена» с порядком 1020: иначе переход из заморозки в него считался бы «вперёд»),
	// завершающий — за последним завершающим
	const terminal = init.type === 'won' || init.type === 'lost' || init.type === 'parked';
	const maxOrder = terminal
		? draft.statuses.filter((s) => s.sort_order >= TERMINAL_ORDER_FROM).reduce((m, s) => Math.max(m, s.sort_order), TERMINAL_ORDER_FROM - 10)
		: draft.statuses.filter((s) => s.sort_order < TERMINAL_ORDER_FROM).reduce((m, s) => Math.max(m, s.sort_order), 0);
	return {
		key: newKey('status'),
		id: null,
		code: makeCode(name, draft.statuses.map((s) => s.code)),
		name,
		type: init.type ?? 'intermediate',
		color: init.color ?? null,
		sort_order: maxOrder + 10,
		required_fields: [],
		is_archived: false,
		archived_at: null,
		replaced_by_status_id: null
	};
}

export function newTransition(draft: GraphDraft, from: string, to: string): TransitionDraft {
	const target = statusByKey(draft, to);
	const siblings = draft.transitions.filter((t) => t.from === from);
	return {
		key: newKey('transition'),
		id: null,
		from,
		to,
		name: target ? `Перейти к статусу «${target.name}»` : 'Переход',
		allowed_roles: [],
		conditions: {},
		actions: [],
		requires_comment: false,
		sort_order: siblings.reduce((m, t) => Math.max(m, t.sort_order), 0) + 10
	};
}

/** Удаляет статус вместе с его переходами и SLA-правилами. */
export function removeStatus(draft: GraphDraft, key: string): GraphDraft {
	return {
		statuses: draft.statuses.filter((s) => s.key !== key),
		transitions: draft.transitions.filter((t) => t.from !== key && t.to !== key),
		sla_rules: draft.sla_rules.filter((r) => r.status !== key)
	};
}

/** Порядок шагов 10, 20, 30… по списку; остальные статусы (завершающие, архивные) не трогаются. */
function renumberSteps(draft: GraphDraft, ordered: readonly StatusDraft[]): GraphDraft {
	const order = new Map(ordered.map((s, i) => [s.key, (i + 1) * 10] as const));
	return { ...draft, statuses: draft.statuses.map((s) => (order.has(s.key) ? { ...s, sort_order: order.get(s.key)! } : s)) };
}

/**
 * Сдвиг шага на одну позицию (−1 выше, +1 ниже). Начальный шаг остаётся первым: он не двигается, и никто не встаёт выше него.
 * Порядок шагов перенумеровывается 10, 20, 30…; завершающие статусы (1000 и больше) не трогаются.
 */
export function moveStep(draft: GraphDraft, key: string, delta: -1 | 1): GraphDraft {
	const steps = stepsOf(draft);
	const i = steps.findIndex((s) => s.key === key);
	const j = i + delta;
	if (i < 0 || j < 0 || j >= steps.length || steps[i].type === 'initial' || steps[j].type === 'initial') return draft;
	const next = [...steps];
	[next[i], next[j]] = [next[j], next[i]];
	return renumberSteps(draft, next);
}

const hasTransition = (draft: GraphDraft, from: string, to: string): boolean => draft.transitions.some((t) => t.from === from && t.to === to);

/**
 * Новый шаг после указанного, с переходами вперёд и назад. `required` (по умолчанию да): прямой переход «после → следующий» заменяется
 * путём через новый шаг; `required: false` оставляет прямой переход (новый шаг можно пропустить). После последнего шага — только пара «после ↔ новый».
 */
export function insertStepAfter(draft: GraphDraft, afterKey: string, init: { name?: string; required?: boolean } = {}): { draft: GraphDraft; key: string } {
	const steps = stepsOf(draft);
	const i = steps.findIndex((s) => s.key === afterKey);
	if (i < 0) return { draft, key: '' };
	const created = newStatus(draft, { name: init.name, type: 'intermediate' });
	const next = steps[i + 1];
	const ordered = [...steps.slice(0, i + 1), created, ...steps.slice(i + 1)];
	let result: GraphDraft = renumberSteps({ ...draft, statuses: [...draft.statuses, created] }, ordered);
	const add = (from: string, to: string, name?: string) => {
		if (hasTransition(result, from, to)) return;
		const t = newTransition(result, from, to);
		result = { ...result, transitions: [...result.transitions, name ? { ...t, name } : t] };
	};
	add(afterKey, created.key);
	add(created.key, afterKey, `Назад: ${steps[i].name}`);
	if (next) {
		add(created.key, next.key);
		add(next.key, created.key, `Назад: ${created.name}`);
		if (init.required ?? true) result = { ...result, transitions: result.transitions.filter((t) => !(t.from === afterKey && t.to === next.key)) };
	}
	return { draft: result, key: created.key };
}

/** Шаг необязателен, если есть переход с предыдущего шага сразу на следующий. */
export function isOptionalStep(draft: GraphDraft, key: string): boolean {
	const steps = stepsOf(draft);
	const i = steps.findIndex((s) => s.key === key);
	return i > 0 && i < steps.length - 1 && hasTransition(draft, steps[i - 1].key, steps[i + 1].key);
}

/**
 * Необязательность шага = переход с предыдущего шага на следующий («Пропустить: имя»). Включение дважды не дублирует переход,
 * выключение удаляет его; у первого и последнего шага (нет соседа) ничего не меняется.
 */
export function setOptional(draft: GraphDraft, key: string, optional: boolean): GraphDraft {
	const steps = stepsOf(draft);
	const i = steps.findIndex((s) => s.key === key);
	if (i <= 0 || i >= steps.length - 1) return draft;
	const [prev, next] = [steps[i - 1], steps[i + 1]];
	if (!optional) return { ...draft, transitions: draft.transitions.filter((t) => !(t.from === prev.key && t.to === next.key)) };
	if (hasTransition(draft, prev.key, next.key)) return draft;
	return { ...draft, transitions: [...draft.transitions, { ...newTransition(draft, prev.key, next.key), name: `Пропустить: ${steps[i].name}` }] };
}

export function slaOf(draft: GraphDraft, statusKey: string): SlaDraft | null {
	return draft.sla_rules.find((r) => r.status === statusKey && r.is_active) ?? draft.sla_rules.find((r) => r.status === statusKey) ?? null;
}

// --- xyflow ----------------------------------------------------------------------------

export const STATUS_NODE_TYPE = 'status';
export const TRANSITION_EDGE_TYPE = 'transition';

export type StatusNodeData = {
	status: StatusDraft;
	sla: SlaDraft | null;
	issues: GraphIssue[];
	readonly: boolean;
	/** есть переходы в отказ / в заморозку: значки на узле (сами рёбра этих слоёв по умолчанию скрыты) */
	exits: { lost: boolean; parked: boolean };
	/** у статуса «Отказ» / «Заморозка» — сколько переходов в него ведёт (счётчик «Входов: N»); у остальных 0 */
	entries: number;
};
export type StatusNode = Node<StatusNodeData, typeof STATUS_NODE_TYPE>;

export type TransitionEdgeData = {
	transition: TransitionDraft;
	issues: GraphIssue[];
	hasConditions: boolean;
	hasActions: boolean;
	requiresComment: boolean;
	restricted: boolean;
	/** много рёбер: подпись показывается только у выбранного / наведённого */
	compact: boolean;
	/** выбрать переход в редакторе (клик по подписи: HTML-подпись не вызывает `onedgeclick` холста) */
	select?: () => void;
};
export type TransitionEdge = Edge<TransitionEdgeData, typeof TRANSITION_EDGE_TYPE>;

export interface Point {
	x: number;
	y: number;
}
export type Positions = Record<string, Point>;

/**
 * Слой ребра на холсте. `main` — в следующий шаг по `sort_order` или в успех; `skip` — вперёд, но не в соседний шаг (необязательный шаг);
 * `back` — назад; `exit` — в отказ или заморозку; `resume` — из заморозки обратно в шаг. Переход, который правила не узнали, — `main`.
 */
export const EDGE_LAYERS = ['main', 'skip', 'back', 'exit', 'resume'] as const;
export type EdgeLayer = (typeof EDGE_LAYERS)[number];

/** Слой перехода по графу; архивные и неизвестные статусы не ломают классификацию (такой переход — `main`). */
export function edgeLayerOf(draft: GraphDraft): (t: Pick<TransitionDraft, 'from' | 'to'>) => EdgeLayer {
	const steps = draft.statuses.filter((s) => !s.is_archived && (s.type === 'initial' || s.type === 'intermediate')).sort((a, b) => a.sort_order - b.sort_order);
	const index = new Map(steps.map((s, i) => [s.key, i] as const));
	const type = new Map(draft.statuses.filter((s) => !s.is_archived).map((s) => [s.key, s.type] as const));
	return (t) => {
		const from = type.get(t.from);
		const to = type.get(t.to);
		if (!from || !to || to === 'won') return 'main';
		if (to === 'lost' || to === 'parked') return 'exit';
		if (from === 'parked') return 'resume';
		const a = index.get(t.from);
		const b = index.get(t.to);
		if (a === undefined || b === undefined) return 'main';
		return b === a + 1 ? 'main' : b > a ? 'skip' : 'back';
	};
}

export const edgeLayer = (draft: GraphDraft, transition: Pick<TransitionDraft, 'from' | 'to'>): EdgeLayer => edgeLayerOf(draft)(transition);

/** Сколько рёбер в каждом слое (живые статусы). */
export function layerCounts(draft: GraphDraft): Record<EdgeLayer, number> {
	const layer = edgeLayerOf(draft);
	const live = new Set(draft.statuses.filter((s) => !s.is_archived).map((s) => s.key));
	const counts: Record<EdgeLayer, number> = { main: 0, skip: 0, back: 0, exit: 0, resume: 0 };
	for (const t of draft.transitions) if (live.has(t.from) && live.has(t.to)) counts[layer(t)] += 1;
	return counts;
}

/** Рёбер больше этого числа — по умолчанию показан основной путь и пропуски, остальные слои включаются переключателями. */
export const LAYERS_DENSE_ABOVE = 16;

/** Слои по умолчанию: небольшая воронка — все, плотная — основной путь и «через шаг». */
export const defaultLayers = (transitionCount: number): ReadonlySet<EdgeLayer> => new Set<EdgeLayer>(transitionCount > LAYERS_DENSE_ABOVE ? ['main', 'skip'] : EDGE_LAYERS);

export interface ToFlowOptions {
	/** показанные слои; без параметра — все рёбра. Скрыты рёбра остальных слоёв, кроме рёбер с ошибкой проверки, несохранённых и закреплённых. */
	layers?: ReadonlySet<EdgeLayer>;
	/** рёбра, которые показываются всегда: переходы выбранного статуса, выбранный переход, отмеченные замечанием */
	pinned?: ReadonlySet<string>;
	readonly?: boolean;
	/** Показывать ли архивные статусы (по умолчанию да — как история, полупрозрачно). */
	includeArchived?: boolean;
	compactLabels?: boolean;
}

const isEmptyObject = (v: unknown): boolean => v == null || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

export function toFlow(draft: GraphDraft, positions: Positions, issues: GraphIssue[] = [], options: ToFlowOptions = {}): { nodes: StatusNode[]; edges: TransitionEdge[]; total: number } {
	const includeArchived = options.includeArchived ?? true;
	const readonly = options.readonly ?? false;
	const statuses = draft.statuses.filter((s) => includeArchived || !s.is_archived);
	const visible = new Set(statuses.map((s) => s.key));
	const byStatus = new Map<string, GraphIssue[]>();
	const byTransition = new Map<string, GraphIssue[]>();
	for (const issue of issues) {
		for (const k of issue.statusKeys) byStatus.set(k, [...(byStatus.get(k) ?? []), issue]);
		for (const k of issue.transitionKeys) byTransition.set(k, [...(byTransition.get(k) ?? []), issue]);
	}
	const typeOf = new Map(statuses.map((s) => [s.key, s.type] as const));
	const exits = new Map<string, { lost: boolean; parked: boolean }>();
	const entries = new Map<string, number>();
	for (const t of draft.transitions) {
		if (!visible.has(t.from) || !visible.has(t.to)) continue;
		const to = typeOf.get(t.to);
		if (to === 'lost' || to === 'parked') {
			exits.set(t.from, { lost: false, parked: false, ...exits.get(t.from), [to]: true });
			entries.set(t.to, (entries.get(t.to) ?? 0) + 1);
		}
	}
	const nodes: StatusNode[] = statuses.map((status) => ({
		id: status.key,
		type: STATUS_NODE_TYPE,
		position: positions[status.key] ?? { x: 0, y: 0 },
		draggable: !readonly && !status.is_archived,
		connectable: !readonly && !status.is_archived,
		deletable: false,
		data: { status, sla: slaOf(draft, status.key), issues: byStatus.get(status.key) ?? [], readonly, exits: exits.get(status.key) ?? { lost: false, parked: false }, entries: status.type === 'lost' || status.type === 'parked' ? (entries.get(status.key) ?? 0) : 0 }
	}));
	const layerOf = edgeLayerOf(draft);
	const onScreen = draft.transitions.filter((t) => visible.has(t.from) && visible.has(t.to));
	const shown = onScreen.filter((t) => {
		if (!options.layers || options.layers.has(layerOf(t))) return true;
		// скрытый слой не прячет ошибку; новое, ещё не сохранённое ребро появляется сразу
		return t.id === null || options.pinned?.has(t.key) || (byTransition.get(t.key) ?? []).some((i) => i.severity === 'error');
	});
	const edges: TransitionEdge[] = shown
		.map((transition) => ({
			id: transition.key,
			type: TRANSITION_EDGE_TYPE,
			source: transition.from,
			target: transition.to,
			...(positions[transition.from] && positions[transition.to]
				? (() => {
						const sides = edgeSides(positions[transition.from], positions[transition.to]);
						return { sourceHandle: `s-${sides.source}`, targetHandle: `t-${sides.target}` };
					})()
				: {}),
			deletable: false,
			data: {
				transition,
				issues: byTransition.get(transition.key) ?? [],
				hasConditions: !isEmptyObject(transition.conditions),
				hasActions: (transition.actions?.length ?? 0) > 0,
				requiresComment: transition.requires_comment,
				restricted: transition.allowed_roles.length > 0,
				compact: options.compactLabels ?? false
			}
		}));
	return { nodes, edges, total: onScreen.length };
}

/** Размер узла на холсте (ширина `w-58`); по нему считается раскладка. */
export const NODE_WIDTH = 232;

/** Сторона узла, с которой выходит / в которую входит ребро: по взаимному положению узлов (соседи в ряду — справа налево, ряды — сверху вниз). */
export function edgeSides(from: Point, to: Point): { source: 'r' | 'l' | 'b' | 't'; target: 'r' | 'l' | 'b' | 't' } {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (Math.abs(dy) > 40 && Math.abs(dy) > Math.abs(dx) * 0.6) return dy > 0 ? { source: 'b', target: 't' } : { source: 't', target: 'b' };
	return dx >= 0 ? { source: 'r', target: 'l' } : { source: 'l', target: 'r' };
}

export interface SnakeOptions {
	/** узлов в ряду (по умолчанию 3) */
	columns?: number;
	colGap?: number;
	rowGap?: number;
}

/**
 * Раскладка «змейкой» для длинной воронки: шаги по порядку рядами по 3 узла, чётные ряды идут справа налево, поэтому переход со
 * следующего шага — всегда соседний узел или узел прямо под ним. Завершающие статусы — отдельный ряд под шагами, архивные и
 * остальные — ещё ниже.
 */
export function layoutSnake(draft: GraphDraft, options: SnakeOptions = {}): Positions {
	const columns = options.columns ?? 3;
	const colGap = options.colGap ?? NODE_WIDTH + 52;
	const rowGap = options.rowGap ?? 124;
	const steps = stepsOf(draft);
	const stepKeys = new Set(steps.map((s) => s.key));
	const rest = draft.statuses.filter((s) => !stepKeys.has(s.key));
	const terminals = rest.filter((s) => !s.is_archived && TERMINAL_TYPES.has(s.type)).sort((a, b) => a.sort_order - b.sort_order);
	const others = rest.filter((s) => !terminals.includes(s)).sort((a, b) => a.sort_order - b.sort_order);
	const positions: Positions = {};
	steps.forEach((s, i) => {
		const row = Math.floor(i / columns);
		const col = i % columns;
		positions[s.key] = { x: (row % 2 === 0 ? col : columns - 1 - col) * colGap, y: row * rowGap };
	});
	const rows = Math.ceil(steps.length / columns);
	const place = (list: StatusDraft[], row: number) =>
		list.forEach((s, i) => {
			positions[s.key] = { x: (i % columns) * colGap, y: (row + Math.floor(i / columns)) * rowGap + (row > rows - 1 ? 24 : 0) };
		});
	place(terminals, rows);
	place(others, rows + Math.ceil(terminals.length / columns));
	return positions;
}

/** Автораскладка: длинная воронка (больше 8 шагов) — «змейкой» по порядку шагов, короткая — по уровням обхода. */
export function autoLayout(draft: GraphDraft): Positions {
	return stepsOf(draft).length > 8 ? layoutSnake(draft) : layoutByLevels(draft);
}

export function positionsFromNodes(nodes: readonly Pick<Node, 'id' | 'position'>[]): Positions {
	return Object.fromEntries(nodes.map((n) => [n.id, { x: Math.round(n.position.x), y: Math.round(n.position.y) }]));
}

export interface LayoutOptions {
	colGap?: number;
	rowGap?: number;
	/** столбцов в строке, дальше перенос на следующую строку (по умолчанию 4) */
	maxColumns?: number;
}

/**
 * Автораскладка слева направо по уровням BFS от начального статуса.
 * Завершающие статусы — в последнем столбце, недостижимые — в столбце перед ними, архивные — правее всех.
 */
export function layoutByLevels(draft: GraphDraft, options: LayoutOptions = {}): Positions {
	const colGap = options.colGap ?? 340;
	const rowGap = options.rowGap ?? 120;
	const live = draft.statuses.filter((s) => !s.is_archived);
	const archived = draft.statuses.filter((s) => s.is_archived);
	const liveKeys = new Set(live.map((s) => s.key));
	const isTerminal = (s: StatusDraft): boolean => TERMINAL_TYPES.has(s.type);

	const forward = new Map<string, string[]>();
	for (const t of draft.transitions) {
		if (!liveKeys.has(t.from) || !liveKeys.has(t.to)) continue;
		forward.set(t.from, [...(forward.get(t.from) ?? []), t.to]);
	}

	const sorted = [...live].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'ru'));
	const initials = sorted.filter((s) => s.type === 'initial');
	const roots = initials.length ? initials : sorted.filter((s) => !isTerminal(s)).slice(0, 1);

	const level = new Map<string, number>();
	const queue: string[] = [];
	for (const r of roots) {
		level.set(r.key, 0);
		queue.push(r.key);
	}
	while (queue.length) {
		const current = queue.shift() as string;
		const status = statusByKey(draft, current);
		if (!status || isTerminal(status)) continue;
		for (const next of forward.get(current) ?? []) {
			if (level.has(next)) continue;
			const target = statusByKey(draft, next);
			if (!target || isTerminal(target)) continue;
			level.set(next, (level.get(current) ?? 0) + 1);
			queue.push(next);
		}
	}

	const reachedMax = Math.max(0, ...[...level.values()]);
	const unreachable = sorted.filter((s) => !isTerminal(s) && !level.has(s.key));
	const unreachableLevel = reachedMax + 1;
	for (const s of unreachable) level.set(s.key, unreachableLevel);
	const terminalLevel = unreachable.length ? unreachableLevel + 1 : reachedMax + 1;
	for (const s of sorted.filter(isTerminal)) level.set(s.key, terminalLevel);
	for (const s of archived) level.set(s.key, terminalLevel + 1);

	const columns = new Map<number, StatusDraft[]>();
	for (const s of [...sorted, ...archived]) {
		const l = level.get(s.key) ?? 0;
		columns.set(l, [...(columns.get(l) ?? []), s]);
	}
	// Длинная цепочка не растягивается в одну строку: после `maxColumns` столбцов раскладка переходит на новую строку.
	const maxColumns = options.maxColumns ?? 4;
	const levelList = [...columns.keys()].sort((a, b) => a - b);
	const rows = Math.ceil(levelList.length / maxColumns);
	const positions: Positions = {};
	let top = 0;
	for (let r = 0; r < rows; r++) {
		const rowLevels = levelList.slice(r * maxColumns, (r + 1) * maxColumns);
		const tallest = Math.max(1, ...rowLevels.map((l) => columns.get(l)?.length ?? 0));
		const middle = rows > 1 ? top + ((tallest - 1) / 2) * rowGap : 0;
		rowLevels.forEach((l, col) => {
			const column = columns.get(l) ?? [];
			column.forEach((s, i) => {
				positions[s.key] = { x: col * colGap, y: Math.round(middle + (i - (column.length - 1) / 2) * rowGap) };
			});
		});
		top += tallest * rowGap + (r < rows - 1 ? rowGap * 0.7 : 0);
	}
	return positions;
}
