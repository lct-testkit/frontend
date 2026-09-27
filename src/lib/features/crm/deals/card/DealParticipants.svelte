<script lang="ts">
	// Участники сделки: наблюдатель, соисполнитель, юрист, методист. Добавляет и убирает тот, кто может править сделку.
	import { onMount } from 'svelte';
	import { CloseSmall } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { Avatar, Btn, IconBtn, Skeleton, UserPicker, confirm, toast } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { PARTICIPANT_ROLE_LABELS } from '../../shared/labels';
	import type { Participant } from '../../types';

	let { dealId, canEdit = false }: { dealId: string; canEdit?: boolean } = $props();

	let items = $state<Participant[]>([]);
	let loading = $state(true);
	let adding = $state(false);
	let user = $state<string | null>(null);
	let role = $state('watcher');
	let busy = $state(false);

	const roleItems = Object.entries(PARTICIPANT_ROLE_LABELS).map(([key, value]) => ({ key, value }));

	async function load() {
		try {
			items = (await unwrap(api.GET('/api/deals/{deal_id}/participants', { params: { path: { deal_id: dealId } } }))).items;
			people.ensure(items.map((p) => p.user_id));
		} catch (e) {
			toast.error(e);
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function add() {
		if (!user || busy) return;
		busy = true;
		try {
			const created = await unwrap(api.POST('/api/deals/{deal_id}/participants', { params: { path: { deal_id: dealId } }, body: { user_id: user, role_in_deal: role as 'watcher' } }));
			items = [...items, created];
			adding = false;
			user = null;
		} catch (e) {
			toast.error(e);
		} finally {
			busy = false;
		}
	}

	async function remove(p: Participant) {
		if (!(await confirm({ title: `Убрать ${people.name(p.user_id)} из участников?`, confirmLabel: 'Убрать', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/deals/{deal_id}/participants/{participant_id}', { params: { path: { deal_id: dealId, participant_id: p.id } } }));
			items = items.filter((x) => x.id !== p.id);
		} catch (e) {
			toast.error(e);
		}
	}
</script>

{#if loading}
	<Skeleton kind="rows" rows={2} />
{:else}
	{#if items.length === 0}
		<p class="t-body-m m-0 text-muted">Участников нет</p>
	{:else}
		<ul class="m-0 flex list-none flex-col p-0">
			{#each items as p (p.id)}
				<li class="flex min-h-11 items-center gap-3">
					<Avatar name={people.name(p.user_id)} size={28} />
					<span class="t-body-m min-w-0 flex-1 truncate">{people.name(p.user_id)}</span>
					<span class="t-desc-l text-muted">{PARTICIPANT_ROLE_LABELS[p.role_in_deal] ?? p.role_in_deal}</span>
					{#if canEdit}<IconBtn icon={CloseSmall} label="Убрать участника" size="s" onclick={() => remove(p)} />{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if canEdit}
		{#if adding}
			<div class="flex flex-wrap items-end gap-2">
				<div class="min-w-48 flex-1"><UserPicker label="Сотрудник" required value={user} exclude={items.map((p) => p.user_id)} onChange={(id) => (user = id)} /></div>
				<div class="w-44 max-md:w-full"><Pick label="Роль" items={roleItems} value={role} onChange={(v) => v && (role = v)} /></div>
				<Btn label="Добавить" loading={busy} disabled={!user} onclick={add} />
				<Btn label="Отмена" variant="ghost" colorScheme="neutral" onclick={() => (adding = false)} />
			</div>
		{:else}
			<div><Btn label="Добавить участника" variant="ghost" onclick={() => (adding = true)} /></div>
		{/if}
	{/if}
{/if}
