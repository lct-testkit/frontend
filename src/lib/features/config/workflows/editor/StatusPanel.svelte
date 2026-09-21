<script lang="ts">
	// Панель статуса: название, код, тип, цвет, обязательные поля, SLA, переходы, архивация / удаление.
	import { untrack } from 'svelte';
	import { ArrowLeft, ArrowRight, Archive, Trash } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, IconBtn, confirm, toast } from '$lib/ui';
	import { STATUS_TYPE_LABELS, STATUS_TYPES, makeCode, type StatusDraft, type StatusType } from '../graph';
	import { STATUS_COLORS, statusColor } from '../palette';
	import type { WorkflowEditor } from './editor.svelte';
	import PanelIssues from './PanelIssues.svelte';
	import SlaEditor from './SlaEditor.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';

	interface Props {
		editor: WorkflowEditor;
		status: StatusDraft;
		onArchive: (status: StatusDraft) => void;
	}

	let { editor, status, onArchive }: Props = $props();

	const isNew = $derived(status.id === null);
	const outgoing = $derived(editor.draft.transitions.filter((t) => t.from === status.key));
	const incoming = $derived(editor.draft.transitions.filter((t) => t.to === status.key));
	const targets = $derived(editor.liveStatuses.filter((s) => s.key !== status.key && !outgoing.some((t) => t.to === s.key)));
	const requiredItems = $derived(
		editor.catalogue.filter((f) => f.group !== 'attachment' && !['tasks.open_count', 'products.count', 'signature_status'].includes(f.key)).map((f) => ({ key: f.key, value: f.label }))
	);
	const errs = $derived(editor.issues.filter((i) => i.statusKeys.includes(status.key)));

	let codeTouched = $state(false);
	let target = $state<string | null>(null);
	$effect(() => {
		void status.key;
		untrack(() => {
			codeTouched = false;
			target = null;
		});
	});

	function rename(name: string) {
		const others = editor.draft.statuses.filter((s) => s.key !== status.key).map((s) => s.code);
		editor.updateStatus(status.key, { name, ...(isNew && !codeTouched ? { code: makeCode(name, others) } : {}) });
	}

	async function remove() {
		if (!isNew) {
			try {
				const impact = await unwrap(api.GET('/api/workflows/{workflow_id}/statuses/{status_id}/impact', { params: { path: { workflow_id: editor.id, status_id: status.id as string } } }));
				if (impact.active_count > 0) {
					toast.warning('В статусе есть сделки', 'Сначала архивируйте статус: сделки будут перенесены');
					onArchive(status);
					return;
				}
			} catch (e) {
				toast.error(e);
				return;
			}
		}
		const n = outgoing.length + incoming.length;
		if (await confirm({ title: `Удалить статус «${status.name}»?`, message: n ? `Вместе с ним будут удалены переходы (${n}).` : undefined, confirmLabel: 'Удалить', danger: true })) editor.removeStatus(status.key);
	}
</script>

<div class="flex flex-col gap-4">
	<PanelIssues issues={errs} />

	<TextField label="Название" value={status.name} disabled={editor.readonly} onInput={rename} autofocus={isNew} />
	<TextField
		label="Код"
		value={status.code}
		readonly={!isNew || editor.readonly}
		hint={isNew ? 'Латиница, цифры и «_»' : 'После сохранения код не меняется'}
		onInput={(v) => {
			codeTouched = true;
			editor.updateStatus(status.key, { code: v.trim() });
		}}
	/>
	<Pick
		label="Тип"
		value={status.type}
		disabled={editor.readonly}
		items={STATUS_TYPES.map((t) => ({ key: t, value: STATUS_TYPE_LABELS[t] }))}
		onChange={(v) => v && editor.updateStatus(status.key, { type: v as StatusType })}
	/>

	<div class="flex flex-col gap-1.5">
		<span class="t-desc-l text-muted">Цвет</span>
		<!-- палитра кружков: в rt-ui нет выбора цвета, кружок-переключатель остаётся своим -->
		<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Цвет статуса">
			<button
				type="button"
				role="radio"
				aria-checked={!status.color}
				aria-label="По типу статуса"
				disabled={editor.readonly}
				class={['m-0 size-7 cursor-pointer appearance-none rounded-full border-2 p-0', !status.color ? 'border-fg' : 'border-line']}
				style:background={statusColor({ color: null, type: status.type })}
				onclick={() => editor.updateStatus(status.key, { color: null })}
			></button>
			{#each STATUS_COLORS as c (c.key)}
				<button
					type="button"
					role="radio"
					aria-checked={status.color === c.key}
					aria-label={c.name}
					title={c.name}
					disabled={editor.readonly}
					class={['m-0 size-7 cursor-pointer appearance-none rounded-full border-2 p-0', status.color === c.key ? 'border-fg' : 'border-line']}
					style:background={c.key}
					onclick={() => editor.updateStatus(status.key, { color: c.key })}
				></button>
			{/each}
		</div>
	</div>

	<MultiPick
		label="Обязательные поля"
		placeholder="Ничего не требуется"
		items={requiredItems}
		value={status.required_fields}
		disabled={editor.readonly}
		onChange={(v) => editor.updateStatus(status.key, { required_fields: v })}
	/>

	<SlaEditor {editor} {status} />

	<section class="flex flex-col gap-2">
		<h3 class="t-body-m-strong">Переходы</h3>
		<!-- строка перехода целиком — кнопка (стрелка, имя, название): кликабельной строки в rt-ui нет -->
		{#each outgoing as t (t.key)}
			<button
				type="button"
				class="m-0 flex min-h-11 cursor-pointer appearance-none items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5 text-left font-[inherit] text-[inherit] hover:bg-surface-2"
				onclick={() => editor.select({ kind: 'transition', key: t.key })}
			>
				<ArrowRight class="size-4 flex-none fill-soft" />
				<span class="t-body-s min-w-0 flex-1 truncate">{editor.statusName(t.to)}</span>
				<span class="t-desc-s max-w-32 truncate text-soft">{t.name}</span>
			</button>
		{/each}
		{#each incoming as t (t.key)}
			<button
				type="button"
				class="m-0 flex min-h-11 cursor-pointer appearance-none items-center gap-2 rounded-md border border-dashed border-line bg-transparent px-3 py-1.5 text-left font-[inherit] text-muted hover:bg-surface-2"
				onclick={() => editor.select({ kind: 'transition', key: t.key })}
			>
				<ArrowLeft class="size-4 flex-none fill-soft" />
				<span class="t-body-s min-w-0 flex-1 truncate">{editor.statusName(t.from)}</span>
			</button>
		{/each}
		{#if outgoing.length + incoming.length === 0}<p class="t-desc-l text-soft">Переходов нет</p>{/if}
		{#if !editor.readonly && !status.is_archived && targets.length}
			<Pick
				label="Добавить переход в…"
				search
				bind:value={target}
				items={targets.map((s) => ({ key: s.key, value: s.name }))}
				onChange={(key) => {
					if (key) editor.addTransition(status.key, key);
					target = null;
				}}
			/>
		{/if}
	</section>

	{#if !editor.readonly && !status.is_archived}
		<div class="flex flex-wrap items-center gap-2 border-t border-line pt-3">
			{#if !isNew}<Btn label="Архивировать…" icon={Archive} variant="outline" colorScheme="neutral" disabled={editor.dirty} onclick={() => onArchive(status)} />{/if}
			<IconBtn icon={Trash} label="Удалить статус" danger class="ml-auto" onclick={remove} />
		</div>
		{#if !isNew && editor.dirty}<p class="t-desc-m -mt-2 text-soft">Архивация доступна после сохранения черновика</p>{/if}
	{/if}
</div>
