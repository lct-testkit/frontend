<script lang="ts" module>
	import type { Snippet } from 'svelte';

	export interface Col<Row> {
		/** row field to show (and the column's unique name) */
		key: string;
		title: string;
		/**
		 * The width of the column. Omitted / `'auto'` = it FITS ITS CONTENT (the widest cell or the title, never more — no empty space);
		 * `'minmax(180px, 2fr)'` = it takes a share of the free space (give this to the one or two columns that hold long text: a title, an organization);
		 * a number = a fixed width in px.
		 */
		width?: number | string;
		align?: 'left' | 'right';
		/** custom cell — wrap its content in `<TableCell>` (the DS strips the padding of custom cells) */
		render?: Snippet<[Row]>;
		/** the header becomes a sort button (needs `sort` + `onSort` on the table) */
		sortable?: boolean;
		/**
		 * Drop order when the table is too narrow (measured, not guessed from the screen width): the column with the LOWEST number goes first.
		 * Omit = never dropped. The room a column needs is the first number of its `width` (`minmax(140px, 2fr)` → 140).
		 */
		drop?: number;
		/** old screens: hide below a screen width — 'wide' ≥ 1280 px, 'desktop' ≥ 1024 px, 'tablet' ≥ 768 px. Prefer `drop` */
		showFrom?: 'wide' | 'desktop' | 'tablet';
	}

	export interface SortState {
		key: string;
		dir: 'asc' | 'desc';
	}
</script>

<script lang="ts" generics="Row extends { id: string | number }">
	// One list, two layouts: ≥ 768 px → the DS TableGrid, phone → cards (`card` snippet). It follows the DS CRM example
	// (rt-ui/src/routes/examples/crm/Organizations.svelte): sortable headers, checkbox selection with an action bar, a footer inside the table.
	// The table never sorts, filters or paginates by itself: pass the rows you have; sorting goes out through `onSort`, more rows through
	// `onLoadMore` (fires when the end scrolls into view; the button is the fallback). Every row is one line high — put a second
	// value into its own column, not under the first.
	import { tick, untrack } from 'svelte';
	import { TableGrid, type TableGridColumn } from '@lct-testkit/rt-ui/components/TableGrid';
	import { Checkbox } from '@lct-testkit/rt-ui';
	import { TableCards, useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import Btn from './Btn.svelte';
	import EmptyState from './EmptyState.svelte';
	import ErrorState from './ErrorState.svelte';
	import Skeleton from './Skeleton.svelte';

	interface Props {
		rows: Row[];
		columns: Col<Row>[];
		/** phone: the body of one card */
		card: Snippet<[Row]>;
		/** first page in flight */
		loading?: boolean;
		error?: unknown;
		onRetry?: () => void;
		/** replaces the default empty state */
		empty?: Snippet;
		emptyText?: string;
		onRowClick?: (row: Row) => void;
		sort?: SortState | null;
		onSort?: (next: SortState | null) => void;
		hasMore?: boolean;
		loadingMore?: boolean;
		onLoadMore?: () => void;
		/** «Найдено: 1 240» — when the backend knows the total; otherwise the footer counts what is loaded */
		total?: number;
		selectable?: boolean;
		selected?: string[];
		onSelectionChange?: (keys: string[]) => void;
		/** replaces the default bar for the selected rows: `<ActionBar onDelete=…/>` or your own buttons */
		actionBar?: Snippet;
		/** the table scrolls inside the page (header and footer stay): the parent must be a flex column with `min-height: 0` */
		fill?: boolean;
		ariaLabel?: string;
		id?: string;
		/** no frame of its own: the table sits inside a Card (which has one) — one border, not two */
		embedded?: boolean;
	}

	let {
		rows,
		columns,
		card,
		loading = false,
		error = null,
		onRetry,
		empty,
		emptyText = 'Ничего не найдено',
		onRowClick,
		sort = null,
		onSort,
		hasMore = false,
		loadingMore = false,
		onLoadMore,
		total,
		selectable = false,
		selected = [],
		onSelectionChange,
		actionBar,
		fill = false,
		ariaLabel,
		id = 'rt',
		embedded = false
	}: Props = $props();

	const bp = useBreakpoint();

	// the room the table really has (its own box, so a collapsed or expanded side menu is accounted for): columns that do not fit are dropped
	// in `drop` order instead of being cut off or scrolled sideways
	let area = $state<HTMLElement | null>(null);
	let areaWidth = $state(0);
	let areaHeight = $state(0);
	$effect(() => {
		if (!area) return;
		const observer = new ResizeObserver(() => {
			areaWidth = area!.clientWidth;
			areaHeight = area!.clientHeight;
		});
		observer.observe(area);
		return () => observer.disconnect();
	});

	// A column is never narrower than its own title: text (≈ 8.4 px a letter at 14 px) + the DS header padding (15 + 15 + 20) and, for a sortable
	// one, the sort icon (+ 22). Measured on the DS grid: «Приоритет» needs 126, «Сумма» with the sort icon 118. Without this the titles were cut («Сум…»).
	const headerNeed = (c: Col<Row>): number => Math.ceil(c.title.length * 8.4) + 4 + (c.sortable && onSort ? 72 : 50);
	const widthOf = (c: Col<Row>): number | string => {
		const width = c.width ?? 'auto';
		const need = headerNeed(c);
		if (width === 'auto' || width === 'max-content') return 'minmax(' + need + 'px, max-content)';
		if (typeof width === 'number') return Math.max(width, need);
		return width.replace(/^minmax\(\s*(\d+(?:\.\d+)?)px/, (_all, n) => 'minmax(' + Math.max(Number(n), need) + 'px');
	};

	// Which columns fit is MEASURED, not guessed. The grid is told for a moment that its auto columns take what their content needs (max-content) and its
	// share columns their minimum, the tracks are read back and summed; while the sum is wider than the table, the column with the lowest `drop` goes
	// (the write and the restore happen in one task, nothing is painted in between). So a chip, a date or a number is never cut in an auto column.
	const eligible = $derived(columns.filter((c) => !c.showFrom || (c.showFrom === 'wide' ? bp.width >= 1280 : c.showFrom === 'desktop' ? bp.isDesktop : !bp.isMobile)));
	let dropped = $state<string[]>([]);
	const visible = $derived(eligible.filter((c) => !dropped.includes(c.key)));

	let fitRun = 0;
	async function refit() {
		const run = ++fitRun;
		dropped = []; // every column back → measure them all
		await tick();
		const layout = area?.querySelector<HTMLElement>('.atmr-tablegrid__layout');
		if (run !== fitRun || !layout || !eligible.some((c) => c.drop !== undefined)) return;
		const specified = getComputedStyle(layout).getPropertyValue('--template-columns');
		if (!specified) return;
		const room = layout.clientWidth;
		const before = { template: layout.style.getPropertyValue('--template-columns'), width: layout.style.width };
		layout.style.setProperty('--template-columns', specified.replace(/minmax\(\s*([\d.]+px)\s*,\s*[\d.]+fr\s*\)/g, '$1'));
		layout.style.width = 'max-content';
		const tracks = getComputedStyle(layout).gridTemplateColumns.split(' ').map(parseFloat);
		if (before.template) layout.style.setProperty('--template-columns', before.template);
		else layout.style.removeProperty('--template-columns');
		layout.style.width = before.width;
		const offset = tracks.length - eligible.length; // the checkbox column of a selectable table comes first
		if (offset < 0 || tracks.some((t) => Number.isNaN(t))) return;
		let total = tracks.reduce((sum, t) => sum + t, 0);
		const next: string[] = [];
		for (const c of eligible.filter((x) => x.drop !== undefined).sort((a, b) => a.drop! - b.drop!)) {
			if (total <= room) break;
			total -= tracks[offset + eligible.indexOf(c)];
			next.push(c.key);
		}
		dropped = next;
	}
	// what makes the table fit again: its width, its rows, its columns
	$effect(() => {
		void areaWidth;
		void rows.length;
		void eligible;
		if (bp.isMobile) return;
		untrack(() => void refit());
	});

	function cycle(key: string) {
		if (!onSort) return;
		if (!sort || sort.key !== key) onSort({ key, dir: 'asc' });
		else if (sort.dir === 'asc') onSort({ key, dir: 'desc' });
		else onSort(null);
	}

	const gridColumns = $derived<TableGridColumn<Row>[]>(
		visible.map((c) => ({
			name: c.key,
			title: c.title,
			size: { width: widthOf(c) },
			align: c.align,
			render: c.render,
			sorting: c.sortable && onSort ? { sort: sort?.key === c.key ? sort.dir : 'default', onSort: () => cycle(c.key) } : undefined
		}))
	);

	// `fill`: the DS grid must get a MAX height (`containerStyle.maxHeight`) to scroll inside itself with a sticky header and footer.
	// A fixed height would squeeze its auto-sized rows (DS README), so the free height of the area is measured and passed as a maximum.
	const scrollInside = $derived(fill && !bp.isMobile && areaHeight > 0);

	const allSelected = $derived(rows.length > 0 && selected.length === rows.length);
	const count = $derived(total !== undefined ? `Найдено: ${total}` : `Показано: ${rows.length}`);

	// end-of-list sentinel → load more
	function inview(node: HTMLElement) {
		if (typeof IntersectionObserver === 'undefined') return;
		const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && onLoadMore?.(), { rootMargin: '240px' });
		io.observe(node);
		return { destroy: () => io.disconnect() };
	}
</script>

{#snippet selectAll()}
	<Checkbox variant="primary" checked={allSelected} indeterminate={selected.length > 0 && !allSelected} aria-label="Выбрать все" onChange={(v: boolean) => onSelectionChange?.(v ? rows.map((r) => String(r.id)) : [])} />
{/snippet}

{#snippet emptyView()}
	{#if empty}{@render empty()}{:else}<EmptyState title={emptyText} compact />{/if}
{/snippet}

{#snippet footer()}
	<div class="-ml-px flex min-h-10 items-center justify-between gap-3">
		<span class="t-body-s text-muted">{count}</span>
		{#if hasMore}
			<div use:inview><Btn label="Показать ещё" variant="outline" colorScheme="neutral" loading={loadingMore} onclick={() => onLoadMore?.()} /></div>
		{/if}
	</div>
{/snippet}

<div bind:this={area} class={['w-full min-w-0', fill && 'md:min-h-0 md:flex-1 md:basis-0 md:overflow-hidden']} aria-busy={loading || undefined}>
	{#if error}
		<ErrorState {error} {onRetry} />
	{:else if loading && rows.length === 0}
		<div class="rounded-lg border border-line bg-surface p-3"><Skeleton kind="rows" rows={6} /></div>
	{:else if bp.isMobile}
		{#if rows.length === 0}
			{@render emptyView()}
		{:else}
			<TableCards {rows} {card} {selectable} {selected} {onSelectionChange} {onRowClick} aria-label={ariaLabel} />
			{#if hasMore}<div class="flex justify-center p-3" use:inview><Btn label="Показать ещё" variant="outline" colorScheme="neutral" loading={loadingMore} onclick={() => onLoadMore?.()} /></div>{/if}
			{#if selectable && selected.length > 0 && actionBar}
				<div class="sticky bottom-0 z-(--atmr-z-index-sticky) flex items-center gap-2 rounded-md border border-line bg-surface p-3">{@render actionBar()}</div>
			{/if}
		{/if}
	{:else}
		<TableGrid
			{id}
			alignCells
			less={embedded}
			columns={gridColumns}
			{rows}
			columnConfig={{ sorting: onSort !== undefined }}
			headerSticky={scrollInside}
			footerSticky={scrollInside}
			style={{ width: '100%' }}
			containerStyle={scrollInside ? { maxHeight: areaHeight - 2 } : undefined}
			rowConfig={{
				onClick: onRowClick ? (rowId: string | number) => onRowClick(rows.find((r) => String(r.id) === String(rowId))!) : undefined,
				selection: selectable ? { defaultSelected: selected, onSelectionChange, renderFirstColumnHeader: selectAll } : undefined
			}}
			renders={{
				emptyTable: rows.length === 0 ? emptyView : undefined,
				footer: rows.length > 0 ? footer : undefined,
				actionBar: selectable && actionBar ? actionBar : undefined
			}}
		/>
	{/if}
</div>
