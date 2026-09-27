<script lang="ts">
	// Панель перехода: название, откуда → куда, роли, комментарий, условия, действия.
	import { Chip } from '@lct-testkit/rt-ui';
	import { ArrowRight, Trash } from '@lct-testkit/rt-ui/icons';
	import { IconBtn, confirm } from '$lib/ui';
	import { ROLE_LABELS, TRANSITION_ROLES, type TransitionAction } from '../dsl';
	import type { TransitionDraft } from '../graph';
	import type { WorkflowEditor } from './editor.svelte';
	import ActionsEditor from './ActionsEditor.svelte';
	import ConditionEditor from './ConditionEditor.svelte';
	import PanelIssues from './PanelIssues.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';

	interface Props {
		editor: WorkflowEditor;
		transition: TransitionDraft;
		templates: readonly { code: string; name: string }[];
	}

	let { editor, transition, templates }: Props = $props();

	const errs = $derived(editor.issues.filter((i) => i.transitionKeys.includes(transition.key)));
	const off = $derived(editor.readonly);

	async function remove() {
		if (await confirm({ title: `Удалить переход «${transition.name}»?`, confirmLabel: 'Удалить', danger: true })) editor.removeTransition(transition.key);
	}
</script>

<div class="flex flex-col gap-4">
	<PanelIssues issues={errs} />

	<TextField label="Название" required value={transition.name} disabled={off} autofocus onInput={(v) => editor.updateTransition(transition.key, { name: v })} />

	<div class="flex flex-wrap items-center gap-2">
		<Chip class="max-w-full" size="s" variant="secondary" selected={false} label={editor.statusName(transition.from)} onclick={() => editor.select({ kind: 'status', key: transition.from })} />
		<ArrowRight class="size-4 flex-none fill-soft" />
		<Chip class="max-w-full" size="s" variant="secondary" selected={false} label={editor.statusName(transition.to)} onclick={() => editor.select({ kind: 'status', key: transition.to })} />
	</div>

	<MultiPick
		label="Кто может выполнить"
		placeholder="Любая роль"
		search={false}
		items={TRANSITION_ROLES.map((r) => ({ key: r, value: ROLE_LABELS[r] }))}
		value={transition.allowed_roles}
		disabled={off}
		onChange={(v) => editor.updateTransition(transition.key, { allowed_roles: v })}
	/>
	<Toggle label="Требовать комментарий" checked={transition.requires_comment} disabled={off} onChange={(v) => editor.updateTransition(transition.key, { requires_comment: v })} />

	<section class="flex flex-col gap-2">
		<h3 class="t-body-m-strong">Условия</h3>
		<ConditionEditor value={transition.conditions} catalogue={editor.catalogue} disabled={off} onChange={(c) => editor.updateTransition(transition.key, { conditions: c })} />
	</section>

	<section class="flex flex-col gap-2">
		<h3 class="t-body-m-strong">Действия</h3>
		<ActionsEditor
			actions={transition.actions}
			statuses={editor.liveStatuses.map((s) => ({ code: s.code, name: s.name }))}
			{templates}
			disabled={off}
			onChange={(a: TransitionAction[]) => editor.updateTransition(transition.key, { actions: a })}
		/>
	</section>

	{#if !off}
		<div class="flex border-t border-line pt-3"><IconBtn icon={Trash} label="Удалить переход" danger class="ml-auto" onclick={remove} /></div>
	{/if}
</div>
