import { describe, expect, it } from 'vitest';
import { ariaSort, headerSortKey, nextSort } from './table-sort';

describe('nextSort', () => {
	it('goes ascending, descending, off', () => {
		const first = nextSort(null, 'amount');
		expect(first).toEqual({ key: 'amount', dir: 'asc' });
		const second = nextSort(first, 'amount');
		expect(second).toEqual({ key: 'amount', dir: 'desc' });
		expect(nextSort(second, 'amount')).toBeNull();
	});
	it('another column starts again from ascending', () => {
		expect(nextSort({ key: 'amount', dir: 'desc' }, 'title')).toEqual({ key: 'title', dir: 'asc' });
	});
});

describe('ariaSort', () => {
	it('tells the state of the column, none for the others', () => {
		expect(ariaSort({ key: 'a', dir: 'asc' }, 'a')).toBe('ascending');
		expect(ariaSort({ key: 'a', dir: 'desc' }, 'a')).toBe('descending');
		expect(ariaSort({ key: 'a', dir: 'desc' }, 'b')).toBe('none');
		expect(ariaSort(null, 'a')).toBe('none');
	});
});

describe('headerSortKey', () => {
	const sortable = new Set(['number', 'amount']);
	it('a click on the title area of a sortable header sorts that column', () => {
		expect(headerSortKey('amount', sortable, false)).toBe('amount');
	});
	it('a plain header does nothing', () => {
		expect(headerSortKey('status', sortable, false)).toBeNull();
	});
	it('the design system button sorts by itself: no second sort', () => {
		expect(headerSortKey('amount', sortable, true)).toBeNull();
	});
	it('a header without a column name (the select-all cell) does nothing', () => {
		expect(headerSortKey(undefined, sortable, false)).toBeNull();
	});
});
