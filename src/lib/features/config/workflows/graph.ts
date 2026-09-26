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

export function newStatus(draft: GraphDraft, init: Partial<Pick<StatusDraft, 'name' | 'type' | 'color'>> = {}): StatusDraft {
	const name = init.name?.trim() || 'Новый статус';
	const maxOrder = draft.statuses.reduce((m, s) => Math.max(m, s.sort_order), 0);
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

export interface ToFlowOptions {
	readonly?: boolean;
	/** Показывать ли архивные статусы (по умолчанию да — как история, полупрозрачно). */
	includeArchived?: boolean;
	compactLabels?: boolean;
}

const isEmptyObject = (v: unknown): boolean => v == null || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0);

export function toFlow(draft: GraphDraft, positions: Positions, issues: GraphIssue[] = [], options: ToFlowOptions = {}): { nodes: StatusNode[]; edges: TransitionEdge[] } {
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
	const nodes: StatusNode[] = statuses.map((status) => ({
		id: status.key,
		type: STATUS_NODE_TYPE,
		position: positions[status.key] ?? { x: 0, y: 0 },
		draggable: !readonly && !status.is_archived,
		connectable: !readonly && !status.is_archived,
		deletable: false,
		data: { status, sla: slaOf(draft, status.key), issues: byStatus.get(status.key) ?? [], readonly }
	}));
	const edges: TransitionEdge[] = draft.transitions
		.filter((t) => visible.has(t.from) && visible.has(t.to))
		.map((transition) => ({
			id: transition.key,
			type: TRANSITION_EDGE_TYPE,
			source: transition.from,
			target: transition.to,
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
	return { nodes, edges };
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
