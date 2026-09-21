<script lang="ts">
	// «Недавно открытые»: сделки с бэкенда (`GET /api/me/recent`) + организации и контакты из локальной истории.
	// Работает и как блок главной страницы, и как содержимое всплывающего окна на странице сделок.
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import { Contacts, Government, Portfolio } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { DateText, EmptyState, ErrorState, Skeleton } from '$lib/ui';
	import Ico from '../shared/Ico.svelte';
	import type { RecentItem, RecentResponse } from '../types';
	import { localRecent } from './localRecent';

	let { limit = 8, compact = false }: { limit?: number; compact?: boolean } = $props();

	let items = $state<RecentItem[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	const HREF: Record<string, (id: string) => string | null> = {
		deal: (id) => `/deals/${id}`,
		organization: (id) => `/organizations/${id}`,
		contact: (id) => `/contacts/${id}`
	};
	const ICON: Record<string, Component<any>> = { deal: Portfolio, organization: Government, contact: Contacts }; // eslint-disable-line @typescript-eslint/no-explicit-any
	const KIND: Record<string, string> = { deal: 'Сделка', organization: 'Организация', contact: 'Контакт' };

	async function load() {
		loading = true;
		error = null;
		try {
			const remote = ((await unwrap(api.GET('/api/me/recent'))) as unknown as RecentResponse).items ?? [];
			const merged = [...remote, ...localRecent(session.me?.id)].filter((r) => HREF[r.type]);
			const seen = new Set<string>();
			items = merged
				.sort((a, b) => Date.parse(b.opened_at) - Date.parse(a.opened_at))
				.filter((r) => (seen.has(`${r.type}:${r.id}`) ? false : (seen.add(`${r.type}:${r.id}`), true)))
				.slice(0, limit);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	onMount(() => void load());
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
						<span class="t-body-m truncate">{item.title}</span>
						{#if !compact}<span class="t-desc-l text-muted">{KIND[item.type] ?? item.type}</span>{/if}
					</span>
					<span class="t-desc-l flex-none text-soft"><DateText value={item.opened_at} relative /></span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
