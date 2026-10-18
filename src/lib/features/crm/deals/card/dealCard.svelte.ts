// Состояние карточки сделки: сама сделка, продукты, доступные переходы, граф воронки. Все мутации (правка, переназначение, переход)
// возвращают свежую сделку — её версия идёт в следующий `If-Match`, а конфликт версий (CRM-1002) поднимает баннер «Обновить».
import { api, ifMatch, unwrap } from '$lib/api';
import { coalesce } from '$lib/api/coalesce';
import { session } from '$lib/auth/session.svelte';
import { isWatcherOnly } from './access';
import type { AvailableTransition, Deal, DealHistory, DealProduct } from '../../types';
import { workflows } from '../workflows.svelte';

type DealUpdate = import('$lib/api').components['schemas']['DealUpdateRequest'];
type DealProductIn = import('$lib/api').components['schemas']['DealProductIn'];

export class DealCardState {
	readonly id: string;
	deal = $state<Deal | null>(null);
	products = $state<DealProduct[]>([]);
	/** счётчики карточки: устаревают до 10 минут (backend-issues A-6), вкладки уточняют их по своим данным */
	counts = $state({ comments: 0, tasks: 0 });
	transitions = $state<AvailableTransition[]>([]);
	/** the answer about transitions came (even an empty one): until then the header keeps the room of the main button */
	transitionsLoaded = $state(false);
	loading = $state(true);
	error = $state<unknown>(null);
	/** кто-то изменил сделку: показываем баннер с «Обновить» */
	conflict = $state(false);
	/** текущий пользователь — наблюдатель в этой сделке: сервер не даст ничего менять, поэтому кнопок нет */
	watcherOnly = $state(false);
	/** версия данных вкладок: растёт после переходов, чтобы история/обсуждение перечитались */
	epoch = $state(0);
	/** история статусов и событий: общая для ленты шагов и вкладки «История» (один запрос на обе) */
	history = $state<DealHistory | null>(null);
	historyLoading = $state(true);
	historyError = $state<unknown>(null);

	#seq = 0;
	#historySeq = 0;

	constructor(id: string) {
		this.id = id;
	}

	get graph() {
		return workflows.graph(this.deal?.workflow_id);
	}
	get status() {
		return workflows.status(this.deal?.status_id);
	}
	/** шаги, на которых сделка побывала (по истории) */
	get visited(): Set<string> {
		const ids = new Set<string>();
		for (const s of this.history?.statuses ?? []) {
			if (s.from_status_id) ids.add(s.from_status_id);
			ids.add(s.to_status_id);
		}
		return ids;
	}

	/** шаг, с которого сделка ушла в текущий терминальный статус (заморозка, отказ) */
	get stoppedAt(): string | null {
		const id = this.deal?.status_id;
		if (!id) return null;
		return (this.history?.statuses ?? []).filter((s) => s.to_status_id === id).sort((a, b) => a.changed_at.localeCompare(b.changed_at)).at(-1)?.from_status_id ?? null;
	}

	/** сделку переносили на другую воронку: шаги нового графа она не проходила, пропусков не показываем */
	get migrated(): boolean {
		return !!this.history && (this.history.events.some((e) => e.event_type === 'WORKFLOW_MIGRATION') || this.history.statuses.some((s) => s.reason === 'workflow_migration'));
	}

	/** можно ли менять сделку по роли в ней (закрытость и права роли проверяются отдельно) */
	get writable(): boolean {
		return !this.watcherOnly;
	}

	get closed(): boolean {
		return !!this.deal?.closed_at;
	}

	async load(): Promise<void> {
		const mine = ++this.#seq;
		this.loading = true;
		this.error = null;
		try {
			const card = await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: this.id } } }));
			if (mine !== this.#seq) return;
			this.#apply(card);
			await Promise.all([workflows.ensure(card.deal.workflow_id), this.loadTransitions(), this.loadAccess(), this.loadHistory()]);
		} catch (e) {
			if (mine === this.#seq) this.error = e;
		} finally {
			if (mine === this.#seq) this.loading = false;
		}
	}

	#apply(card: { deal: Deal; products?: DealProduct[]; open_tasks_count?: number; comments_count?: number }): void {
		this.deal = card.deal;
		this.products = card.products ?? [];
		this.counts = { comments: card.comments_count ?? 0, tasks: card.open_tasks_count ?? 0 };
	}

	/** Роль пользователя в сделке: наблюдатель только читает. Не удалось узнать — считаем, что права полные (решает сервер). */
	async loadAccess(): Promise<void> {
		try {
			const { items } = await coalesce(`participants:${this.id}`, () => unwrap(api.GET('/api/deals/{deal_id}/participants', { params: { path: { deal_id: this.id } } })));
			this.watcherOnly = isWatcherOnly(items, this.deal?.owner_id, session.me ? { id: session.me.id, role: session.role } : null);
		} catch {
			this.watcherOnly = false;
		}
	}

	/** История сделки; ошибка не роняет карточку: лента шагов работает и без неё, вкладка «История» покажет ошибку с повтором. */
	async loadHistory(): Promise<void> {
		const mine = ++this.#historySeq;
		this.historyError = null;
		try {
			const history = await unwrap(api.GET('/api/deals/{deal_id}/history', { params: { path: { deal_id: this.id } } }));
			if (mine === this.#historySeq) this.history = history;
		} catch (e) {
			if (mine === this.#historySeq) this.historyError = e;
		} finally {
			if (mine === this.#historySeq) this.historyLoading = false;
		}
	}

	async loadTransitions(): Promise<void> {
		if (!this.deal || this.deal.closed_at) {
			this.transitions = [];
			this.transitionsLoaded = true;
			return;
		}
		try {
			this.transitions = (await unwrap(api.GET('/api/deals/{deal_id}/available-transitions', { params: { path: { deal_id: this.id } } }))).items;
		} catch {
			this.transitions = [];
		}
		this.transitionsLoaded = true;
	}

	/** Перечитать сделку и переходы без «скелета» (после конфликта, возврата на вкладку, действий других модулей). */
	async refresh(): Promise<void> {
		try {
			const card = await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: this.id } } }));
			this.#apply(card);
			this.conflict = false;
			this.epoch += 1;
			await Promise.all([this.loadTransitions(), this.loadHistory()]);
		} catch (e) {
			this.error = e;
		}
	}

	/** Результат перехода / переназначения: подставить свежую сделку и обновить набор переходов. */
	async applied(deal: Deal): Promise<void> {
		this.deal = deal;
		this.epoch += 1;
		await Promise.all([this.loadTransitions(), this.loadHistory()]);
	}

	async patch(body: DealUpdate): Promise<Deal> {
		if (!this.deal) throw new Error('Сделка не загружена');
		const deal = await unwrap(api.PATCH('/api/deals/{deal_id}', { params: { path: { deal_id: this.id } }, headers: ifMatch(this.deal.version), body }));
		this.deal = deal;
		return deal;
	}

	/** Полная замена списка продуктов (PUT — не PATCH: пустой список — осознанная очистка, не «поле не пришло»). */
	async replaceProducts(items: DealProductIn[]): Promise<void> {
		if (!this.deal) throw new Error('Сделка не загружена');
		const card = await unwrap(
			api.PUT('/api/deals/{deal_id}/products', { params: { path: { deal_id: this.id } }, headers: ifMatch(this.deal.version), body: { items } })
		);
		this.#apply(card);
	}

	async reassign(ownerId: string, reason: string): Promise<Deal> {
		if (!this.deal) throw new Error('Сделка не загружена');
		const deal = await unwrap(
			api.POST('/api/deals/{deal_id}/reassign', { params: { path: { deal_id: this.id } }, headers: ifMatch(this.deal.version), body: { owner_id: ownerId, reason } })
		);
		this.deal = deal;
		this.epoch += 1;
		void this.loadHistory();
		return deal;
	}
}
