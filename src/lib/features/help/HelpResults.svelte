<script lang="ts">
	// Результаты поиска по справке: глава, раздел и фрагмент с подсвеченными словами. Фрагмент собирает `search.ts`:
	// текст в нём экранирован до подсветки, поэтому его можно вставлять как HTML.
	import { EmptyState, Skeleton } from '$lib/ui';
	import type { SearchResult } from './search';

	interface Props {
		query: string;
		results: SearchResult[];
		loading: boolean;
	}

	let { query, results, loading }: Props = $props();
</script>

{#if loading}
	<Skeleton kind="list" rows={4} />
{:else if results.length === 0}
	<EmptyState title={`По запросу «${query}» ничего не найдено`} hint="Проверьте написание или откройте оглавление." />
{:else}
	<ul class="m-0 flex list-none flex-col p-0" aria-label="Результаты поиска" data-testid="help-results">
		{#each results as r (r.slug)}
			<li class="border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
				<a href={`?s=${r.slug}${r.anchor ? `#${r.anchor}` : ''}`} class="flex flex-col gap-1 no-underline hover:no-underline" data-testid="help-result">
					<span class="t-body-m-strong text-fg">{r.title}</span>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the snippet is built by search.ts: the text is escaped, then the found words are wrapped in <mark> -->
					<span class="t-body-m text-muted [&_mark]:rounded-sm [&_mark]:bg-accent-soft [&_mark]:text-fg">{@html r.snippet}</span>
				</a>
			</li>
		{/each}
	</ul>
{/if}
