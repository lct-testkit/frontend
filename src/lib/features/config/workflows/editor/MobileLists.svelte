<script lang="ts">
	// Телефон и планшет: холст только для просмотра, а редактирование — через списки «Статусы» и «Переходы» (касание открывает панель).
	import { ArrowRight, AddLarge, Attention, AttentionMark, Lock, Stopwatch } from '@lct-testkit/rt-ui/icons';
	import { Btn } from '$lib/ui';
	import { STATUS_TYPE_LABELS } from '../graph';
	import { statusColor } from '../palette';
	import type { WorkflowEditor } from './editor.svelte';
	import { formatHours } from './format';
	import { slaOf } from '../graph';

	let { editor }: { editor: WorkflowEditor } = $props();

	const CARD = 'm-0 flex w-full min-h-14 cursor-pointer appearance-none items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-left font-[inherit] text-[inherit] active:bg-surface-2';
	const sources = $derived(
		editor.draft.statuses
			.filter((s) => editor.draft.transitions.some((t) => t.from === s.key))
			.map((s) => ({ status: s, items: editor.draft.transitions.filter((t) => t.from === s.key) }))
	);
	const level = (statusKey: string) => {
		const errs = editor.issues.filter((i) => i.statusKeys.includes(statusKey));
		return errs.some((i) => i.severity === 'error') ? 'error' : errs.length ? 'warning' : null;
	};
</script>

<div class="flex flex-col gap-5">
	<section class="flex flex-col gap-2" aria-label="Статусы">
		<div class="flex items-center gap-2">
			<h2 class="t-h5 flex-1">Статусы · {editor.draft.statuses.length}</h2>
			{#if !editor.readonly}<Btn label="Статус" icon={AddLarge} size="s" variant="outline" colorScheme="neutral" onclick={() => editor.addStatus()} />{/if}
		</div>
		{#each editor.draft.statuses as s (s.key)}
			{@const sla = slaOf(editor.draft, s.key)}
			{@const lv = level(s.key)}
			<!-- карточка-кнопка целиком: в rt-ui нет кликабельной карточки -->
			<button type="button" class={[CARD, s.is_archived && 'opacity-60']} onclick={() => editor.select({ kind: 'status', key: s.key })}>
				<span class="h-9 w-1.5 flex-none rounded-full" style:background={statusColor(s)}></span>
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="t-body-m-strong wrap-anywhere">{s.name || 'Без названия'}</span>
					<span class="t-desc-l flex flex-wrap items-center gap-x-2 text-muted">
						{s.is_archived ? 'В архиве' : STATUS_TYPE_LABELS[s.type]}
						{#if sla?.is_active}<span class="inline-flex items-center gap-0.5"><Stopwatch class="size-3.5 fill-soft" />{formatHours(sla.max_duration_hours)}</span>{/if}
					</span>
				</span>
				{#if s.is_archived}<Lock class="size-5 flex-none fill-soft" />{:else if lv === 'error'}<AttentionMark class="size-5 flex-none fill-danger" />{:else if lv === 'warning'}<Attention class="size-5 flex-none fill-warning" />{/if}
			</button>
		{/each}
	</section>

	<section class="flex flex-col gap-3" aria-label="Переходы">
		<h2 class="t-h5">Переходы · {editor.draft.transitions.length}</h2>
		{#each sources as group (group.status.key)}
			<div class="flex flex-col gap-1.5">
				<h3 class="t-body-s-strong text-muted">{group.status.name}</h3>
				{#each group.items as t (t.key)}
					<button type="button" class={CARD} onclick={() => editor.select({ kind: 'transition', key: t.key })}>
						<ArrowRight class="size-5 flex-none fill-soft" />
						<span class="flex min-w-0 flex-1 flex-col">
							<span class="t-body-m wrap-anywhere">{editor.statusName(t.to)}</span>
							<span class="t-desc-l text-muted wrap-anywhere">{t.name}</span>
						</span>
					</button>
				{/each}
			</div>
		{/each}
		{#if sources.length === 0}<p class="t-body-s text-soft">Переходов пока нет. Откройте статус и добавьте переход.</p>{/if}
	</section>
</div>
