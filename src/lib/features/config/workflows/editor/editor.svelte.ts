// Состояние редактора воронки: серверный граф → черновик, правки, проблемы, сохранение / проверка / публикация.
// Позиции узлов бэкенд не хранит — они лежат в localStorage по id воронки.
import { api, unwrap, ifMatch, ApiError } from '$lib/api';
import { session } from '$lib/auth/session.svelte';
import { toast } from '$lib/ui';
import { workflows } from '../../../crm/deals/workflows.svelte';
import type { CustomFieldDef, Workflow, WorkflowGraph } from '../../types';
import { fieldCatalogue, type FieldDef } from '../dsl';
import {
	defaultLayers,
	fromServer,
	insertStepAfter as insertStepIn,
	autoLayout as autoLayoutOf,
	moveStep as moveStepIn,
	setOptional as setOptionalIn,
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
	type EdgeLayer,
	type SlaDraft,
	type StatusDraft,
	type TransitionDraft
} from '../graph';
import { hasErrors, mergeIssues, parseServerIssues, validateGraph } from '../validation';
import { normalizeStatusName, statusNameError } from '../statusName';

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
	focus = $state<{ keys: string[]; n: number } | null>(null);
	#focusN = 0;
	/** какие слои рёбер показаны на холсте (по умолчанию — по числу переходов, см. `defaultLayers`); рёбра с ошибкой и новые видны всегда */
	layers = $state.raw<ReadonlySet<EdgeLayer>>(new Set());
	#layersTouched = false;
	/** узлы и рёбра, отмеченные замечанием, которое касается нескольких сразу (клик в списке проблем): подсвечены все */
	marked = $state.raw<ReadonlySet<string>>(new Set());
	#posTimer: ReturnType<typeof setTimeout> | undefined;

	readonly = $derived(this.workflow?.state === 'archived' || !session.can('workflow:write'));
	/** нет права править воронку, но есть право переименовывать шаги (Руководитель): открыто только поле «Название» шага */
	renameOnly = $derived(this.workflow?.state !== 'archived' && !session.can('workflow:write') && session.can('workflow:rename_status'));
	clientIssues = $derived(validateGraph(this.draft));
	issues = $derived(mergeIssues(this.clientIssues, this.serverIssues));
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
		const auto = autoLayoutOf(draft);
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
		if (!this.#layersTouched) this.layers = defaultLayers(draft.transitions.length);
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
		if (this.marked.size) this.marked = new Set();
	}

	/**
	 * Сервер отказал убрать переход, которым уже пользовались (CRM-1209): возвращаем в черновик переходы, что есть на сервере и пропали у нас
	 * (переключатель «Необязательный шаг» снова включён); остальные правки остаются.
	 */
	private async restoreRemovedTransitions(): Promise<void> {
		try {
			const graph = await unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: this.id } } }));
			const have = new Set(this.draft.transitions.map((t) => t.id).filter(Boolean));
			const back = fromServer(graph as ServerGraph).transitions.filter((t) => !have.has(t.id));
			if (back.length) this.commit({ ...this.draft, transitions: [...this.draft.transitions, ...back] });
		} catch {
			// без ответа сервера черновик остаётся как есть: «Вернуть сохранённую версию» в меню вернёт всё
		}
	}

	/** Сдвинуть шаг выше (−1) или ниже (+1): порядок перенумеровывается 10, 20, 30… */
	moveStep(key: string, delta: -1 | 1): void {
		const next = moveStepIn(this.draft, key, delta);
		if (next !== this.draft) this.commit(next);
	}

	/** Новый шаг после указанного (с переходами вперёд и назад); холст ставит его рядом с предыдущим. */
	insertStepAfter(afterKey: string, init: { name?: string; required?: boolean } = {}): string | null {
		const at = this.positions[afterKey] ?? { x: 0, y: 0 };
		const { draft, key } = insertStepIn(this.draft, afterKey, init);
		if (!key) return null;
		this.commit(draft);
		this.positions = { ...this.positions, [key]: { x: at.x + 60, y: at.y + 90 } };
		this.persistPositions();
		this.selection = { kind: 'status', key };
		return key;
	}

	/** Необязательный шаг: переход «Пропустить: …» с предыдущего шага на следующий (включить / выключить). */
	setOptional(key: string, optional: boolean): void {
		const next = setOptionalIn(this.draft, key, optional);
		if (next !== this.draft) this.commit(next);
	}

	/** Включить / выключить слои рёбер вместе («Отказ и заморозка» = отказ + возобновление). */
	toggleLayers(group: readonly EdgeLayer[]): void {
		this.#layersTouched = true;
		const next = new Set(this.layers);
		const allOn = group.every((l) => next.has(l));
		for (const l of group) {
			if (allOn) next.delete(l);
			else next.add(l);
		}
		this.layers = next;
	}

	/** Показать все слои, а если все уже показаны — вернуть слои по умолчанию. */
	toggleAllLayers(): void {
		this.#layersTouched = true;
		const all: readonly EdgeLayer[] = ['main', 'skip', 'back', 'exit', 'resume'];
		this.layers = all.every((l) => this.layers.has(l)) ? defaultLayers(this.draft.transitions.length) : new Set(all);
	}

	showOnCanvas(key: string): void {
		this.focus = { keys: key ? [key] : [], n: ++this.#focusN };
	}

	/** Показать на холсте сразу несколько узлов / рёбер и подсветить их все. */
	markOnCanvas(keys: readonly string[]): void {
		this.marked = new Set(keys);
		this.focus = { keys: [...keys], n: ++this.#focusN };
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
			: { key: newKey('sla'), status: statusKey, max_duration_hours: 72, warn_threshold_pct: 80, escalate_threshold_pct: 150, escalate_to_role: null, escalate_to_user_id: null, channels: ['in_app'], count_business_days: true, is_active: true, ...patch };
		this.commit({ ...this.draft, sla_rules: [...others, next] });
	}

	setPosition(key: string, point: Point): void {
		this.positions = { ...this.positions, [key]: { x: Math.round(point.x), y: Math.round(point.y) } };
		clearTimeout(this.#posTimer);
		this.#posTimer = setTimeout(() => this.persistPositions(), 400);
	}

	autoLayout(): void {
		this.positions = autoLayoutOf(this.draft);
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
			if (e instanceof ApiError && e.code === 'CRM-1209') {
				toast.warning('Переход нельзя убрать', 'Этот переход уже встречается в истории сделок');
				await this.restoreRemovedTransitions();
			}
			else if (e instanceof ApiError && e.isConflict) this.conflict = true;
			else toast.error(e, 'Не удалось сохранить черновик');
			return false;
		} finally {
			this.saving = false;
		}
	}

	/**
	 * Переименовать сохранённый шаг одной ручкой (граф, переходы и SLA не затрагиваются): новое имя сразу у всех сделок воронки.
	 * Версия воронки растёт, поэтому граф перечитывается; общий кэш названий карточек сделок обновляется тоже.
	 */
	async renameStatus(key: string, raw: string): Promise<boolean> {
		const status = this.draft.statuses.find((s) => s.key === key);
		const error = statusNameError(raw);
		if (!this.workflow || !status?.id || error) return false;
		this.saving = true;
		this.conflict = false;
		try {
			await unwrap(
				api.PATCH('/api/workflows/{workflow_id}/statuses/{status_id}', {
					params: { path: { workflow_id: this.id, status_id: status.id } },
					headers: ifMatch(this.workflow.version),
					body: { name: normalizeStatusName(raw) }
				})
			);
			// граф перечитываем сами, чтобы шаг остался выбранным и панель не закрылась
			const previous = { draft: this.draft, positions: this.positions, selection: this.selection };
			const [graph] = await Promise.all([unwrap(api.GET('/api/workflows/{workflow_id}', { params: { path: { workflow_id: this.id } } })), workflows.reload(this.id).catch(() => undefined)]);
			this.apply(graph, previous);
			toast.success('Название сохранено', 'Оно изменилось у всех сделок воронки');
			return true;
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) this.conflict = true;
			else toast.error(e, 'Не удалось сохранить название');
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
			this.serverIssues = parseServerIssues(res, this.draft, this.clientIssues);
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
