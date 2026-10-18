<script lang="ts">
	// Сводка проверки простыми словами (`GET /api/imports/{id}/summary`): что будет создано и обновлено, какие проблемы встретились и сколько раз; выбор проблемы
	// сужает список строк ниже. После применения — «Создано / Обновлено / Пропущено».
	import { Btn, Notice } from '$lib/ui';
	import { count } from '$lib/utils/format';
	import { duplicateHeadersText, exampleRows, outcomeLines, type ImportSummary } from './check';

	interface Props {
		summary: ImportSummary;
		phase?: 'would' | 'applied';
		/** код выбранной проблемы */
		issue?: string | null;
		onPick?: (code: string | null, message: string | null) => void;
	}

	let { summary, phase = 'would', issue = null, onPick }: Props = $props();

	const lines = $derived(outcomeLines(phase === 'applied' ? (summary.applied as Record<string, Record<string, number>>) : (summary.would as Record<string, Record<string, number>>), phase));
	const dups = $derived(duplicateHeadersText(summary.duplicate_headers));
	const issues = $derived(summary.by_issue ?? []);
</script>

{#if dups}<Notice class="shrink-0" tone="warning" data-testid="check-duplicates">{dups}</Notice>{/if}

{#if lines.length || issues.length}
	<section class="flex flex-col gap-3 rounded-md bg-surface-2 p-3" aria-label="Сводка проверки" data-testid="check-summary">
		{#if lines.length}
			<ul class="m-0 flex list-none flex-col gap-0.5 p-0">
				{#each lines as line (line.key)}
					<li class="t-body-s"><span class="font-medium">{line.label}:</span> {line.text}</li>
				{/each}
			</ul>
		{/if}
		{#if issues.length}
			<div class="flex flex-col gap-1">
				<span class="t-desc-l text-muted">{phase === 'would' ? 'Что нашли в файле' : 'Замечания по файлу'}</span>
				<ul class="m-0 flex list-none flex-col gap-1 p-0">
					{#each issues as it (it.code + it.message)}
						<li class="flex min-w-0 items-center gap-3 max-md:flex-col max-md:items-start max-md:gap-1">
							<div class="flex min-w-0 flex-1 flex-col">
								<span class="t-body-s wrap-anywhere">{it.message}</span>
								<span class="t-desc-l text-muted">{count(it.rows, ['строка', 'строки', 'строк']) + (it.examples?.length ? ` · ${exampleRows(it.examples, it.rows)}` : '')}</span>
							</div>
							{#if onPick}
								<Btn
									label={issue === it.code ? 'Показаны' : 'Показать'}
									variant="ghost"
									colorScheme="neutral"
									size="auto"
									disabled={issue === it.code}
									onclick={() => onPick(it.code, it.message)}
									data-testid="check-issue-{it.code}"
								/>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</section>
{/if}
