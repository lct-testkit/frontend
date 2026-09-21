<script lang="ts">
	// Удаление ПДн (ADMIN): запросы на обезличивание/удаление сотрудников, контактов и ИП.
	// Создание — отсюда (выбор субъекта) или из карточки сотрудника; «Выполнить» в согласованиях приводит сюда с заполненной формой.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import ApprovalPendingModal from '$lib/features/identity/ApprovalPendingModal.svelte';
	import ErasureList, { STATUS_TABS, statusTab } from '$lib/features/identity/erasure/ErasureList.svelte';
	import ErasureRequestModal from '$lib/features/identity/erasure/ErasureRequestModal.svelte';
	import ErasureSubjectModal from '$lib/features/identity/erasure/ErasureSubjectModal.svelte';
	import { ensureSubjects, subjectName } from '$lib/features/identity/erasure/subject';
	import type { ErasureMode, ErasureSubjectType } from '$lib/features/identity/types';
	import { IconBtn, Page, PageHeader, TabsBar } from '$lib/ui';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	let list = $state<{ reload: () => void }>();
	let choosing = $state(false);
	let subject = $state<{ type: ErasureSubjectType; id: string } | null>(null);
	let approvalId = $state<string | null>(null);
	let mode = $state<ErasureMode>('anonymize');
	let pending = $state(false);

	const name = $derived(subject ? subjectName(subject.type, subject.id) : '');

	function begin(next: { type: ErasureSubjectType; id: string }, approval: string | null = null, preset: ErasureMode = 'anonymize') {
		ensureSubjects([{ subject_type: next.type, subject_id: next.id }]);
		approvalId = approval;
		mode = preset;
		subject = next;
	}

	// «Выполнить» из согласований: ?approval_id=…&subject_type=…&subject_id=…&mode=…
	onMount(() => {
		const q = page.url.searchParams;
		const type = q.get('subject_type');
		const id = q.get('subject_id');
		if (!q.get('approval_id') || !id || (type !== 'user' && type !== 'contact' && type !== 'organization')) return;
		begin({ type, id }, q.get('approval_id'), q.get('mode') === 'hard_delete' ? 'hard_delete' : 'anonymize');
		void setQuery({ approval_id: null, subject_type: null, subject_id: null, mode: null });
	});
</script>

<svelte:head><title>Удаление ПДн · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Удаление ПДн" primary={{ label: 'Запрос', onclick: () => (choosing = true), testid: 'erasure-new' }}>
		{#snippet tabs(underline)}
			<TabsBar items={STATUS_TABS} value={statusTab(readQuery('status'))} label="Какие запросы показывать" {underline} onChange={(k) => void setQuery({ status: k === 'all' ? '' : k })} />
		{/snippet}
		{#snippet actions()}
			<IconBtn icon={Refresh} label="Обновить" onclick={() => list?.reload()} />
		{/snippet}
	</PageHeader>
	<ErasureList bind:this={list} />
</Page>

<ErasureSubjectModal
	open={choosing}
	onClose={() => (choosing = false)}
	onPick={(picked) => {
		choosing = false;
		begin({ type: picked.type, id: picked.id });
	}}
/>
{#if subject}
	<ErasureRequestModal
		open
		subject={{ type: subject.type, id: subject.id, name }}
		{approvalId}
		presetMode={mode}
		onClose={() => (subject = null)}
		onCreated={(id) => goto(`/admin/erasure/${id}`)}
		onPending={() => {
			subject = null;
			pending = true;
		}}
	/>
{/if}
<ApprovalPendingModal open={pending} what="Удаление ПДн" onClose={() => (pending = false)} />
