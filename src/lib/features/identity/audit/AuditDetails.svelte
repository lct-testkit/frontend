<script lang="ts">
	// Подробности записи журнала: кто, что, откуда и что именно изменилось («поле · было · стало»).
	import { people } from '$lib/api/people.svelte';
	import AppDrawer from '$lib/ui/AppDrawer.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { shortHash } from '../../signing/urls';
	import { entityLabel, formatChanges, fieldLabel, shortId } from '../audit';
	import { auditActionLabel, auditResultMeta, entityTypeLabel, roleLabel } from '../labels';
	import { AUDIT_RESULT_HINTS } from '../hints';
	import { describeUserAgent } from '../sessions';
	import type { AuditEntry } from '../types';
	import { entityHref } from './audit-query';

	let { entry, onClose }: { entry: AuditEntry | null; onClose: () => void } = $props();

	// содержимое держим до конца анимации закрытия
	let last = $state<AuditEntry | null>(null);
	$effect(() => {
		if (entry) last = entry;
	});

	const e = $derived(last);
	const result = $derived(e ? auditResultMeta(e.result) : null);
	const changes = $derived(e ? formatChanges(e.changes) : []);
	const href = $derived(e ? entityHref(e.entity_type, e.entity_id) : null);
	const label = $derived(e ? entityLabel(e.entity_type, e.entity_id) : null);
</script>

<AppDrawer open={!!entry} title={e ? auditActionLabel(e.action) : ''} width={560} {onClose}>
	{#if e && result}
		<div class="flex flex-wrap items-center gap-2">
			<StatusChip label={result.label} tone={result.tone} hint={AUDIT_RESULT_HINTS[e.result as keyof typeof AUDIT_RESULT_HINTS]} />
			<span class="t-desc-l text-muted">{formatDateTime(e.created_at)}</span>
		</div>

		<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-5 gap-y-2 max-md:grid-cols-1 max-md:gap-y-0.5">
			<dt class="t-desc-l text-muted">Сотрудник</dt>
			<dd class="t-body-m m-0 mb-2 md:mb-0">{e.actor_id ? people.name(e.actor_id) : 'Система'}{e.actor_role ? ` · ${roleLabel(e.actor_role)}` : ''}</dd>
			<dt class="t-desc-l text-muted">Сущность</dt>
			<dd class="t-body-m m-0 mb-2 md:mb-0">
				{entityTypeLabel(e.entity_type)}
				{#if label}
					<span class="text-muted" title={e.entity_id}>{label}</span>
				{:else if e.entity_id}
					<code class="t-desc-l text-muted" title={e.entity_id}>{shortId(e.entity_id)}</code>
				{/if}
				{#if href}<a class="t-body-s ml-1" {href}>Открыть</a>{/if}
			</dd>
			{#if e.ip}
				<dt class="t-desc-l text-muted">Откуда</dt>
				<dd class="t-body-m m-0 mb-2 md:mb-0">{e.ip}{e.user_agent ? ` · ${describeUserAgent(e.user_agent)}` : ''}</dd>
			{/if}
			{#if e.request_id}
				<dt class="t-desc-l text-muted">Запрос</dt>
				<dd class="m-0 mb-2 flex items-center gap-1 md:mb-0"><code class="t-desc-l min-w-0 break-all">{e.request_id}</code><CopyButton value={e.request_id} label="Копировать id запроса" /></dd>
			{/if}
			<dt class="t-desc-l text-muted">Хэш записи</dt>
			<dd class="m-0 flex items-center gap-1"><code class="t-desc-l" title={e.hash}>{shortHash(e.hash, 12, 8)}</code><CopyButton value={e.hash} label="Копировать хэш" /></dd>
		</dl>

		{#if changes.length}
			<section class="flex flex-col gap-2" aria-label="Изменения">
				<h3 class="t-body-m-strong m-0">Изменения</h3>
				<div class="overflow-hidden rounded-md border border-line">
					{#each changes as c, i (c.field)}
						<div class={['grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 px-3 py-2 max-md:grid-cols-1', i > 0 && 'border-t border-line']}>
							<span class="t-desc-l text-muted">{fieldLabel(c.field)}</span>
							<span class="t-body-s break-words">
								{#if c.isFact}{c.newValue}{:else}<span class="text-muted line-through">{c.oldValue}</span> → {c.newValue}{/if}
							</span>
						</div>
					{/each}
				</div>
			</section>
		{/if}
	{/if}
</AppDrawer>
