// Состояние карточки сделки: сама сделка, продукты, доступные переходы, граф воронки. Все мутации (правка, переназначение, переход)
// возвращают свежую сделку — её версия идёт в следующий `If-Match`, а конфликт версий (CRM-1002) поднимает баннер «Обновить».
import { api, ifMatch, unwrap } from '$lib/api';
import { session } from '$lib/auth/session.svelte';
import { isWatcherOnly } from './access';
import type { AvailableTransition, Deal, DealProduct } from '../../types';
import { workflows } from '../workflows.svelte';

type DealUpdate = import('$lib/api').components['schemas']['DealUpdateRequest'];

export class DealCardState {
	readonly id: string;
	deal = $state<Deal | null>(null);
	products = $state<DealProduct[]>([]);
	/** счётчики карточки: устаревают до 10 минут (backend-issues A-6), вкладки уточняют их по своим данным */
	counts = $state({ comments: 0, tasks: 0 });
	transitions = $state<AvailableTransition[]>([]);
	loading = $state(true);
	error = $state<unknown>(null);
	/** кто-то изменил сделку: показываем баннер с «Обновить» */
	conflict = $state(false);
	/** текущий пользователь — наблюдатель в этой сделке: сервер не даст ничего менять, поэтому кнопок нет */
	watcherOnly = $state(false);
	/** версия данных вкладок: растёт после переходов, чтобы история/обсуждение перечитались */
	epoch = $state(0);

	#seq = 0;

	constructor(id: string) {
		this.id = id;
	}

	get graph() {
		return workflows.graph(this.deal?.workflow_id);
	}
	get status() {
		return workflows.status(this.deal?.status_id);
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
			await Promise.all([workflows.ensure(card.deal.workflow_id), this.loadTransitions(), this.loadAccess()]);
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
			const { items } = await unwrap(api.GET('/api/deals/{deal_id}/participants', { params: { path: { deal_id: this.id } } }));
			this.watcherOnly = isWatcherOnly(items, this.deal?.owner_id, session.me ? { id: session.me.id, role: session.role } : null);
		} catch {
			this.watcherOnly = false;
		}
	}

	async loadTransitions(): Promise<void> {
		if (!this.deal || this.deal.closed_at) {
			this.transitions = [];
			return;
		}
		try {
			this.transitions = (await unwrap(api.GET('/api/deals/{deal_id}/available-transitions', { params: { path: { deal_id: this.id } } }))).items;
		} catch {
			this.transitions = [];
		}
	}

	/** Перечитать сделку и переходы без «скелета» (после конфликта, возврата на вкладку, действий других модулей). */
	async refresh(): Promise<void> {
		try {
			const card = await unwrap(api.GET('/api/deals/{deal_id}', { params: { path: { deal_id: this.id } } }));
			this.#apply(card);
			this.conflict = false;
			this.epoch += 1;
			await this.loadTransitions();
		} catch (e) {
			this.error = e;
		}
	}

	/** Результат перехода / переназначения: подставить свежую сделку и обновить набор переходов. */
	async applied(deal: Deal): Promise<void> {
		this.deal = deal;
		this.epoch += 1;
		await this.loadTransitions();
	}

	async patch(body: DealUpdate): Promise<Deal> {
		if (!this.deal) throw new Error('Сделка не загружена');
		const deal = await unwrap(api.PATCH('/api/deals/{deal_id}', { params: { path: { deal_id: this.id } }, headers: ifMatch(this.deal.version), body }));
		this.deal = deal;
		return deal;
	}

	async reassign(ownerId: string, reason: string): Promise<Deal> {
		if (!this.deal) throw new Error('Сделка не загружена');
		const deal = await unwrap(
			api.POST('/api/deals/{deal_id}/reassign', { params: { path: { deal_id: this.id } }, headers: ifMatch(this.deal.version), body: { owner_id: ownerId, reason } })
		);
		this.deal = deal;
		this.epoch += 1;
		return deal;
	}
}
