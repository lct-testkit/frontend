<script lang="ts">
	// «Состояние защиты»: фактическое состояние мер безопасности одним экраном — второй фактор у администраторов, Bearer, антивирус, подпись журнала, шифрование,
	// политика Keycloak. Только чтение (ADMIN и AUDITOR); исправляется в настройках сервера и realm, здесь — что именно и почему важно.
	import { onMount } from 'svelte';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { roleLabel } from '../labels';
	import { EmptyState, ErrorState, IconBtn, Notice, Skeleton, StatusChip } from '$lib/ui';
	import { createResource } from '../../config/shared/resource.svelte';
	import { STATUS_TONE, postureChecks, summarize, summaryText } from './posture';

	const posture = createResource((signal) => unwrap(api.GET('/api/admin/security/posture', { signal })));
	onMount(() => void posture.reload());

	const checks = $derived(posture.data ? postureChecks(posture.data) : []);
	const summary = $derived(summarize(checks));
	const attention = $derived(summary.bad > 0 || summary.warn > 0);
	const openUsers = $derived(session.can('user:read'));
</script>

{#if posture.error}
	<ErrorState error={posture.error} onRetry={() => posture.reload()} />
{:else if posture.loading || !posture.data}
	<div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">{#each [0, 1, 2, 3] as i (i)}<Skeleton kind="tile" rows={1} height={120} />{/each}</div>
{:else}
	<div class="flex items-center gap-2">
		<div class="min-w-0 flex-1">
			<Notice class="shrink-0" tone={summary.bad > 0 ? 'error' : attention ? 'warning' : 'success'} data-testid="posture-summary">{summaryText(summary)}</Notice>
		</div>
		<IconBtn icon={Refresh} label="Обновить" disabled={posture.refreshing} onclick={() => posture.reload()} />
	</div>
	{#if session.mode === 'demo'}
		<Notice class="shrink-0" tone="info">Демо-режим: часть мер выключена намеренно, чтобы стенд запускался без настройки. В боевом режиме все строки должны быть зелёными.</Notice>
	{/if}
	{#if checks.length === 0}
		<EmptyState title="Нет данных" />
	{:else}
		<ul class="m-0 grid list-none grid-cols-2 gap-3 p-0 max-md:grid-cols-1" aria-label="Меры безопасности">
			{#each checks as c (c.key)}
				<li class="flex min-w-0 flex-col gap-2 rounded-lg border border-line bg-surface p-4 max-md:p-3" data-testid="posture-{c.key}" data-status={c.status}>
					<div class="flex items-start justify-between gap-3">
						<h3 class="t-body-m-strong m-0 min-w-0">{c.title}</h3>
						<span class="flex-none"><StatusChip label={c.label} tone={STATUS_TONE[c.status]} /></span>
					</div>
					<p class="t-desc-l m-0 text-muted">{c.text}</p>
					{#if c.key === 'totp' && posture.data.admins_without_totp.length}
						<ul class="m-0 flex list-none flex-col gap-1 p-0">
							{#each posture.data.admins_without_totp as u (u.user_id)}
								<li class="t-body-s flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-2 px-3 py-2">
									<span class="min-w-0 wrap-anywhere">{u.email_masked} · {roleLabel(u.role)}</span>
									{#if openUsers}<a class="text-accent" href={`/admin/users/${u.user_id}`}>Открыть</a>{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
{/if}
