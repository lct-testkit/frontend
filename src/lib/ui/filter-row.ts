// The filters of a list stand in ONE row of 36 px controls (search, fields, buttons); a field there has no caption line above it — its caption is the
// placeholder («Статус», «Ответственный»), so every first row of every page is the same height and starts on the same line under the top bar.
// In the phone panel and in the «Фильтры» side panel the fields are stacked and keep their labels: the wrappers ask this context which one they are in.
import { getContext } from 'svelte';

export const FILTER_ROW = Symbol('rtk-filter-row');

/** true inside the desktop filter row (see FilterRow.svelte); call it while the component initialises */
export function inFilterRow(): boolean {
	return getContext<boolean | undefined>(FILTER_ROW) ?? false;
}
