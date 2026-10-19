<script lang="ts">
	// Печатная версия руководств (`/help/print?guide=user|admin|all`): титул, оглавление и главы одним листом, главы с новой страницы.
	// Оболочка приложения при печати скрыта (`print:hidden` в AppShell), тема на время печати светлая. `data-print-ready` ставится, когда
	// загружены все главы и картинки: после этого можно печатать вручную или из браузерного скрипта.
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Print } from '@lct-testkit/rt-ui/icons';
	import { theme } from '$lib/stores/theme.svelte';
	import { Btn, EmptyState, ErrorState, Page, Skeleton } from '$lib/ui';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { GUIDE_TITLES, chapterTitle, parseGuide, printPlan, printToc, stripTitle, type PrintGuide } from './print';
	import { CHAPTERS } from '$lib/features/help/chapters';
	import { loadChapter } from '$lib/features/help/loader';
	import './print.css';

	interface Doc {
		slug: string;
		title: string;
		sections: string[];
		html: string;
	}

	const guide = $derived<PrintGuide>(parseGuide(page.url.searchParams.get('guide')));
	const autoPrint = $derived(page.url.searchParams.get('print') === '1');

	let docs = $state<Doc[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let ready = $state(false);
	let root = $state<HTMLElement>();
	let printed = false;

	async function load() {
		loading = true;
		ready = false;
		error = null;
		try {
			// справка открыта любой роли, руководство администратора тоже: печатается тот же набор глав, что и на экране
			const plan = printPlan(CHAPTERS, guide);
			docs = await Promise.all(
				plan.map(async (c) => {
					const text = await loadChapter(c);
					return { slug: c.slug, title: chapterTitle(text, c.slug), sections: printToc(text), html: renderMarkdown(stripTitle(text), { allowImages: true }) };
				})
			);
			loading = false;
			await tick();
			// страница готова к печати, когда картинки декодированы: иначе лист уйдёт с пустыми рамками
			await Promise.all([...(root?.querySelectorAll('img') ?? [])].map((img) => img.decode().catch(() => {})));
			ready = true;
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}

	// гид сменили в адресе — собрать заново
	$effect(() => {
		void guide;
		void load();
	});

	$effect(() => {
		if (ready && autoPrint && !printed && docs.length) {
			printed = true;
			window.print();
		}
	});

	// лист всегда светлый: из тёмной темы печатать на белом; после печати тема возвращается
	onMount(() => {
		const before = () => theme.preview('rtk_default_light');
		const after = () => theme.restore();
		window.addEventListener('beforeprint', before);
		window.addEventListener('afterprint', after);
		return () => {
			window.removeEventListener('beforeprint', before);
			window.removeEventListener('afterprint', after);
			theme.restore();
		};
	});

	const choose = (next: PrintGuide) => void goto(`/help/print?guide=${next}`, { replaceState: true, keepFocus: true, noScroll: true });
	const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
	const GUIDE_SHORT: Record<PrintGuide, string> = { user: 'Пользователь', admin: 'Администратор', all: 'Все руководства' };
	const GUIDES: PrintGuide[] = ['user', 'admin', 'all'];
</script>

<svelte:head><title>{GUIDE_TITLES[guide]} · печать · RTK School</title></svelte:head>

<Page narrow class="print-doc print:block print:max-w-none print:p-0 print:text-black">
	<h1 class="sr-only">Версия для печати</h1>
	<div class="flex flex-wrap items-center gap-2 print:hidden" role="toolbar" aria-label="Печать руководства">
		{#each GUIDES as g (g)}
			<Btn label={GUIDE_SHORT[g]} variant={g === guide ? 'secondary' : 'ghost'} colorScheme={g === guide ? 'accent' : 'neutral'} aria-pressed={g === guide} onclick={() => choose(g)} />
		{/each}
		<Btn class="ml-auto" label="Печать" icon={Print} disabled={!ready || !docs.length} onclick={() => window.print()} data-testid="help-print" />
	</div>

	{#if error}
		<ErrorState {error} onRetry={load} />
	{:else if loading}
		<Skeleton kind="lines" rows={8} />
	{:else if !docs.length}
		<EmptyState title="Нет глав для печати" hint="В этом руководстве пока нет глав." />
	{:else}
		<main bind:this={root} data-print-ready={ready ? 'true' : 'false'} class="flex flex-col gap-8 print:block">
			<header class="flex flex-col gap-3 break-after-page print:min-h-[240mm] print:justify-center">
				<p class="t-body-l m-0 text-muted print:text-black">RTK School · CRM по работе с вузами</p>
				<h1 class="t-h1 m-0">{GUIDE_TITLES[guide]}</h1>
				<p class="t-body-m m-0 text-muted print:text-black">Сформировано {today}</p>
			</header>

			<nav class="flex flex-col gap-2 break-after-page" aria-label="Оглавление">
				<h2 class="t-h3 m-0">Оглавление</h2>
				<ol class="m-0 flex list-decimal flex-col gap-2 pl-6">
					{#each docs as d (d.slug)}
						<li class="t-body-m-strong">
							<a href={`#print-${d.slug}`} class="print:text-black print:no-underline">{d.title}</a>
							{#if d.sections.length}
								<ul class="t-body-s m-0 mt-1 flex list-disc flex-col gap-0.5 pl-5 font-normal">
									{#each d.sections as s (s)}<li>{s}</li>{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ol>
			</nav>

			{#each docs as d, i (d.slug)}
				<article id={`print-${d.slug}`} class={['flex flex-col gap-3', i > 0 && 'break-before-page']}>
					<h2 class="t-h2 m-0 break-after-avoid">{d.title}</h2>
					<div
						class="md [&_h2]:break-after-avoid [&_h3]:break-after-avoid [&_img]:max-w-full [&_img]:break-inside-avoid [&_pre]:break-inside-avoid [&_pre]:whitespace-pre-wrap [&_table]:break-inside-avoid"
					>
						<!-- eslint-disable-next-line svelte/no-at-html-tags -- главы справки — наш же markdown, прошедший DOMPurify -->
						{@html d.html}
					</div>
				</article>
			{/each}
		</main>
	{/if}
</Page>
