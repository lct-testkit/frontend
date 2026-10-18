<script lang="ts">
	// Подробности события безопасности: что, когда, кто, откуда и что приложил сервер. Переход к источнику — ссылкой.
	import type { components } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import AppDrawer from '$lib/ui/AppDrawer.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { describeUserAgent } from '../sessions';
	import { detailRows } from './details';
	import { eventLink } from './links';
	import { securityEventHint, securityEventLabel, severityMeta } from './security-labels';

	type Event = components['schemas']['SecurityEventOut'];
	let { entry, onClose }: { entry: Event | null; onClose: () => void } = $props();

	// содержимое держим до конца анимации закрытия
	let last = $state<Event | null>(null);
	$effect(() => {
		if (entry) last = entry;
	});
	const e = $derived(last);
	const sev = $derived(e ? severityMeta(e.severity) : null);
	const link = $derived(e ? eventLink(e) : null);
	const rows = $derived(e ? detailRows(e.details) : []);
</script>

<AppDrawer open={!!entry} title={e ? securityEventLabel(e.event_type) : ''} width={520} {onClose}>
	{#if e && sev}
		<div class="flex flex-wrap items-center gap-2">
			<StatusChip label={sev.label} tone={sev.tone} />
			<span class="t-desc-l text-muted">{formatDateTime(e.created_at)}</span>
		</div>
		{#if securityEventHint(e.event_type)}<p class="t-body-s m-0 text-muted">{securityEventHint(e.event_type)}</p>{/if}
		<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 max-md:grid-cols-1 max-md:gap-y-0.5">
			<dt class="t-desc-l text-muted">Сотрудник</dt>
			<dd class="t-body-m m-0 mb-2 md:mb-0">{e.user_id ? (e.user_display ?? people.name(e.user_id, 'Сотрудник удалён')) : '—'}</dd>
			<dt class="t-desc-l text-muted">IP</dt>
			<dd class="t-body-m m-0 mb-2 font-mono md:mb-0">{e.ip ?? '—'}</dd>
			<dt class="t-desc-l text-muted">Устройство</dt>
			<dd class="t-body-m m-0 mb-2 wrap-anywhere md:mb-0" title={e.user_agent ?? undefined}>{e.user_agent ? describeUserAgent(e.user_agent) : '—'}</dd>
			{#each rows as r (r.key)}
				<dt class="t-desc-l text-muted">{r.label}</dt>
				<dd class="t-body-m m-0 mb-2 wrap-anywhere md:mb-0">{r.value}</dd>
			{/each}
		</dl>
		{#if link}<a class="t-body-m" href={link.href}>{link.label}</a>{/if}
	{/if}
</AppDrawer>
