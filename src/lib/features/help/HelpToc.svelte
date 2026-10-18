<script lang="ts">
	// Оглавление главы: справа от текста на широком экране, сворачиваемым списком в начале главы на узком.
	// Пункт активного раздела подсвечивается (его определяет страница по прокрутке).
	import { Accordion, AccordionDetails, AccordionSummary } from '@lct-testkit/rt-ui';
	import { ChevronDown, ChevronUp } from '@lct-testkit/rt-ui/icons';
	import type { TocItem } from './toc';

	interface Props {
		items: TocItem[];
		slug: string;
		activeId: string | null;
		/** `side` — колонка справа (от 1280 px), `inline` — сворачиваемый список в начале главы */
		variant: 'side' | 'inline';
	}

	let { items, slug, activeId, variant }: Props = $props();
</script>

{#snippet list()}
	<ul class="m-0 flex list-none flex-col gap-0.5 p-0">
		{#each items as item (item.id)}
			<li>
				<a
					href={`?s=${slug}#${item.id}`}
					class={[
						't-body-m block rounded-md py-1 text-muted no-underline hover:bg-surface-2 hover:text-fg hover:no-underline max-md:min-h-11 max-md:py-2.5',
						item.depth === 3 ? 'pl-6' : 'pl-3',
						activeId === item.id && 'bg-accent-soft text-fg'
					]}
					aria-current={activeId === item.id ? 'location' : undefined}>{item.text}</a
				>
			</li>
		{/each}
	</ul>
{/snippet}

{#if variant === 'side'}
	<nav class="sticky top-4 flex max-h-[calc(100vh-6rem)] flex-col gap-2 overflow-y-auto" aria-label="Содержание главы" data-testid="help-toc">
		<p class="t-desc-l-strong px-3 text-muted">Содержание</p>
		{@render list()}
	</nav>
{:else}
	<Accordion class="rounded-md border border-line" data-testid="help-toc-inline">
		<AccordionSummary cursor="pointer" class="flex min-h-11 items-center justify-between gap-2 px-3">
			{#snippet children({ isOpen })}
				<span class="t-body-m-strong">Содержание</span>
				<span class="inline-flex [&_svg]:size-5 [&_svg]:fill-soft">{#if isOpen}<ChevronUp />{:else}<ChevronDown />{/if}</span>
			{/snippet}
		</AccordionSummary>
		<AccordionDetails class="px-1 pb-2">
			<nav aria-label="Содержание главы">{@render list()}</nav>
		</AccordionDetails>
	</Accordion>
{/if}
