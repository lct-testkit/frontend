<script lang="ts">
	// Реквизиты в ЕГРЮЛ изменились: показываем «сейчас → в реестре» и даём принять всё, выбранное или скрыть (только до перезагрузки —
	// ручки «оставить как есть» нет, backend-issues A-22). Принятие — POST apply-drift с If-Match.
	import { Checkbox } from '@lct-testkit/rt-ui';
	import { ApiError, api, errorMessage, ifMatch, unwrap } from '$lib/api';
	import { Notice, toast } from '$lib/ui';
	import type { Organization } from '../types';
	import { driftEntries } from './orgUtils';

	interface Props {
		org: Organization;
		canApply: boolean;
		onApplied: (org: Organization) => void;
		onConflict: () => Promise<void> | void;
		onHide: () => void;
	}

	let { org, canApply, onApplied, onConflict, onHide }: Props = $props();

	const entries = $derived(driftEntries(org));
	let chosen = $state<string[]>([]);
	let busy = $state(false);
	let failure = $state<string | null>(null);
	let conflict = $state(false);

	async function apply(fields: string[]) {
		if (busy) return;
		busy = true;
		failure = null;
		try {
			const next = await unwrap(api.POST('/api/organizations/{organization_id}/apply-drift', { params: { path: { organization_id: org.id } }, headers: ifMatch(org.version), body: { fields } }));
			toast.success('Реквизиты обновлены');
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

	// «Скрыть» — крестик уведомления; кнопок в Notice не больше двух, поэтому при выбранных полях «Принять все» остаётся второй
	const actions = $derived.by(() => {
		if (!canApply) return [];
		if (conflict) return [{ label: 'Обновить', onclick: refresh, variant: 'primary' as const }];
		const all = { label: 'Принять все', onclick: () => apply([]), variant: 'primary' as const };
		return chosen.length ? [{ label: `Принять выбранные (${chosen.length})`, onclick: () => apply(chosen), variant: 'primary' as const }, all] : [all];
	});
</script>

{#if entries.length}
	<Notice class="shrink-0" tone="warning" role="alert" title="Реквизиты изменились в ЕГРЮЛ" {actions} onClose={onHide} data-testid="drift-banner">
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
	</Notice>
{/if}
