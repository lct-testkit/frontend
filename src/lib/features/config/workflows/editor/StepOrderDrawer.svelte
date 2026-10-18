<script lang="ts">
	// «Порядок шагов»: список «1. … 14.» с кнопками «Выше» / «Ниже» и «Добавить шаг после» у каждого шага. Работает пальцем и с клавиатуры, без перетаскивания.
	// Перенос и вставка меняют черновик, как любая правка: сохранение и публикация — обычные.
	import { ArrowDown, ArrowUp, AddLarge } from '@lct-testkit/rt-ui/icons';
	import { IconBtn, Notice } from '$lib/ui';
	import AppDrawer from '$lib/ui/AppDrawer.svelte';
	import { stepsOf } from '../graph';
	import type { WorkflowEditor } from './editor.svelte';

	interface Props {
		open: boolean;
		editor: WorkflowEditor;
		onClose: () => void;
	}

	let { open, editor, onClose }: Props = $props();

	const steps = $derived(stepsOf(editor.draft));
	const published = $derived(editor.workflow?.state === 'published');
</script>

<AppDrawer {open} title="Порядок шагов" width={480} {onClose}>
	<div class="flex flex-col gap-3">
		{#if published}<Notice tone="warning" class="shrink-0">Порядок шагов изменится у всех сделок воронки после публикации.</Notice>{/if}
		<ol class="m-0 flex list-none flex-col gap-2 p-0" aria-label="Шаги воронки по порядку">
			{#each steps as step, i (step.key)}
				<li class="flex min-h-14 items-center gap-2 rounded-md border border-line bg-surface py-1.5 pr-1.5 pl-3" data-testid="step-row">
					<span class="t-body-m-strong w-6 flex-none text-right text-muted">{i + 1}</span>
					<span class="t-body-m min-w-0 flex-1 wrap-anywhere">{step.name || 'Без названия'}</span>
					<span class="flex flex-none items-center">
						<IconBtn icon={ArrowUp} label={`Выше: ${step.name}`} disabled={editor.readonly || step.type === 'initial' || i <= 1} onclick={() => editor.moveStep(step.key, -1)} data-testid="step-up" />
						<IconBtn icon={ArrowDown} label={`Ниже: ${step.name}`} disabled={editor.readonly || step.type === 'initial' || i === steps.length - 1} onclick={() => editor.moveStep(step.key, 1)} data-testid="step-down" />
						<IconBtn icon={AddLarge} label={`Добавить шаг после «${step.name}»`} disabled={editor.readonly} onclick={() => editor.insertStepAfter(step.key)} data-testid="step-add" />
					</span>
				</li>
			{/each}
		</ol>
		{#if steps.length === 0}<p class="t-body-s text-soft">Шагов пока нет.</p>{/if}
	</div>
</AppDrawer>
