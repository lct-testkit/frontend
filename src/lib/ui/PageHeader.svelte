<script lang="ts">
	// Head of a page. Two kinds of page, two looks:
	//  • a SECTION page (a list: deals, contacts, reports…) is named by the side menu, so it shows NO visible title — the title stays for screen
	//    readers (`sr-only`), and the buttons that used to stand on the title line move to the NEXT row: the row of tabs (`tabs`), the filter bar
	//    (give it `trailing` / `primary`), or, when a page has neither, a row of their own;
	//  • an OBJECT page (a card: a deal, an organization) shows the object: [← Section link] / title (+ its buttons) / subtitle / facts + status chips.
	//    The lines sit on a 36 px pitch — the height of a button — so text lines and buttons share one grid (measured centre to centre: 36 / 36 / 36).
	// `primary` is THE create-action: a button from 768 px, the floating button on a phone (one rule, see PrimaryAction). `children` (filters,
	// tables) are the next blocks of the page, not part of the header.
	import type { Snippet } from 'svelte';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { ArrowLeft } from '@lct-testkit/rt-ui/icons';
	import BtnSizeScope from './BtnSizeScope.svelte';
	import PrimaryAction, { type Primary } from './PrimaryAction.svelte';

	// the label of the back link: the name of the section it leads to
	const BACK_LABELS: Record<string, string> = {
		'/deals': 'Сделки',
		'/organizations': 'Организации',
		'/contacts': 'Контакты',
		'/tasks': 'Задачи',
		'/notifications': 'Уведомления',
		'/signing': 'Подписание',
		'/imports': 'Импорт',
		'/workflows': 'Воронки',
		'/reports': 'Отчёты',
		'/reports/dashboards': 'Дашборды',
		'/catalog': 'Справочники',
		'/admin/users': 'Пользователи',
		'/admin/teams': 'Команды',
		'/admin/erasure': 'Удаление ПДн',
		'/admin/audit': 'Журнал аудита',
		'/admin/approvals': 'Согласования',
		'/admin/edm': 'Соглашения ЭДО',
		'/admin/registry': 'Реестр ЕГРЮЛ',
		'/admin/integrations': 'Интеграции',
		'/admin/notification-templates': 'Шаблоны уведомлений',
		'/admin/settings': 'Настройки'
	};

	interface Props {
		title: string;
		/** one short line under the title of an object (its number) */
		subtitle?: string;
		/** href of the parent page: a small «← Section» link above the title */
		back?: string;
		/** overrides the label of the back link (default: the name of the section) */
		backLabel?: string;
		/** facts under the title: who, where, how much (a small grey line, links allowed) */
		details?: Snippet;
		/** status chips of an object: next to the title on a desktop, under it on a phone */
		meta?: Snippet;
		/** the buttons of the page: icon buttons and outline buttons, never a second orange one */
		actions?: Snippet;
		primary?: Primary;
		/** tabs of a list: they share ONE row with the buttons (a phone: the strip scrolls, the buttons stay at its end; a narrow tablet: the buttons go under the tabs). The grey line under the row is drawn by the header, so `underline` is always false */
		tabs?: Snippet<[boolean]>;
		/** the blocks that follow the header (filters, tables) */
		children?: Snippet;
	}

	let { title, subtitle, back, backLabel, details, meta, actions, primary, tabs, children }: Props = $props();

	const bp = useBreakpoint();
	const object = $derived(!!(back || subtitle || details || meta));
	// buttons share the tab row (desktop): the tabs get 6 px more under them so the buttons do not touch the grey line; a row without buttons stays 36 px
	const hasButtons = $derived(!!(actions || (primary && !bp.isMobile)));

	// TABS + BUTTONS in one line — while they fit. When they do not, the buttons move to a line of their own UNDER the tabs (a strip that scrolls would hide
	// its last tab; a wrapping row would draw the grey line under the buttons instead of under the tabs). Measured: the span of the tabs + the width of the
	// buttons against the width of the header. A phone stacks only when its tabs fit alone; otherwise the strip scrolls and the buttons stay at its end.
	let head = $state<HTMLElement | null>(null);
	let strip = $state<HTMLElement | null>(null);
	let group = $state<HTMLElement | null>(null);
	let stacked = $state(false);
	let groupWidth = 0;

	function fit() {
		if (group?.offsetWidth) groupWidth = group.offsetWidth; // the group keeps its own width in either place
		const items = strip?.querySelectorAll<HTMLElement>('[role=tab]');
		if (!head || !items?.length) return;
		const first = items[0];
		const last = items[items.length - 1];
		const tabsWidth = last.offsetLeft + last.offsetWidth - first.offsetLeft;
		// on a phone whose tabs do not fit even alone the strip scrolls and the buttons stay at its end (one row, as everywhere)
		stacked = groupWidth > 0 && tabsWidth + 12 + groupWidth > head.clientWidth && (!bp.isMobile || tabsWidth <= head.clientWidth);
	}
	$effect(() => {
		if (!head || !strip) return;
		fit();
		const resize = new ResizeObserver(fit);
		resize.observe(head);
		const mutate = new MutationObserver(fit); // a count on a tab changes its width
		mutate.observe(strip, { childList: true, subtree: true, characterData: true });
		return () => {
			resize.disconnect();
			mutate.disconnect();
		};
	});
</script>

{#if tabs}
	{#snippet buttons()}
		{#if actions || (primary && !bp.isMobile)}
			<div bind:this={group} class="flex flex-none items-center gap-2">
				<BtnSizeScope size="auto">
					{@render actions?.()}
					{#if primary && !bp.isMobile}<PrimaryAction {primary} />{/if}
				</BtnSizeScope>
			</div>
		{/if}
	{/snippet}

	<header bind:this={head} class="flex min-w-0 flex-col">
		<h1 class="sr-only">{title}</h1>
		<div class="flex min-w-0 items-center gap-x-3 border-b-2 border-line">
			<!-- the strip overlaps the border of the row by its own 2 px: the orange mark of the current tab lies exactly on the grey line; on a phone it scrolls and the buttons stay at its end -->
			<div bind:this={strip} class={['-mb-0.5 min-w-0 flex-1 max-md:overflow-hidden', hasButtons && 'md:[&_.atmr-tabs-group]:[--atmr-tabitem-m-padding-bottom:calc(7.6px+6px)]']}>{@render tabs(false)}</div>
			{#if !stacked}<div class="ml-auto flex flex-none items-start justify-end self-start">{@render buttons()}</div>{/if}
		</div>
		{#if stacked}<div class="mt-4 flex justify-end">{@render buttons()}</div>{/if}
	</header>
{:else if !object}
	<h1 class="sr-only">{title}</h1>
	{#if actions || (primary && !bp.isMobile)}
		<div class="flex min-h-9 min-w-0 flex-wrap items-center justify-end gap-2">
			<BtnSizeScope size="auto">
				{@render actions?.()}
				{#if primary && !bp.isMobile}<PrimaryAction {primary} />{/if}
			</BtnSizeScope>
		</div>
	{/if}
{:else}
	<!-- pt: the back link (a 14 px line) is centred in the same 36 px first row (48 px on a phone) as the tabs, filters and buttons of every other page -->
		<header class="rtk-page-header flex min-w-0 flex-col gap-1.5 pt-2 max-md:pt-[15px]">
		{#if back}
			<a href={back} class="t-body-s -my-1.5 inline-flex items-center gap-1 self-start py-1.5 text-muted no-underline hover:text-fg hover:no-underline max-md:-my-3.5 max-md:py-3.5">
				<span class="inline-flex size-4 items-center justify-center [&_svg]:size-full [&_svg]:fill-current" aria-hidden="true"><ArrowLeft /></span>
				{backLabel ?? BACK_LABELS[back.split('?')[0]] ?? 'Назад'}
			</a>
		{/if}

		<div class="flex min-h-10 min-w-0 flex-wrap items-center gap-x-3 gap-y-2 max-md:gap-x-2">
			<!-- the title takes what is left (at least 10rem); chips and buttons that do not fit wrap under it, so a title is never squeezed into a column of letters -->
			<h1 class="t-h2 min-w-0 flex-[1_1_10rem] wrap-anywhere max-md:t-h3 max-md:flex-[1_1_12rem]">{title}</h1>

			{#if meta && !bp.isMobile}<div class="flex flex-none flex-wrap items-center gap-2">{@render meta()}</div>{/if}

			{#if actions || (primary && !bp.isMobile)}
				<div class="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
					<BtnSizeScope size="auto">
						{@render actions?.()}
						{#if primary && !bp.isMobile}<PrimaryAction {primary} />{/if}
					</BtnSizeScope>
				</div>
			{/if}
		</div>

		<!-- the lines under the title span the whole row and start on the same left edge as the title and every block below -->
		{#if subtitle || details || (meta && bp.isMobile)}
			<div class="flex min-w-0 flex-col gap-2">
				{#if meta && bp.isMobile}<div class="flex flex-wrap items-center gap-2">{@render meta()}</div>{/if}
				{#if subtitle}<p class="t-body-s text-muted max-md:t-desc-l">{subtitle}</p>{/if}
				{#if details}<div class="t-body-s flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-muted max-md:t-desc-l">{@render details()}</div>{/if}
			</div>
		{/if}
	</header>
{/if}

{#if primary && bp.isMobile}<PrimaryAction {primary} />{/if}

{@render children?.()}
