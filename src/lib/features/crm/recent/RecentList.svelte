<script lang="ts">
	// «Недавно открытые»: сделки с бэкенда (`GET /api/me/recent`) + организации и контакты из локальной истории (там только вид, id и время).
	// Названия организаций и ФИО контактов берутся из кэшей; сущность, которой нет или к которой нет доступа, из списка пропадает.
	// Работает и как блок главной страницы, и как содержимое всплывающего окна на странице сделок.
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import { Contacts, Government, Portfolio } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { DateText, EmptyState, ErrorState, Skeleton } from '$lib/ui';
	import Ico from '../shared/Ico.svelte';
	import { contactCache, contactFullName, orgCache, orgTitle } from '../shared/entityCache.svelte';
	import { LEGACY_RECENT_KEY, RECENT_KEY, localRecent, mergeRecent, type RecentRow, type RemoteRecent } from './localRecent';

	let { limit = 8, compact = false }: { limit?: number; compact?: boolean } = $props();

	// запас: часть записей может скрыться (удалены или недоступны)
	const POOL = 20;
	let remote = $state<RemoteRecent[]>([]);
	let local = $state<ReturnType<typeof localRecent>>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	const HREF: Record<string, (id: string) => string | null> = {
		deal: (id) => `/deals/${id}`,
		organization: (id) => `/organizations/${id}`,
		contact: (id) => `/contacts/${id}`
	};
	const ICON: Record<string, Component<any>> = { deal: Portfolio, organization: Government, contact: Contacts }; // eslint-disable-line @typescript-eslint/no-explicit-any
	const KIND: Record<string, string> = { deal: 'Сделка', organization: 'Организация', contact: 'Контакт' };

	const merged = $derived(mergeRecent(remote, local, POOL));
	$effect(() => {
		const orgs = merged.filter((r) => r.type === 'organization').map((r) => r.id);
		const contacts = merged.filter((r) => r.type === 'contact').map((r) => r.id);
		if (orgs.length) orgCache.ensure(orgs);
		if (contacts.length) contactCache.ensure(contacts);
	});
	/** Название строки: у сделки — с бэкенда, у организации и контакта — из кэша; null — сущности нет, строку скрываем. */
	function titleOf(r: RecentRow): string | null {
		if (r.type === 'organization') {
			const o = orgCache.get(r.id);
			return o === undefined ? '…' : o ? orgTitle(o) : null;
		}
		if (r.type === 'contact') {
			const c = contactCache.get(r.id);
			return c === undefined ? '…' : c ? contactFullName(c) : null;
		}
		return r.title ?? '';
	}
	const items = $derived(
		merged
			.map((r) => ({ ...r, label: titleOf(r) }))
			.filter((r): r is RecentRow & { label: string } => r.label !== null)
			.slice(0, limit)
	);

	async function load() {
		loading = true;
		error = null;
		try {
			remote = (await unwrap(api.GET('/api/me/recent'))).items;
			local = localRecent(session.me?.id);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	// две вкладки: история организаций и контактов обновляется, когда другая вкладка её дописала или выход стёр
	function onStorage(e: StorageEvent) {
		if (e.key === null || e.key === RECENT_KEY || e.key === LEGACY_RECENT_KEY) local = localRecent(session.me?.id);
	}

	onMount(() => {
		void load();
		window.addEventListener('storage', onStorage);
		return () => window.removeEventListener('storage', onStorage);
	});
</script>

{#if loading}
	<Skeleton kind="rows" rows={4} />
{:else if error}
	<ErrorState {error} onRetry={load} compact />
{:else if items.length === 0}
	<EmptyState title="Пока ничего не открывали" compact />
{:else}
	<ul class="m-0 flex list-none flex-col p-0" aria-label="Недавно открытые">
		{#each items as item (`${item.type}:${item.id}`)}
			<li>
				<a href={HREF[item.type](item.id) ?? '#'} class={['flex items-center gap-3 rounded-md px-2 text-fg no-underline hover:bg-surface-3 hover:no-underline', compact ? 'min-h-10' : 'min-h-12']}>
					<Ico icon={ICON[item.type] ?? Portfolio} tone="soft" size={20} />
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="t-body-m truncate">{item.label}</span>
						{#if !compact}<span class="t-desc-l text-muted">{KIND[item.type] ?? item.type}</span>{/if}
					</span>
					<span class="t-desc-l flex-none text-soft"><DateText value={item.opened_at} relative /></span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
