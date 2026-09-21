<script lang="ts">
	// Колокольчик в верхней панели, как в дизайн-системе: иконка с красной точкой, когда есть непрочитанные (число — в подписи и в панели).
	// Панель — Popover: заголовок, список последних, внизу «Прочитать все» и «Все уведомления». Опрос раз в минуту.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Notification, NotificationNew } from '@lct-testkit/rt-ui/icons';
	import { Btn } from '$lib/ui';
	import PopPanel from '../shared/PopPanel.svelte';
	import type { NotificationItem } from '../types';
	import NotificationRow from './NotificationRow.svelte';
	import { notifications } from './notifications.svelte';

	let open = $state(false);
	onMount(() => notifications.start());

	const latest = $derived(notifications.items.slice(0, 10));

	async function pick(item: NotificationItem, href: string | null) {
		open = false;
		void notifications.markRead([item.id]);
		if (href) await goto(href);
	}
</script>

{#snippet bell()}
	<button
		type="button"
		class="atmr-top-menu__utilities-icon"
		aria-label={notifications.unread ? `Уведомления: ${notifications.badge} непрочитанных` : 'Уведомления'}
		title="Уведомления"
		aria-expanded={open}
		onclick={() => (open = !open)}
		data-testid="bell"
	>
		{#if notifications.unread}<NotificationNew />{:else}<Notification />{/if}
		<span class="sr-only" data-testid="bell-count">{notifications.badge}</span>
	</button>
{/snippet}

{#snippet actions()}
	{#if notifications.unread}<Btn label="Прочитать все" variant="ghost" size="s" onclick={() => notifications.markAll()} />{/if}
	<Btn label="Все уведомления" variant="secondary" colorScheme="neutral" size="s" onclick={() => ((open = false), goto('/notifications'))} />
{/snippet}

<PopPanel {open} onClose={() => (open = false)} title="Уведомления" trigger={bell} footer={actions}>
	{#if latest.length}
		<ul class="m-0 flex list-none flex-col p-0">
			{#each latest as item (item.id)}
				<NotificationRow {item} onOpen={pick} onRead={(n) => notifications.markRead([n.id])} />
			{/each}
		</ul>
	{:else}
		<p class="t-body-s m-0 py-6 text-center text-muted">Новых уведомлений нет</p>
	{/if}
</PopPanel>
