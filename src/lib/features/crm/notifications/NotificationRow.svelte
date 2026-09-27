<script lang="ts">
	// Одна запись уведомления на ListRow: заголовок (у непрочитанного жирный, справа точка), текст, сделка, время; у важных — метка приоритета.
	// Клик по строке ведёт к объекту и отмечает прочитанным; кнопка «Прочитано» — только отметить.
	import { Btn, DateText, ListRow, StatusChip } from '$lib/ui';
	import { dealCache, dealLabel } from '../shared/entityCache.svelte';
	import { NOTIFICATION_PRIORITY_LABELS } from '../shared/labels';
	import type { NotificationItem } from '../types';
	import { entityHref } from './eventCodes';
	import { notificationBody, notificationTitle } from './notifications.svelte';

	interface Props {
		item: NotificationItem;
		onOpen: (item: NotificationItem, href: string | null) => void;
		onRead?: (item: NotificationItem) => void;
	}

	let { item, onOpen, onRead }: Props = $props();

	const href = $derived(entityHref(item.entity_type, item.entity_id));
	const body = $derived(notificationBody(item));
	$effect(() => {
		if (item.entity_type === 'deal' && item.entity_id) dealCache.ensure([item.entity_id]);
	});
</script>

{#snippet description()}
	{#if item.priority !== 'normal'}
		<StatusChip label={`${NOTIFICATION_PRIORITY_LABELS[item.priority] ?? item.priority} приоритет`} tone={item.priority === 'critical' ? 'error' : 'warning'} />
	{/if}
	{#if body}<span class="line-clamp-2 w-full break-words">{body}</span>{/if}
	{#if item.entity_type === 'deal' && item.entity_id}<span class="max-w-full truncate text-fg">{dealLabel(item.entity_id)}</span>{/if}
	<span class="text-soft"><DateText value={item.created_at} relative /></span>
{/snippet}

{#snippet suffix()}
	{#if !item.is_read && onRead}<Btn label="Прочитано" variant="ghost" colorScheme="neutral" size="auto" onclick={() => onRead(item)} />{/if}
{/snippet}

<ListRow title={notificationTitle(item)} unread={!item.is_read} {description} {suffix} onclick={() => onOpen(item, href)} />
