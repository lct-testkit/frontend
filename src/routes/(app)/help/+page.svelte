<script lang="ts">
	// In-app manual: short markdown articles (src/lib/content/help/*.md), one per topic. `?s=<slug>` deep-links a topic.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Select } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { session } from '$lib/auth/session.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import Btn from '$lib/ui/Btn.svelte';
	import Card from '$lib/ui/Card.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';

	const raw = import.meta.glob('../../../lib/content/help/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

	interface Article {
		slug: string;
		title: string;
		html: string;
		/** permission that makes the topic relevant (omit = everyone) */
		needs?: string[];
	}

	const NEEDS: Record<string, string[]> = { admin: ['user:read'], workflows: ['workflow:write'] };

	const articles: Article[] = Object.entries(raw)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([path, source]) => {
			const slug = path.split('/').pop()!.replace(/^\d+-/, '').replace(/\.md$/, '');
			return { slug, title: /^#\s+(.+)$/m.exec(source)?.[1] ?? slug, html: renderMarkdown(source.replace(/^#\s+.+\n+/, ''), { allowImages: true }), needs: NEEDS[slug] };
		});

	const bp = useBreakpoint();
	const visible = $derived(articles.filter((a) => !a.needs || session.canAny(...a.needs)));
	const current = $derived(visible.find((a) => a.slug === page.url.searchParams.get('s')) ?? visible[0]);

	function open(slug: string) {
		void goto(`?s=${slug}`, { replaceState: true, keepFocus: true, noScroll: true });
	}
</script>

<svelte:head><title>Справка · RTK School</title></svelte:head>

<Page narrow>
	<PageHeader title="Справка" />

	{#if bp.isMobile}
		<Select
			size="l"
			placement="bottom"
			items={visible.map((a) => ({ key: a.slug, value: a.title }))}
			value={current?.slug ?? null}
			deselectEnabled={false}
			autocomplete={{ enabled: false }}
			onChange={(key: string | number) => key && open(String(key))}
		/>
	{/if}

	<div class="grid grid-cols-[13rem_minmax(0,1fr)] items-start gap-6 max-md:grid-cols-1">
		{#if !bp.isMobile}
			<!-- вертикальное меню разделов: у rt-ui вкладки только горизонтальные; кнопки дизайн-системы, название переносится на вторую строку -->
			<nav class="sticky top-4 flex flex-col gap-0.5" aria-label="Разделы справки">
				{#each visible as article (article.slug)}
					<Btn
						label={article.title}
						variant={article.slug === current?.slug ? 'secondary' : 'ghost'}
						colorScheme={article.slug === current?.slug ? 'accent' : 'neutral'}
						block
						class="h-auto min-h-10 justify-start py-2 text-left [&_.atmr-button\_\_label]:whitespace-normal"
						aria-current={article.slug === current?.slug ? 'page' : undefined}
						onclick={() => open(article.slug)}
					/>
				{/each}
			</nav>
		{/if}

		{#if current}
			<Card>
				<article class="flex flex-col gap-3">
					<h2 class="t-h3">{current.title}</h2>
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- the help articles are our own markdown, rendered through DOMPurify -->
					<div class="md">{@html current.html}</div>
				</article>
			</Card>
		{/if}
	</div>

	{#if session.role === 'ADMIN'}
		<p class="t-desc-l text-muted">Техническое описание API — <a href="/api/docs" target="_blank" rel="noreferrer">Swagger</a>.</p>
	{/if}
</Page>
