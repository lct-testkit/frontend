<script lang="ts">
	// Реквизиты в ЕГРЮЛ изменились: показываем «сейчас → в реестре» и даём принять всё или выбранное (POST apply-drift) либо «Оставить как есть»
	// (POST dismiss-drift): баннер не вернётся, пока в реестре не появится ДРУГОЕ значение. Оба вызова — с If-Match. Крестик скрывает баннер только до перезагрузки.
	import { Checkbox } from '@lct-testkit/rt-ui';
	import { ApiError, api, errorMessage, ifMatch, unwrap } from '$lib/api';
	import { Btn, Notice, toast } from '$lib/ui';
	import type { Organization } from '../types';
	import { driftEntries } from './orgUtils';

	interface Props {
		org: Organization;
		canApply: boolean;
		/** ликвидацию «оставить как есть» нельзя (сервер ответит 422): организация в ликвидации — кнопки нет */
		canDismiss?: boolean;
		onApplied: (org: Organization) => void;
		onConflict: () => Promise<void> | void;
		onHide: () => void;
	}

	let { org, canApply, canDismiss = true, onApplied, onConflict, onHide }: Props = $props();

	const entries = $derived(driftEntries(org));
	let chosen = $state<string[]>([]);
	let busy = $state(false);
	let failure = $state<string | null>(null);
	let conflict = $state(false);

	async function send(kind: 'apply' | 'dismiss', fields: string[]) {
		if (busy) return;
		busy = true;
		failure = null;
		try {
			const params = { path: { organization_id: org.id } };
			const next = await unwrap(
				kind === 'apply'
					? api.POST('/api/organizations/{organization_id}/apply-drift', { params, headers: ifMatch(org.version), body: { fields } })
					: api.POST('/api/organizations/{organization_id}/dismiss-drift', { params, headers: ifMatch(org.version), body: { fields } })
			);
			toast.success(kind === 'apply' ? 'Реквизиты обновлены' : 'Оставлено как есть', kind === 'dismiss' ? 'Баннер вернётся, только если в реестре появится другое значение' : undefined);
			chosen = [];
			onApplied(next);
		} catch (e) {
			conflict = e instanceof ApiError && e.isConflict;
			failure = conflict ? 'Организация изменена другим пользователем.' : errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		await onConflict();
		busy = false;
		failure = null;
		conflict = false;
	}

	const some = $derived(chosen.length > 0);
</script>

{#if entries.length}
	<Notice class="shrink-0" tone="warning" role="alert" title="Реквизиты изменились в ЕГРЮЛ" onClose={onHide} data-testid="drift-banner">
		<ul class="m-0 mt-2 flex list-none flex-col gap-2 p-0">
			{#each entries as e (e.field)}
				<li class="flex items-start gap-3 rounded-md bg-surface px-3 py-2">
					{#if canApply}
						<Checkbox variant="primary" aria-label={e.label} checked={chosen.includes(e.field)} onChange={(v: boolean) => (chosen = v ? [...chosen, e.field] : chosen.filter((f) => f !== e.field))} />
					{/if}
					<div class="grid min-w-0 flex-1 grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-0.5 max-md:grid-cols-1">
						<span class="t-body-s-strong">{e.label}</span>
						<!-- a space before the value is written on purpose (a plain space between the tags would be dropped) -->
						<!-- eslint-disable-next-line svelte/no-useless-mustaches -->
						<span class="t-body-m break-words"><span class="t-desc-l text-muted">Сейчас:</span>{' '}{e.current}</span>
						<!-- a space before the value is written on purpose (a plain space between the tags would be dropped) -->
						<!-- eslint-disable-next-line svelte/no-useless-mustaches -->
						<span class="t-body-m break-words"><span class="t-desc-l text-muted">В реестре:</span>{' '}{e.next}</span>
					</div>
				</li>
			{/each}
		</ul>
		{#if failure}<span class="t-body-s mt-2 block text-danger">{failure}</span>{/if}
		{#if canApply}
			<div class="mt-3 flex flex-wrap items-center gap-2">
				{#if conflict}
					<Btn label="Обновить" size="s" loading={busy} onclick={refresh} />
				{:else}
					<Btn label={some ? `Принять выбранные (${chosen.length})` : 'Принять все'} size="s" loading={busy} onclick={() => send('apply', chosen)} data-testid="drift-apply" />
					{#if canDismiss}<Btn label={some ? `Оставить выбранные (${chosen.length})` : 'Оставить как есть'} size="s" variant="outline" colorScheme="neutral" disabled={busy} onclick={() => send('dismiss', chosen)} data-testid="drift-dismiss" />{/if}
				{/if}
			</div>
		{/if}
	</Notice>
{/if}
