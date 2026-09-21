<script lang="ts">
	// Шаблоны уведомлений (админ): код события, канал, тема, «Активен» прямо в списке. Шаблонов немного — грузим все и ищем на клиенте.
	import { onMount } from 'svelte';
	import { ApiError, api, ifMatch, unwrap } from '$lib/api';
	import { DateText, ErrorState, Page, PageHeader, StatusChip, type Col } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENT_CODES, labelOf } from '../labels';
	import type { NotificationTemplate } from '../types';
	import CatalogList from '../catalog/CatalogList.svelte';
	import FilterBar from '$lib/ui/FilterBar.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { createResource } from '../shared/resource.svelte';
	import SwitchCell from '../shared/SwitchCell.svelte';
	import TemplateDrawer from './TemplateDrawer.svelte';

	const list = createResource(async (signal) => {
		const all: NotificationTemplate[] = [];
		let cursor: string | null = null;
		do {
			const page: { items: NotificationTemplate[]; next_cursor?: string | null } = await unwrap(api.GET('/api/admin/notification-templates', { params: { query: { limit: 100, cursor } }, signal }));
			all.push(...page.items);
			cursor = page.next_cursor ?? null;
		} while (cursor);
		return all;
	});
	onMount(() => void list.reload());

	const allowed = $derived(session.can('notification_template:manage'));
	const q = $derived(readQuery('q').trim().toLowerCase());
	const channel = $derived(readQuery('channel') || null);
	const eventName = (code: string) => NOTIFICATION_EVENT_CODES.find((e) => e.key === code)?.value ?? '';
	const rows = $derived(
		(list.data ?? [])
			.filter((t) => (!channel || t.channel === channel) && (!q || `${t.code} ${eventName(t.code)} ${t.subject_template ?? ''} ${t.body_template}`.toLowerCase().includes(q)))
			.sort((a, b) => a.code.localeCompare(b.code) || a.channel.localeCompare(b.channel))
	);

	let open = $state(false);
	let editing = $state<NotificationTemplate | null>(null);
	const openDrawer = (t: NotificationTemplate | null) => ((editing = t), (open = true));

	async function toggle(t: NotificationTemplate, next: boolean) {
		const saved = await unwrap(api.PATCH('/api/admin/notification-templates/{template_id}', { params: { path: { template_id: t.id } }, body: { is_active: next }, headers: ifMatch(t.version) }));
		list.set((list.data ?? []).map((x) => (x.id === saved.id ? saved : x)));
	}

	const columns: Col<NotificationTemplate>[] = [
		{ key: 'code', title: 'Событие', width: 'minmax(190px, 1.6fr)', render: codeCell },
		{ key: 'channel', title: 'Канал', width: 150, render: channelCell },
		{ key: 'subject', title: 'Тема', width: 'minmax(160px, 1fr)', showFrom: 'desktop', render: subjectCell },
		{ key: 'updated', title: 'Обновлён', width: 130, showFrom: 'tablet', render: updatedCell },
		{ key: 'active', title: 'Активен', width: 110, render: activeCell }
	];
</script>

{#snippet codeCell(t: NotificationTemplate)}
	<span class="flex min-w-0 flex-col"><span class="t-body-m-strong wrap-anywhere">{eventName(t.code) || t.code}</span><span class="t-desc-m font-mono text-soft">{t.code}</span></span>
{/snippet}
{#snippet channelCell(t: NotificationTemplate)}<StatusChip label={labelOf(NOTIFICATION_CHANNELS, t.channel)} tone={t.channel === 'email' ? 'info' : t.channel === 'telegram' ? 'accent' : 'neutral'} />{/snippet}
{#snippet subjectCell(t: NotificationTemplate)}<span class="t-body-s line-clamp-2 text-muted">{t.subject_template ?? '—'}</span>{/snippet}
{#snippet updatedCell(t: NotificationTemplate)}<span class="t-body-s"><DateText value={t.updated_at} /></span>{/snippet}
{#snippet activeCell(t: NotificationTemplate)}<SwitchCell checked={t.is_active} label={t.is_active ? 'Отключить шаблон' : 'Включить шаблон'} onToggle={(next) => toggle(t, next)} />{/snippet}

{#snippet card(t: NotificationTemplate)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-3">
			<span class="t-body-m-strong min-w-0 wrap-anywhere">{eventName(t.code) || t.code}</span>
			<SwitchCell checked={t.is_active} label={t.is_active ? 'Отключить шаблон' : 'Включить шаблон'} onToggle={(next) => toggle(t, next)} />
		</div>
		<span class="t-desc-l flex flex-wrap items-center gap-x-2 gap-y-1 text-muted"><span class="font-mono">{t.code}</span><StatusChip label={labelOf(NOTIFICATION_CHANNELS, t.channel)} tone="neutral" /></span>
		{#if t.subject_template}<span class="t-desc-l line-clamp-2 text-soft">{t.subject_template}</span>{/if}
	</div>
{/snippet}

<Page>
	<PageHeader title="Шаблоны уведомлений" />

	{#if !allowed}
		<ErrorState error={new ApiError({ status: 403, detail: 'Шаблоны уведомлений доступны администратору.' })} />
	{:else}
		<FilterBar primary={allowed ? { label: 'Создать шаблон', onclick: () => openDrawer(null) } : undefined} search={readQuery('q')} placeholder="Событие, тема или текст" onSearch={(v) => setQuery({ q: v })} active={channel ? 1 : 0} onReset={() => setQuery({ channel: null })}>
			{#snippet filters()}
				<Pick class="md:w-56" size="m" clearable placeholder="Любой канал" value={channel} items={NOTIFICATION_CHANNELS.map((c) => ({ key: c.key, value: c.value }))} onChange={(v) => setQuery({ channel: v })} />
			{/snippet}
		</FilterBar>
		<CatalogList
			{rows}
			{columns}
			{card}
			loading={list.loading}
			error={list.error}
			onRetry={() => list.reload()}
			filtered={Boolean(q || channel)}
			emptyText="Шаблонов пока нет"
			createLabel="Создать шаблон"
			onCreate={() => openDrawer(null)}
			onEdit={(t) => openDrawer(t)}
			ariaLabel="Шаблоны уведомлений"
		/>
	{/if}
</Page>

<TemplateDrawer {open} item={editing} onClose={() => (open = false)} onSaved={() => void list.reload()} />
