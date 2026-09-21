// Состояние редактора воронки: серверный граф → черновик, правки, проблемы, сохранение / проверка / публикация.
// Позиции узлов бэкенд не хранит — они лежат в localStorage по id воронки.
import { api, unwrap, ifMatch, ApiError } from '$lib/api';
import { session } from '$lib/auth/session.svelte';
import { toast } from '$lib/ui';
import type { CustomFieldDef, Workflow, WorkflowGraph } from '../../types';
import { fieldCatalogue, type FieldDef } from '../dsl';
import {
	fromServer,
	layoutByLevels,
	newKey,
	newStatus,
	newTransition,
	removeStatus as dropStatus,
	toServer,
	type GraphDraft,
	type GraphIssue,
	type Point,
	type Positions,
	type ServerGraph,
	type SlaDraft,
	type StatusDraft,
	type TransitionDraft
} from '../graph';
import { hasErrors, parseServerIssues, validateGraph } from '../validation';

export type Selection = { kind: 'status' | 'transition'; key: string };

const POS_KEY = (id: string) => `rtk.wf.pos.${id}`;

function readPositions(id: string): Positions {
	try {
		const raw = localStorage.getItem(POS_KEY(id));
		return raw ? (JSON.parse(raw) as Positions) : {};
	} catch {
		return {};
	}
}

const payloadKey = (draft: GraphDraft): string => JSON.stringify(toServer(draft));

export class WorkflowEditor {
	readonly id: string;
	workflow = $state<Workflow | null>(null);
	draft = $state.raw<GraphDraft>({ statuses: [], transitions: [], sla_rules: [] });
	positions = $state.raw<Positions>({});
	#baseline = $state('');
	loading = $state(true);
	error = $state<unknown>(null);
	saving = $state(false);
	publishing = $state(false);
	validating = $state(false);
	/** 409 при сохранении/публикации: воронку изменил другой пользователь */
	conflict = $state(false);
	selection = $state<Selection | null>(null);
	serverIssues = $state.raw<GraphIssue[]>([]);
	customFields = $state.raw<CustomFieldDef[]>([]);
	/** запрос «показать узел / ребро на холсте» (клик по проблеме); `n` меняется на каждый запрос */
	focus = $state<{ key: string; n: number } | null>(null);
	#focusN = 0;
	#posTimer: ReturnType<typeof setTimeout> | undefined;

	readonly = $derived(this.workflow?.state === 'archived' || !session.can('workflow:write'));
	clientIssues = $derived(validateGraph(this.draft));
	issues = $derived([...this.clientIssues, ...this.serverIssues]);
	errorCount = $derived(this.issues.filter((i) => i.severity === 'error').length);
	warningCount = $derived(this.issues.filter((i) => i.severity === 'warning').length);
	dirty = $derived(payloadKey(this.draft) !== this.#baseline);
	catalogue = $derived<FieldDef[]>(fieldCatalogue(this.customFields.filter((f) => f.is_active && (!f.workflow_id || f.workflow_id === this.id))));
	liveStatuses = $derived(this.draft.statuses.filter((s) => !s.is_archived));
	selectedStatus = $derived(this.selection?.kind === 'status' ? (this.draft.statuses.find((s) => s.key === this.selection?.key) ?? null) : null);
	selectedTransition = $derived(this.selection?.kind === 'transition' ? (this.draft.transitions.find((t) => t.key === this.selection?.key) ?? null) : null);

	constructor(id: string) {
		this.id = id;
	}

	statusName = (key: string): string => this.draft.statuses.find((s) => s.key === key)?.name ?? '—';

	// --- загрузка ----------------------------------------------------------------

	async load(silent = false): Promise<void> {
		if (!silent) this.loading = true;
		this.error = null;
		try {
			const graph = await unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: this.id } } }));
			this.apply(graph);
			void this.loadFields();
		} catch (e) {
			this.error = e;
		} finally {
			this.loading = false;
		}
	}

	async loadFields(): Promise<void> {
		try {
			const res = await unwrap(api.GET('/api/custom-field-defs', { params: { query: { entity_type: 'deal' } } }));
			this.customFields = res.items;
		} catch {
			// каталог полей — подсказка; без него условия всё равно можно вводить по коду
		}
	}

	/** Принимает граф с сервера. `previous` — черновик до сохранения: позиции новых статусов переносим по коду. */
	private apply(graph: WorkflowGraph, previous?: { draft: GraphDraft; positions: Positions; selection: Selection | null }): void {
		this.workflow = graph.workflow;
		const draft = fromServer(graph as ServerGraph);
		const auto = layoutByLevels(draft);
		const stored = previous ? {} : readPositions(this.id);
		const oldKeyByCode = new Map(previous?.draft.statuses.map((s) => [s.code, s.key]) ?? []);
		const positions: Positions = {};
		for (const s of draft.statuses) {
			const old = previous ? previous.positions[oldKeyByCode.get(s.code) ?? s.key] : undefined;
			positions[s.key] = old ?? stored[s.key] ?? auto[s.key] ?? { x: 0, y: 0 };
		}
		// выбор после сохранения: тот же статус / переход по коду и паре статусов
		let selection: Selection | null = null;
		if (previous?.selection) {
			const prev = previous.selection;
			if (prev.kind === 'status') {
				const code = previous.draft.statuses.find((s) => s.key === prev.key)?.code;
				const now = draft.statuses.find((s) => s.code === code);
				if (now) selection = { kind: 'status', key: now.key };
			} else {
				const t = previous.draft.transitions.find((x) => x.key === prev.key);
				const from = t && previous.draft.statuses.find((s) => s.key === t.from)?.code;
				const to = t && previous.draft.statuses.find((s) => s.key === t.to)?.code;
				const now = draft.transitions.find((x) => draft.statuses.find((s) => s.key === x.from)?.code === from && draft.statuses.find((s) => s.key === x.to)?.code === to);
				if (now) selection = { kind: 'transition', key: now.key };
			}
		}
		this.draft = draft;
		this.positions = positions;
		this.#baseline = payloadKey(draft);
		this.serverIssues = [];
		this.selection = selection;
		this.persistPositions();
	}

	// --- правки ------------------------------------------------------------------------

	private commit(next: GraphDraft): void {
		this.draft = next;
		if (this.serverIssues.length) this.serverIssues = [];
	}

	select(selection: Selection | null): void {
		this.selection = selection;
	}

	showOnCanvas(key: string): void {
		this.focus = { key, n: ++this.#focusN };
	}

	addStatus(init: Partial<Pick<StatusDraft, 'name' | 'type' | 'color'>> = {}, near?: Point): StatusDraft {
		const status = newStatus(this.draft, init);
		const xs = Object.values(this.positions).map((p) => p.x);
		const at = near ?? { x: (xs.length ? Math.max(...xs) : -280) + 280, y: 0 };
		this.commit({ ...this.draft, statuses: [...this.draft.statuses, status] });
		this.positions = { ...this.positions, [status.key]: at };
		this.persistPositions();
		this.selection = { kind: 'status', key: status.key };
		return status;
	}

	/** Типовая заготовка для пустой воронки: Новая → В работе → Успех / Отказ. */
	applyStarter(): void {
		if (this.draft.statuses.length) return;
		const a = this.addStatus({ name: 'Новая', type: 'initial' }, { x: 0, y: 0 });
		const b = this.addStatus({ name: 'В работе', type: 'intermediate' }, { x: 280, y: 0 });
		const won = this.addStatus({ name: 'Успех', type: 'won' }, { x: 560, y: -70 });
		const lost = this.addStatus({ name: 'Отказ', type: 'lost' }, { x: 560, y: 70 });
		for (const [from, to, name] of [
			[a, b, 'Взять в работу'],
			[b, won, 'Закрыть успешно'],
			[b, lost, 'Закрыть с отказом'],
			[a, lost, 'Отказ на входе']
		] as const) {
			const t = this.addTransition(from.key, to.key);
			if (t) this.updateTransition(t.key, { name });
		}
		this.selection = null;
		this.showOnCanvas('');
	}

	updateStatus(key: string, patch: Partial<StatusDraft>): void {
		this.commit({ ...this.draft, statuses: this.draft.statuses.map((s) => (s.key === key ? { ...s, ...patch } : s)) });
	}

	removeStatus(key: string): void {
		this.commit(dropStatus(this.draft, key));
		const { [key]: _gone, ...rest } = this.positions;
		void _gone;
		this.positions = rest;
		if (this.selection?.key === key) this.selection = null;
		this.persistPositions();
	}

	/** null — переход не создан (тот же статус, дубль пары или архивный статус). */
	addTransition(from: string, to: string): TransitionDraft | null {
		const a = this.draft.statuses.find((s) => s.key === from);
		const b = this.draft.statuses.find((s) => s.key === to);
		if (!a || !b || a.is_archived || b.is_archived || from === to) return null;
		const existing = this.draft.transitions.find((t) => t.from === from && t.to === to);
		if (existing) {
			this.selection = { kind: 'transition', key: existing.key };
			return null;
		}
		const transition = newTransition(this.draft, from, to);
		this.commit({ ...this.draft, transitions: [...this.draft.transitions, transition] });
		this.selection = { kind: 'transition', key: transition.key };
		return transition;
	}

	updateTransition(key: string, patch: Partial<TransitionDraft>): void {
		this.commit({ ...this.draft, transitions: this.draft.transitions.map((t) => (t.key === key ? { ...t, ...patch } : t)) });
	}

	removeTransition(key: string): void {
		this.commit({ ...this.draft, transitions: this.draft.transitions.filter((t) => t.key !== key) });
		if (this.selection?.key === key) this.selection = null;
	}

	/** `null` — убрать SLA-правило статуса. */
	setSla(statusKey: string, patch: Partial<SlaDraft> | null): void {
		const others = this.draft.sla_rules.filter((r) => r.status !== statusKey);
		if (patch === null) return this.commit({ ...this.draft, sla_rules: others });
		const current = this.draft.sla_rules.find((r) => r.status === statusKey);
		const next: SlaDraft = current
			? { ...current, ...patch }
			: { key: newKey('sla'), status: statusKey, max_duration_hours: 72, warn_threshold_pct: 80, escalate_to_role: null, escalate_to_user_id: null, channels: ['in_app'], count_business_days: true, is_active: true, ...patch };
		this.commit({ ...this.draft, sla_rules: [...others, next] });
	}

	setPosition(key: string, point: Point): void {
		this.positions = { ...this.positions, [key]: { x: Math.round(point.x), y: Math.round(point.y) } };
		clearTimeout(this.#posTimer);
		this.#posTimer = setTimeout(() => this.persistPositions(), 400);
	}

	autoLayout(): void {
		this.positions = layoutByLevels(this.draft);
		this.persistPositions();
		this.showOnCanvas(this.liveStatuses[0]?.key ?? '');
	}

	private persistPositions(): void {
		try {
			localStorage.setItem(POS_KEY(this.id), JSON.stringify(this.positions));
		} catch {
			// без localStorage раскладка просто не запоминается
		}
	}

	// --- сервер --------------------------------------------------------------------------

	async save(): Promise<boolean> {
		if (this.saving || !this.workflow || this.readonly) return false;
		this.saving = true;
		this.conflict = false;
		try {
			const previous = { draft: this.draft, positions: this.positions, selection: this.selection };
			const graph = await unwrap(
				api.PUT('/api/workflows/{workflow_id}/graph', { params: { path: { workflow_id: this.id } }, body: toServer(this.draft) as never, headers: ifMatch(this.workflow.version) })
			);
			this.apply(graph, previous);
			return true;
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) this.conflict = true;
			else toast.error(e, 'Не удалось сохранить черновик');
			return false;
		} finally {
			this.saving = false;
		}
	}

	/** Проверка сохранённого графа на сервере (пишет запись аудита — только по кнопке и перед публикацией). */
	async validateOnServer(): Promise<{ ok: boolean; warnings: string[] } | null> {
		this.validating = true;
		try {
			const res = await unwrap(api.POST('/api/workflows/{workflow_id}/validate', { params: { path: { workflow_id: this.id } } }));
			this.serverIssues = parseServerIssues(res.errors ?? [], res.warnings ?? [], this.draft);
			return { ok: res.ok, warnings: res.warnings ?? [] };
		} catch (e) {
			toast.error(e, 'Не удалось проверить воронку');
			return null;
		} finally {
			this.validating = false;
		}
	}

	async publish(): Promise<boolean> {
		if (!this.workflow) return false;
		this.publishing = true;
		this.conflict = false;
		try {
			const res = await unwrap(api.POST('/api/workflows/{workflow_id}/publish', { params: { path: { workflow_id: this.id } }, headers: ifMatch(this.workflow.version) }));
			this.workflow = res.workflow;
			toast.success('Воронка опубликована', `Версия графа ${res.graph_hash.slice(0, 8)}`);
			return true;
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) this.conflict = true;
			else toast.error(e, 'Не удалось опубликовать');
			return false;
		} finally {
			this.publishing = false;
		}
	}

	/** После 409: берём только актуальную версию воронки, правки пользователя остаются в черновике. */
	async adoptServerVersion(): Promise<void> {
		try {
			const graph = await unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: this.id } } }));
			this.workflow = graph.workflow;
			this.conflict = false;
			toast.info('Версия обновлена', 'Ваши правки остались в черновике — сохраните их ещё раз');
		} catch (e) {
			toast.error(e);
		}
	}

	get hasBlockingErrors(): boolean {
		return hasErrors(this.clientIssues);
	}
}
