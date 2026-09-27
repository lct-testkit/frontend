// Sorting rules of DataTable, kept apart from the component so they can be tested: which way a column goes next, what a screen reader is told,
// and which header clicks sort. The table never sorts anything itself; it only reports the next state to the page (`onSort`).

export interface SortState {
	key: string;
	dir: 'asc' | 'desc';
}

/** one click on a header: not sorted → ascending → descending → back to the order the server gave */
export function nextSort(current: SortState | null, key: string): SortState | null {
	if (!current || current.key !== key) return { key, dir: 'asc' };
	return current.dir === 'asc' ? { key, dir: 'desc' } : null;
}

/** `aria-sort` of a column header */
export function ariaSort(current: SortState | null, key: string): 'ascending' | 'descending' | 'none' {
	if (!current || current.key !== key) return 'none';
	return current.dir === 'asc' ? 'ascending' : 'descending';
}

/**
 * The column a click on a header cell sorts — or `null` when it sorts nothing: the column is not sortable (its title must stay a plain label), or the
 * click landed on the design system's own sort button (which already sorts; a second `sort` would flip the column twice).
 */
export function headerSortKey(columnKey: string | undefined, sortable: ReadonlySet<string>, onSortButton: boolean): string | null {
	if (onSortButton || columnKey === undefined || !sortable.has(columnKey)) return null;
	return columnKey;
}
