<script lang="ts">
	// «Шаблоны»: какие документы можно отправить на подпись, кто их подписывает и сколько на это дней.
	import { onMount } from 'svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import { plural } from '$lib/utils/format';
	import { roleLabel } from '../identity/labels';
	import { listTemplates } from './api';
	import { docTypeLabel } from './status';
	import type { SignatureTemplate } from './types';

	let templates = $state<SignatureTemplate[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			templates = await listTemplates();
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	function signers(t: SignatureTemplate): string {
		const roles = t.required_signer_roles as { role?: string; contact_role?: string }[];
		return roles.map((r) => (r.role ? roleLabel(r.role) : r.contact_role === 'decision_maker' ? 'ЛПР организации' : 'Контакт')).join(', ') || '—';
	}
</script>

{#if loading}
	<Skeleton kind="list" rows={3} />
{:else if error}
	<ErrorState {error} onRetry={load} />
{:else if templates.length === 0}
	<EmptyState compact title="Шаблонов пока нет" />
{:else}
	<ul class="m-0 grid list-none grid-cols-2 gap-3 p-0 max-md:grid-cols-1">
		{#each templates as t (t.id)}
			<li class="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 max-md:p-3">
				<span class="t-body-m-strong break-words">{t.name}</span>
				<span class="t-desc-l text-muted">{docTypeLabel(t.doc_type)}</span>
				<dl class="t-body-s m-0 mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
					<dt class="text-muted">Подписывают</dt>
					<dd class="m-0">{signers(t)}</dd>
					<dt class="text-muted">Срок</dt>
					<dd class="m-0">{t.default_deadline_days} {plural(t.default_deadline_days, ['день', 'дня', 'дней'])}</dd>
				</dl>
			</li>
		{/each}
	</ul>
{/if}
