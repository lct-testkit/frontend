<script lang="ts">
	// Источники интеграции (сайт, LMS, Bitrix24): переключатель «Активен» на карточке (выключение — с подтверждением), настройка в панели.
	import { onMount } from 'svelte';
	import { Switch } from '@lct-testkit/rt-ui';
	import { Settings } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { DateText, EmptyState, ErrorState, IconBtn, Notice, Skeleton, StatusChip, confirm, toast } from '$lib/ui';
	import { AUTH_TYPES, INTEGRATION_SOURCES, labelOf } from '../labels';
	import type { IntegrationSource } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import SourceDrawer from './SourceDrawer.svelte';

	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/sources', { signal })).then((r) => r as IntegrationSource[]));
	onMount(() => void list.reload());

	let editing = $state<IntegrationSource | null>(null);
	let open = $state(false);
	let busy = $state<string | null>(null);

	const replace = (saved: IntegrationSource) => list.set((list.data ?? []).map((s) => (s.code === saved.code ? saved : s)));

	async function toggle(s: IntegrationSource, next: boolean) {
		if (busy) return;
		if (!next && !(await confirm({ title: `Отключить «${s.name}»?`, message: 'Входящие сообщения источника перестанут приниматься, исходящие события — отправляться.', confirmLabel: 'Отключить', danger: true }))) return;
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
			<li class="flex">
				<article class="flex w-full min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3">
					<header class="flex items-start gap-2">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<h3 class="t-body-l-strong wrap-anywhere">{s.name}</h3>
							<span class="t-desc-m font-mono text-soft">{labelOf(INTEGRATION_SOURCES, s.code)} · {s.code}</span>
						</div>
						<Switch checked={s.is_active} disabled={busy === s.code} aria-label={s.is_active ? `Отключить «${s.name}»` : `Включить «${s.name}»`} onChange={(v: boolean) => toggle(s, v)} />
					</header>
					<dl class="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
						<dt class="t-desc-l text-muted">Адрес</dt>
						<dd class="t-body-s m-0 break-all">{s.base_url ?? '—'}</dd>
						<dt class="t-desc-l text-muted">Авторизация</dt>
						<dd class="t-body-s m-0">{s.auth_type ? labelOf(AUTH_TYPES, s.auth_type) : '—'}</dd>
						<dt class="t-desc-l text-muted">Обмен</dt>
						<dd class="t-body-s m-0">{#if s.last_sync_at}<DateText value={s.last_sync_at} time />{:else}пока не было{/if}</dd>
					</dl>
					{#if s.last_error}<Notice class="shrink-0" tone="error"><span class="line-clamp-3 wrap-anywhere" title={s.last_error}>{s.last_error}</span></Notice>{/if}
					<footer class="mt-auto flex items-center justify-between gap-2">
						<StatusChip label={s.is_active ? 'Активен' : 'Отключён'} tone={s.is_active ? 'success' : 'neutral'} />
						<IconBtn icon={Settings} label="Настроить источник" onclick={() => ((editing = s), (open = true))} />
					</footer>
				</article>
			</li>
		{/each}
	</ul>
{/if}

<SourceDrawer {open} source={editing} onClose={() => (open = false)} onSaved={replace} />
