<script lang="ts">
	// Встроенная справка. Индекс глав — `features/help/chapters.ts`, тексты — `content/help/**/*.md`, каждый отдельным чанком.
	// Адреса: `/help?s=<глава>#h-<раздел>` и `/help?q=<запрос>`. Главу, которой у человека нет по правам, показываем пояснением, а не подменяем другой.
	import { onMount, tick, type Component } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Select } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { session } from '$lib/auth/session.svelte';
	import DesignSystemShowcase from '$lib/features/help/DesignSystemShowcase.svelte';
	import HelpNav from '$lib/features/help/HelpNav.svelte';
	import HelpResults from '$lib/features/help/HelpResults.svelte';
	import HelpToc from '$lib/features/help/HelpToc.svelte';
	import { CHAPTERS, GROUPS, isChapterVisible, visibleChapters } from '$lib/features/help/chapters';
	import { loadAll, loadChapter } from '$lib/features/help/loader';
	import { searchChapters, type SearchResult } from '$lib/features/help/search';
	import { extractToc, hasToc, splitTitle } from '$lib/features/help/toc';
	import { helpAttention } from '$lib/stores/help-attention.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { Btn, Card, EmptyState, ErrorState, Page, PageHeader, SearchField, Skeleton } from '$lib/ui';

	const bp = useBreakpoint();
	// живой компонент под текстом главы: глава о дизайн-системе показывает настоящие компоненты rt-ui
	const EXTRAS: Record<string, Component> = { 'design-system': DesignSystemShowcase };

	const viewer = $derived({ can: (p: string) => session.can(p), role: session.role });
	const visible = $derived(visibleChapters(CHAPTERS, viewer));
	const wanted = $derived(page.url.searchParams.get('s'));
	const query = $derived((page.url.searchParams.get('q') ?? '').trim());

	// что открыто: глава из адреса; без адреса — первая видимая; неизвестная и закрытая по правам — своё пояснение
	const requested = $derived(wanted ? CHAPTERS.find((c) => c.slug === wanted) : (visible[0] ?? undefined));
	const forbidden = $derived(requested && !isChapterVisible(requested, viewer) ? requested : null);
	const current = $derived(requested && !forbidden ? requested : undefined);
	const extra = $derived(current ? EXTRAS[current.slug] : undefined);

	// --- текст главы
	let source = $state<string | null>(null);
	let loadError = $state<unknown>(null);
	let loadingChapter = $state(false);
	let attempt = $state(0);
	$effect(() => {
		const chapter = current;
		void attempt;
		source = null;
		loadError = null;
		if (!chapter) return;
		loadingChapter = true;
		let stale = false;
		loadChapter(chapter)
			.then((text) => {
				if (!stale) source = text;
			})
			.catch((e) => {
				if (!stale) loadError = e;
			})
			.finally(() => {
				if (!stale) loadingChapter = false;
			});
		return () => (stale = true);
	});

	const parts = $derived(source ? splitTitle(source) : null);
	const html = $derived(parts ? renderMarkdown(parts.body, { allowImages: true, headingIds: true }) : '');
	// в длинном справочнике (коды ошибок: десятки записей) в оглавлении остаются только разделы второго уровня
	const allToc = $derived(parts ? extractToc(parts.body) : []);
	const toc = $derived(allToc.length > 30 ? allToc.filter((i) => i.depth === 2) : allToc);
	const showToc = $derived(hasToc(allToc));

	// --- прокрутка к якорю из адреса и подсветка активного раздела оглавления
	let activeId = $state<string | null>(null);
	let article = $state<HTMLElement | null>(null);
	const scroller = () => document.getElementById('content');

	$effect(() => {
		void html;
		// пока показан скелет, статьи в DOM ещё нет — прокручиваем, когда она появилась
		if (!article) return;
		const hash = page.url.hash.slice(1);
		void tick().then(() => {
			const target = hash ? document.getElementById(hash) : null;
			if (target) target.scrollIntoView({ block: 'start' });
			else scroller()?.scrollTo({ top: 0 });
			activeId = hash || toc[0]?.id || null;
		});
	});
	$effect(() => {
		if (!article || !showToc) return;
		const root = scroller();
		const heads = [...article.querySelectorAll<HTMLElement>('h2[id], h3[id]')];
		if (!heads.length) return;
		const observer = new IntersectionObserver(
			(entries) => {
				const hit = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
				if (hit) activeId = hit.target.id;
			},
			{ root, rootMargin: '0px 0px -70% 0px' }
		);
		for (const h of heads) observer.observe(h);
		return () => observer.disconnect();
	});

	// --- поиск: тексты подгружаются при первом фокусе поля (или сразу, если в адресе уже есть ?q=)
	let texts = $state<Record<string, string> | null>(null);
	let loadingTexts = $state(false);
	async function ensureTexts() {
		if (texts || loadingTexts) return;
		loadingTexts = true;
		try {
			texts = await loadAll(visible);
		} finally {
			loadingTexts = false;
		}
	}
	$effect(() => {
		if (query) void ensureTexts();
	});
	const results = $derived<SearchResult[]>(texts && query ? searchChapters(visible, texts, query) : []);

	function setQuery(value: string) {
		const q = new URLSearchParams(page.url.searchParams);
		if (value.trim()) q.set('q', value.trim());
		else q.delete('q');
		void goto(`?${q}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	function open(slug: string) {
		void goto(`?s=${slug}`, { keepFocus: true, noScroll: true });
	}

	// «/» вне полей ввода — в поиск по справке (по коду клавиши: работает и на русской раскладке)
	let searchBox = $state<HTMLElement | null>(null);
	function onKey(e: KeyboardEvent) {
		if (e.code !== 'Slash' || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
		const el = e.target as HTMLElement | null;
		if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
		e.preventDefault();
		searchBox?.querySelector('input')?.focus();
	}

	// открыли справку — метка «загляните» у её кнопки гаснет (до следующего обновления глав)
	onMount(() => helpAttention.markSeen());

	// список для телефона: названия групп — заголовки, главы — пункты
	const selectItems = $derived(
		GROUPS.flatMap((g) => {
			const inGroup = visible.filter((c) => c.group === g.key);
			return inGroup.length ? [{ key: `group:${g.key}`, value: g.title, isTitle: true }, ...inGroup.map((c) => ({ key: c.slug, value: c.title }))] : [];
		})
	);
	const sideToc = $derived(showToc && !bp.isMobile && bp.width >= 1280 && !current?.wide);
	const forbiddenHint = $derived(forbidden?.group === 'admin' ? 'Эта глава для администратора' : 'Эта глава вам недоступна');
</script>

<svelte:head><title>Справка · RTK School</title></svelte:head>
<svelte:window onkeydown={onKey} />

{#snippet search()}
	<div bind:this={searchBox} class="min-w-0">
		<SearchField value={query} placeholder="Найти в справке" delay={200} size={bp.isMobile ? "l" : "m"} onSearch={setQuery} />
	</div>
{/snippet}

<Page class="items-stretch">
	<PageHeader title="Справка" />

	<div class={['grid items-start gap-4 max-md:gap-3', bp.isDesktop ? 'grid-cols-[19rem_minmax(0,1fr)]' : 'grid-cols-1']}>
		<div class="flex min-w-0 flex-col gap-3 md:gap-4 lg:sticky lg:top-6" onfocusin={ensureTexts}>
			{@render search()}
			{#if !bp.isDesktop && !query}
				<Select
					size="l"
					placement="bottom"
					items={selectItems}
					value={current?.slug ?? null}
					deselectEnabled={false}
					autocomplete={{ enabled: false }}
					onChange={(key: string | number) => key && open(String(key))}
					aria-label="Глава справки"
				/>
			{:else if bp.isDesktop && !query}
				<HelpNav chapters={visible} current={current?.slug} onOpen={open} />
			{/if}
		</div>

		<div class="flex min-w-0 flex-col gap-3">
			{#if query}
				<Card title="Результаты поиска">
					<HelpResults {query} {results} loading={!texts} />
				</Card>
			{:else if forbidden}
				<Card><EmptyState title={forbiddenHint} hint="Главы показываются тем, у кого есть доступ к соответствующему разделу. Если глава нужна, обратитесь к администратору." /></Card>
			{:else if !requested}
				<Card>
					<EmptyState title="Такой главы нет" hint="Возможно, ссылка устарела. Выберите главу в меню или найдите нужное поиском.">
						{#snippet action()}<Btn label="Открыть первую главу" variant="outline" colorScheme="neutral" onclick={() => visible[0] && open(visible[0].slug)} />{/snippet}
					</EmptyState>
				</Card>
			{:else}
				<div class={['grid items-start gap-6', sideToc ? 'grid-cols-[minmax(0,1fr)_14rem]' : 'grid-cols-1']}>
					<Card class="min-w-0">
						{#if loadError}
							<ErrorState error={loadError} onRetry={() => attempt++} />
						{:else if loadingChapter || !parts}
							<div class="flex flex-col gap-4" aria-busy="true">
								<Skeleton kind="lines" rows={2} height={28} width="50%" />
								<Skeleton kind="lines" rows={6} />
							</div>
						{:else}
							<article bind:this={article} class="flex flex-col gap-3" data-testid="help-article">
								<h2 class="t-h3">{parts.title ?? current?.title}</h2>
								{#if showToc && !sideToc}<HelpToc items={toc} slug={current!.slug} {activeId} variant="inline" />{/if}
								<!-- eslint-disable-next-line svelte/no-at-html-tags -- the help articles are our own markdown, rendered through DOMPurify -->
								<div class={['md [&_:is(h2,h3,h4)]:scroll-mt-4', extra && 'max-w-3xl']}>{@html html}</div>
								{#if extra}{@const Extra = extra}<Extra />{/if}
							</article>
						{/if}
					</Card>
					{#if sideToc && parts}<HelpToc items={toc} slug={current!.slug} {activeId} variant="side" />{/if}
				</div>
			{/if}

			{#if session.can('settings:write')}
				<p class="t-desc-l text-muted">Техническое описание API — <a href="/api/docs" target="_blank" rel="noreferrer">Swagger</a>.</p>
			{/if}
		</div>
	</div>
</Page>
