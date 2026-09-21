<script lang="ts">
	// Search + filters of a list, one row, as in the DS CRM example (`.orgs__filters`): the search takes the widest share of the row,
	// the main filters are labelled fields (DS Select / Multiselect / InputDate / pickers) that share what is left; «Сбросить» appears only
	// when something is on. Rarely used filters go into `more`: one «Фильтры» button (with the count of what is on inside) opens them in a
	// side panel — the row stays one line. When the row still does not fit it wraps; nothing hides behind a button by accident.
	// Phone (DS pattern): the search field and one «Фильтры» button with the count; all fields open in a panel with «Сбросить» / «Показать».
	import { untrack, type Snippet } from 'svelte';
	import { Counter } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { Filter } from '@lct-testkit/rt-ui/icons';
	import AppDrawer from './AppDrawer.svelte';
	import Btn from './Btn.svelte';
	import FilterRow from './FilterRow.svelte';
	import IconBtn from './IconBtn.svelte';
	import PrimaryAction, { type Primary } from './PrimaryAction.svelte';
	import SearchField from './SearchField.svelte';

	interface Props {
		search?: string;
		placeholder?: string;
		/** without a handler the search field is not shown */
		onSearch?: (value: string) => void;
		/** how many filters (not counting the search) are on, in the row and in `more` together */
		active?: number;
		onReset?: () => void;
		/** the main fields, up to about three: give each one a `label` */
		filters?: Snippet;
		/** the rest of the fields, in a side panel */
		more?: Snippet;
		/** how many of the fields in `more` are on: the number on the button */
		moreActive?: number;
		/** the right end of the row: refresh, export, a view switch… (the page's buttons stand here, not on a title line) */
		trailing?: Snippet;
		/** THE create-action of the page: the orange button at the very end of the row (a floating button on a phone) */
		primary?: Primary;
		/** phone: the number on the «Показать» button of the panel */
		found?: number;
	}

	let { search = '', placeholder = 'Поиск', onSearch, active = 0, onReset, filters, more, moreActive = 0, trailing, primary, found }: Props = $props();

	const bp = useBreakpoint();
	let panel = $state(false);
	let drawer = $state(false);
	// filters that arrive switched on (a shared link) are visible at once on a phone
	$effect(() => {
		if (untrack(() => active) > 0) panel = true;
	});
</script>

{#if bp.isMobile}
	<div class="flex min-w-0 flex-col gap-3" role="search">
		<div class="flex items-center gap-2">
			{#if onSearch}<div class="min-w-0 flex-1"><SearchField value={search} {placeholder} {onSearch} size="l" /></div>{/if}
			{#if filters || more}
				<div class={['relative', onSearch ? 'flex-none' : 'flex-1']}>
					{#if onSearch}
						<IconBtn icon={Filter} label="Фильтры" variant={panel ? 'secondary' : 'outline'} size="l" onclick={() => (panel = !panel)} aria-expanded={panel} data-testid="filters-toggle" />
					{:else}
						<Btn label="Фильтры" icon={Filter} count={active} variant={panel ? 'secondary' : 'outline'} colorScheme="neutral" size="l" block onclick={() => (panel = !panel)} aria-expanded={panel} data-testid="filters-toggle" />
					{/if}
					{#if active > 0 && onSearch}<span class="pointer-events-none absolute -top-1 -right-1 rounded-full ring-2 ring-page"><Counter size="xs">{active}</Counter></span>{/if}
				</div>
			{/if}
			{#if trailing}<div class="flex flex-none items-center gap-2">{@render trailing()}</div>{/if}
		</div>
		{#if primary}<PrimaryAction {primary} />{/if}
		{#if (filters || more) && panel}
			<div class="flex flex-col gap-3 rounded-md border border-line bg-surface p-3" data-testid="filters-panel">
				{@render filters?.()}
				{@render more?.()}
				<div class="flex gap-3 *:flex-1">
					{#if onReset}<Btn label="Сбросить" variant="outline" colorScheme="neutral" size="l" onclick={onReset} />{/if}
					<Btn label={found === undefined ? 'Готово' : `Показать: ${found}`} size="l" onclick={() => (panel = false)} />
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="flex min-w-0 flex-wrap items-center gap-3" role="search">
		{#if onSearch}<div class="min-w-56 flex-[1.6_1_14rem]"><SearchField value={search} {placeholder} {onSearch} size="m" /></div>{/if}
		{#if filters}<div class="contents *:max-w-72 *:min-w-36 *:flex-[1_1_9rem]"><FilterRow>{@render filters()}</FilterRow></div>{/if}
		{#if more}
			<Btn label="Фильтры" icon={Filter} count={moreActive} variant="outline" colorScheme="neutral" onclick={() => (drawer = true)} data-testid="filters-more" />
		{/if}
		{#if onReset && active > 0}<Btn label="Сбросить" variant="ghost" colorScheme="neutral" onclick={onReset} data-testid="filters-reset" />{/if}
		{#if trailing || primary}
			<div class="ml-auto flex flex-none items-center gap-2">
				{@render trailing?.()}
				{#if primary}<PrimaryAction {primary} />{/if}
			</div>
		{/if}
	</div>

	{#if more}
		<AppDrawer open={drawer} title="Фильтры" width={420} onClose={() => (drawer = false)}>
			{@render more()}
			{#snippet footer()}
				<Btn label="Готово" onclick={() => (drawer = false)} />
				{#if onReset}<Btn label="Сбросить" variant="outline" colorScheme="neutral" disabled={active === 0} onclick={onReset} />{/if}
			{/snippet}
		</AppDrawer>
	{/if}
{/if}
