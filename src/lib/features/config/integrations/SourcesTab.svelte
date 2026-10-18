<script lang="ts">
	// Источники интеграции (сайт, LMS, Bitrix24): карточка с переключателем «Активен» (выключение — с подтверждением), заборoм и настройкой в панели.
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { EmptyState, ErrorState, Skeleton, confirm, toast } from '$lib/ui';
	import type { IntegrationSource } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import SourceCard from './SourceCard.svelte';
	import SourceDrawer from './SourceDrawer.svelte';
	import { disableMessage } from './sourceState';

	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/sources', { signal })).then((r) => r as IntegrationSource[]));
	onMount(() => void list.reload());

	let editing = $state<IntegrationSource | null>(null);
	let open = $state(false);
	let busy = $state<string | null>(null);

	const replace = (saved: IntegrationSource) => list.set((list.data ?? []).map((s) => (s.code === saved.code ? saved : s)));

	async function toggle(s: IntegrationSource, next: boolean) {
		if (busy) return;
		if (!next && !(await confirm({ title: `Отключить «${s.name}»?`, message: disableMessage(s.code), confirmLabel: 'Отключить', danger: true }))) return;
		busy = s.code;
		try {
			replace(await unwrap(api.PATCH('/api/admin/integrations/sources/{code}', { params: { path: { code: s.code } }, body: { is_active: next } })));
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}
</script>

{#if list.error}
	<ErrorState error={list.error} onRetry={() => list.reload()} />
{:else if list.loading}
	<div class="grid grid-cols-3 gap-3 max-lg:grid-cols-2 max-md:grid-cols-1">{#each [0, 1, 2] as i (i)}<Skeleton kind="tile" rows={1} height={150} />{/each}</div>
{:else if (list.data ?? []).length === 0}
	<EmptyState title="Источников нет" />
{:else}
	<ul class="m-0 grid list-none grid-cols-3 gap-3 p-0 max-lg:grid-cols-2 max-md:grid-cols-1">
		{#each list.data ?? [] as s (s.id)}
			<li class="flex"><SourceCard source={s} busy={busy === s.code} onToggle={(v) => toggle(s, v)} onEdit={() => ((editing = s), (open = true))} /></li>
		{/each}
	</ul>
{/if}

<SourceDrawer {open} source={editing} onClose={() => (open = false)} onSaved={replace} />
