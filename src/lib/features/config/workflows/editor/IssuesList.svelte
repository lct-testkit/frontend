<script lang="ts">
	// Список проблем воронки: ошибки (блокируют публикацию) и советы. Клик — выбрать узел или переход и показать его на холсте.
	import { Attention, AttentionMark } from '@lct-testkit/rt-ui/icons';
	import type { GraphIssue } from '../graph';
	import type { WorkflowEditor } from './editor.svelte';

	interface Props {
		editor: WorkflowEditor;
		issues: readonly GraphIssue[];
		/** после выбора (закрыть мобильную панель проблем) */
		onPicked?: () => void;
	}

	let { editor, issues, onPicked }: Props = $props();

	/** замечание про несколько узлов или переходов сразу: подпись «Узлов: 3» / «Переходов: 14» */
	const scope = (issue: GraphIssue): string | null =>
		issue.transitionKeys.length > 1 ? `Переходов: ${issue.transitionKeys.length}` : issue.statusKeys.length > 1 ? `Узлов: ${issue.statusKeys.length}` : null;

	function pick(issue: GraphIssue) {
		const status = issue.statusKeys[0];
		const transition = issue.transitionKeys[0];
		if (transition) editor.select({ kind: 'transition', key: transition });
		else if (status) editor.select({ kind: 'status', key: status });
		else return;
		// клик по замечанию с несколькими узлами показывает и подсвечивает все (выбран первый — его панель открыта)
		const all = issue.transitionKeys.length ? issue.transitionKeys : issue.statusKeys;
		if (all.length > 1) editor.markOnCanvas(all);
		else editor.showOnCanvas(transition ?? status);
		onPicked?.();
	}
</script>

<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
	{#each issues as issue, i (i)}
		{@const target = issue.statusKeys.length > 0 || issue.transitionKeys.length > 0}
		<li>
			<!-- строка-кнопка целиком (значок + текст замечания): кликабельной строки в rt-ui нет -->
			<button
				type="button"
				disabled={!target}
				class="m-0 flex w-full cursor-pointer appearance-none items-start gap-2 rounded-md border-0 bg-surface-2 px-2.5 py-2 text-left font-[inherit] text-[inherit] enabled:hover:bg-surface-3 disabled:cursor-default"
				onclick={() => pick(issue)}
			>
				{#if issue.severity === 'error'}
					<AttentionMark class="mt-0.5 size-4 flex-none fill-danger" />
				{:else}
					<Attention class="mt-0.5 size-4 flex-none fill-warning" />
				{/if}
				<span class="t-body-s min-w-0 flex-1 wrap-anywhere">{issue.message}</span>
				{#if scope(issue)}<span class="t-desc-l flex-none rounded-sm bg-surface-3 px-1.5 text-muted">{scope(issue)}</span>{/if}
			</button>
		</li>
	{/each}
</ul>
