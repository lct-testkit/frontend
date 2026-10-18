// Роли и клавиатура для таблицы DS: сам TableGrid ставит строкам role=row и tabindex=0, но не table, не columnheader и не имя.
// Строки DS — `display: contents`, браузер не даёт им фокус (проверено: row.focus() ничего не делает), поэтому с клавиатуры строку открывают ссылкой в её
// первой ячейке, а у строк без ссылки (справочники, пользователи) «скользящую» остановку получает первая ячейка: Tab заходит один раз,
// стрелки идут по строкам, Enter и пробел открывают (DataTable.rowKeydown).
export interface TableA11y {
	label?: string;
	rows: number;
	total?: number;
	hasMore: boolean;
	/** строки что-то делают (открывают, выбираются): только тогда они достижимы с клавиатуры */
	interactive: boolean;
}

const ROW = '[data-table-row="true"]';

export function tableA11y(node: HTMLElement, initial: TableA11y) {
	let current = initial;
	let active: HTMLElement | null = null;
	const dataRows = (grid: HTMLElement) => [...grid.querySelectorAll<HTMLElement>(ROW)].slice(1); // первая — заголовок
	const stopOf = (row: HTMLElement) => (row.querySelector('a[href]') ? null : row.querySelector<HTMLElement>('.atmr-tablegrid__cell'));

	function apply() {
		const grid = node.querySelector<HTMLElement>('.atmr-tablegrid__layout');
		if (!grid) return;
		grid.setAttribute('role', 'table');
		if (current.label) grid.setAttribute('aria-label', current.label);
		grid.setAttribute('aria-rowcount', String(current.total ?? (current.hasMore ? -1 : current.rows + 1)));
		for (const cell of grid.querySelectorAll('.atmr-tablegrid__cell--header[data-header-cell-name]')) cell.setAttribute('role', 'columnheader');
		const rows = dataRows(grid);
		if (!active?.isConnected || !rows.includes(active)) active = rows.find((r) => stopOf(r)) ?? null;
		for (const row of [grid.querySelector<HTMLElement>(ROW), ...rows]) if (row && row.tabIndex !== -1) row.tabIndex = -1; // DS: tabindex=0 на строке, которой фокус всё равно не дать
		rows.forEach((row, i) => {
			row.setAttribute('aria-rowindex', String(i + 2));
			const stop = stopOf(row);
			if (stop) stop.tabIndex = current.interactive && row === active ? 0 : -1;
		});
	}

	function onFocusIn(event: FocusEvent) {
		const row = (event.target as HTMLElement).closest<HTMLElement>(ROW);
		if (row && row !== active && stopOf(row) === event.target) {
			active = row;
			apply();
		}
	}
	function onKeydown(event: KeyboardEvent) {
		const target = event.target as HTMLElement;
		const row = target.closest<HTMLElement>(ROW);
		if (!row || stopOf(row) !== target || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const rows = dataRows(row.parentElement as HTMLElement).filter((r) => stopOf(r));
		const i = rows.indexOf(row);
		const next = event.key === 'ArrowDown' ? rows[i + 1] : event.key === 'ArrowUp' ? rows[i - 1] : event.key === 'Home' ? rows[0] : rows[rows.length - 1];
		if (!next) return;
		event.preventDefault();
		active = next;
		apply();
		stopOf(next)?.focus();
	}

	const observer = new MutationObserver(apply); // DS перерисовывает строки при сортировке, подгрузке, смене колонок
	observer.observe(node, { childList: true, subtree: true });
	node.addEventListener('focusin', onFocusIn);
	node.addEventListener('keydown', onKeydown);
	apply();
	return {
		update(next: TableA11y) {
			current = next;
			apply();
		},
		destroy() {
			observer.disconnect();
			node.removeEventListener('focusin', onFocusIn);
			node.removeEventListener('keydown', onKeydown);
		}
	};
}
