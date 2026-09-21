<script lang="ts">
	// Правая панель редактора: без выбора — сводка воронки и проблемы, иначе — панель статуса или перехода.
	import { ArrowLeft } from '@lct-testkit/rt-ui/icons';
	import { DateText, IconBtn, Notice, StatusChip } from '$lib/ui';
	import type { StatusDraft } from '../graph';
	import { dealTypeLong, stateLabel, stateTone } from '../meta';
	import type { WorkflowEditor } from './editor.svelte';
	import { statusesWord, transitionsWord } from './format';
	import IssuesList from './IssuesList.svelte';
	import StatusPanel from './StatusPanel.svelte';
	import TransitionPanel from './TransitionPanel.svelte';

	interface Props {
		editor: WorkflowEditor;
		templates: readonly { code: string; name: string }[];
		onArchive: (status: StatusDraft) => void;
		/** на телефоне панель — в `AppDrawer` со своим заголовком */
		bare?: boolean;
	}

	let { editor, templates, onArchive, bare = false }: Props = $props();

	const title = $derived(editor.selectedStatus ? editor.selectedStatus.name || 'Статус' : editor.selectedTransition ? 'Переход' : 'Воронка');
</script>

<div class="flex h-full min-h-0 flex-col">
	{#if !bare}
		<header class="flex flex-none items-center gap-2 border-b border-line px-3 py-2">
			{#if editor.selection}<IconBtn icon={ArrowLeft} label="К воронке" onclick={() => editor.select(null)} />{/if}
			<h2 class={['t-h5 min-w-0 flex-1 truncate', !editor.selection && 'pl-1']}>{title}</h2>
		</header>
	{/if}
	<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 max-md:px-0 max-md:pt-0">
		{#if editor.selectedStatus}
			{#key editor.selectedStatus.key}<StatusPanel {editor} status={editor.selectedStatus} {onArchive} />{/key}
		{:else if editor.selectedTransition}
			{#key editor.selectedTransition.key}<TransitionPanel {editor} transition={editor.selectedTransition} {templates} />{/key}
		{:else if editor.workflow}
			{@const w = editor.workflow}
			<div class="flex flex-col gap-4">
				<dl class="m-0 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
					<dt class="t-desc-l text-muted">Тип сделки</dt>
					<dd class="t-body-s m-0">{dealTypeLong(w.deal_type)}</dd>
					<dt class="t-desc-l text-muted">Состояние</dt>
					<dd class="m-0"><StatusChip label={stateLabel(w.state)} tone={stateTone(w.state)} /></dd>
					<dt class="t-desc-l text-muted">Состав</dt>
					<dd class="t-body-s m-0">{statusesWord(editor.liveStatuses.length)}, {transitionsWord(editor.draft.transitions.length)}</dd>
					{#if w.published_at}
						<dt class="t-desc-l text-muted">Опубликована</dt>
						<dd class="t-body-s m-0"><DateText value={w.published_at} time /></dd>
						<dt class="t-desc-l text-muted">Версия графа</dt>
						<dd class="t-body-s m-0 font-mono">{w.graph_hash?.slice(0, 10) ?? '—'}</dd>
					{/if}
				</dl>

				{#if editor.issues.length === 0}
					<Notice class="shrink-0" tone="success">Замечаний нет</Notice>
				{:else}
					<section class="flex flex-col gap-2">
						<h3 class="t-body-m-strong">Проблемы · {editor.issues.length}</h3>
						<IssuesList {editor} issues={editor.issues} />
					</section>
				{/if}
				{#if w.state === 'published'}<p class="t-desc-l text-soft">Правки вступают в силу после публикации.</p>{/if}
			</div>
		{/if}
	</div>
</div>
