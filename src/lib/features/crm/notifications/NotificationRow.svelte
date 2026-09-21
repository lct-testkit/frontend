<script lang="ts">
	// Одна запись уведомления на ListItem дизайн-системы: точка приоритета, заголовок, текст, время. Клик ведёт к объекту и отмечает прочитанным; «✓» — только прочитать.
	import { ListItem } from '@lct-testkit/rt-ui';
	import { CheckSmall } from '@lct-testkit/rt-ui/icons';
	import { DateText, IconBtn } from '$lib/ui';
	import { dealCache, dealLabel } from '../shared/entityCache.svelte';
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
	const DOT = { critical: 'bg-danger', high: 'bg-warning', normal: 'bg-accent' } as const;
	const body = $derived(notificationBody(item));
	$effect(() => {
		if (item.entity_type === 'deal' && item.entity_id) dealCache.ensure([item.entity_id]);
	});
</script>

{#snippet dot()}<span class={['mt-1.5 block size-2 rounded-full', item.is_read ? 'bg-line-strong' : DOT[item.priority]]} role="img" aria-label={item.is_read ? 'Прочитано' : 'Не прочитано'}></span>{/snippet}
{#snippet mark()}
	{#if !item.is_read && onRead}<IconBtn icon={CheckSmall} label="Отметить прочитанным" size="s" onclick={(e: MouseEvent) => (e.stopPropagation(), onRead(item))} />{/if}
{/snippet}

<!-- ListItem has no layout of its own outside the side menu: a row of prefix / content / suffix -->
<ListItem class="flex items-start gap-3 px-3 py-2 [&>[class*=content]]:min-w-0 [&>[class*=content]]:flex-1" prefix={dot} suffix={mark} onclick={() => onOpen(item, href)}>
	<span class="flex min-w-0 flex-col gap-0.5 text-left">
		<span class={['t-body-s break-words', !item.is_read && 'font-semibold']}>{notificationTitle(item)}</span>
		{#if body}<span class="t-desc-l line-clamp-2 break-words text-muted">{body}</span>{/if}
		{#if item.entity_type === 'deal' && item.entity_id}<span class="t-desc-l truncate text-fg">{dealLabel(item.entity_id)}</span>{/if}
		<span class="t-desc-m text-soft"><DateText value={item.created_at} relative /></span>
	</span>
</ListItem>
