import { describe, expect, it } from 'vitest';
import type { Branch } from '../types';
import { branchRows, descendantIds, parentOptions } from './branchTree';

const b = (id: string, name: string, parent_id: string | null = null): Branch => ({ id, name, parent_id, address: null, organization_id: 'o', created_at: '2026-10-18T00:00:00Z' });
const list = [b('3', 'Институт ИТ', '1'), b('1', 'Главный кампус'), b('2', 'Филиал Север'), b('4', 'Кафедра', '3')];

describe('филиалы', () => {
	it('дерево: родитель, потом его дети, по алфавиту', () => {
		const rows = branchRows(list);
		expect(rows.map((r) => `${r.depth}:${r.branch.name}`)).toEqual(['0:Главный кампус', '1:Институт ИТ', '2:Кафедра', '0:Филиал Север']);
		expect(rows[0].children).toBe(1);
	});
	it('родитель вне списка — корень', () => {
		expect(branchRows([b('9', 'Сирота', 'нет')])[0].depth).toBe(0);
	});
	it('потомки и варианты родителя без цикла', () => {
		expect([...descendantIds(list, '1')].sort()).toEqual(['1', '3', '4']);
		expect(parentOptions(list, '1').map((o) => o.key)).toEqual(['2']);
		expect(parentOptions(list, null)).toHaveLength(4);
		expect(parentOptions(list, null)[1].value).toBe('— Институт ИТ');
	});
});
