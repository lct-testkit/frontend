import { describe, expect, it } from 'vitest';
import { NO_ORG, NO_ORG_LABEL, buildDealSuccessors, buildOrganizationSuccessors, effectiveSuccessor, emptyChoice, groupByOrganization, pruneChoice, roundRobin, staleDealIds, summarizeAllocation, type DealItem } from './allocation';

const deal = (id: string, org: string | null = null): DealItem => ({ id, number: `D-${id}`, title: `Сделка ${id}`, organization_name: org });
const DEF = 'default';

describe('groupByOrganization', () => {
	it('складывает сделки по вузам; без вуза — группа «Физические лица» в конце', () => {
		const groups = groupByOrganization([deal('1', 'КГТУ'), deal('2'), deal('3', 'КГТУ'), deal('4', 'СУТИ'), deal('5', '  ')]);
		expect(groups.map((g) => [g.name, g.deals.length])).toEqual([
			['КГТУ', 2],
			['СУТИ', 1],
			[NO_ORG_LABEL, 2]
		]);
		expect(groups.at(-1)?.key).toBe(NO_ORG);
	});
	it('пустой список — пустой результат', () => {
		expect(groupByOrganization([])).toEqual([]);
	});
});

describe('buildDealSuccessors', () => {
	const deals = [deal('1', 'КГТУ'), deal('2', 'КГТУ'), deal('3', 'СУТИ'), deal('4')];
	it('не включает сделки, чей преемник равен умолчательному', () => {
		const choice = emptyChoice();
		expect(buildDealSuccessors(deals, choice, DEF)).toEqual({});
		choice.groups['КГТУ'] = 'anna';
		choice.deals['2'] = DEF; // отдельная сделка вернулась «как у всех» — сильнее выбора по вузу
		choice.deals['3'] = 'boris';
		expect(buildDealSuccessors(deals, choice, DEF)).toEqual({ '1': 'anna', '3': 'boris' });
	});
	it('выбор «как у всех» (null) не попадает в тело', () => {
		const choice = emptyChoice();
		choice.groups['КГТУ'] = null;
		choice.deals['3'] = null;
		expect(buildDealSuccessors(deals, choice, DEF)).toEqual({});
	});
	it('сделка сильнее вуза: effectiveSuccessor', () => {
		const choice = emptyChoice();
		choice.groups['КГТУ'] = 'anna';
		choice.deals['1'] = 'boris';
		expect(effectiveSuccessor(deals[0], choice, DEF)).toBe('boris');
		expect(effectiveSuccessor(deals[1], choice, DEF)).toBe('anna');
		expect(effectiveSuccessor(deals[3], choice, DEF)).toBe(DEF);
	});
});

describe('buildOrganizationSuccessors', () => {
	it('только вузы с другим ответственным', () => {
		const choice = emptyChoice();
		choice.orgs = { o1: 'anna', o2: DEF, o3: null };
		expect(buildOrganizationSuccessors([{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }, { id: 'o4' }], choice, DEF)).toEqual({ o1: 'anna' });
	});
});

describe('roundRobin', () => {
	const single = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `g${i}`, name: `g${i}`, deals: [deal(`d${i}`)] }));
	it('7 сделок и 3 кандидата дают 3-2-2 и не меняют порядок групп', () => {
		const groups = single(7);
		const out = roundRobin(groups, ['a', 'b', 'c']);
		const count = (c: string) => Object.values(out).filter((x) => x === c).length;
		expect([count('a'), count('b'), count('c')]).toEqual([3, 2, 2]);
		expect(Object.keys(out)).toEqual(groups.map((g) => g.key));
		expect(out.g0).toBe('a');
		expect(out.g1).toBe('b');
	});
	it('группа вуза уходит целиком одному кандидату; крупная группа уравновешивается мелкими', () => {
		const groups = [
			{ key: 'big', name: 'big', deals: [deal('1'), deal('2'), deal('3'), deal('4')] },
			{ key: 's1', name: 's1', deals: [deal('5')] },
			{ key: 's2', name: 's2', deals: [deal('6')] },
			{ key: 's3', name: 's3', deals: [deal('7')] }
		];
		const out = roundRobin(groups, ['a', 'b']);
		expect(out.big).toBe('a');
		expect([out.s1, out.s2, out.s3]).toEqual(['b', 'b', 'b']);
	});
	it('без кандидатов — пусто', () => {
		expect(roundRobin(single(3), [])).toEqual({});
	});
});

describe('summarizeAllocation', () => {
	it('считает сделки и вузы по преемникам и называет вузы; умолчательный первым', () => {
		const deals = [deal('1', 'КГТУ'), deal('2', 'КГТУ'), deal('3', 'СУТИ'), deal('4')];
		const choice = emptyChoice();
		choice.groups['КГТУ'] = 'anna';
		choice.deals['3'] = 'boris';
		choice.orgs = { o1: 'anna' };
		const s = summarizeAllocation(deals, [{ id: 'o1' }, { id: 'o2' }], choice, DEF);
		expect(s.map((x) => x.successorId)).toEqual([DEF, 'anna', 'boris']);
		expect(s[0]).toMatchObject({ deals: 1, organizations: 1, groups: [NO_ORG_LABEL] });
		expect(s[1]).toMatchObject({ deals: 2, organizations: 1, groups: ['КГТУ'] });
		expect(s[2]).toMatchObject({ deals: 1, groups: ['СУТИ'] });
	});
});

describe('pruneChoice', () => {
	it('после «Обновить список» выбор сохраняется по id, исчезнувшие сделки и вузы убираются', () => {
		const choice = { groups: { КГТУ: 'anna', Пропал: 'boris' }, deals: { '1': 'anna', '2': 'boris' }, orgs: { o1: 'anna', o9: 'boris' } };
		const next = pruneChoice(choice, [deal('1', 'КГТУ'), deal('3', 'КГТУ')], [{ id: 'o1' }]);
		expect(next).toEqual({ groups: { КГТУ: 'anna' }, deals: { '1': 'anna' }, orgs: { o1: 'anna' } });
	});
});

describe('staleDealIds', () => {
	it('вытаскивает id сделки из ошибки deal_successors', () => {
		const id = '01a14ebd-9d26-7003-aefa-c8a9618330b1';
		expect(staleDealIds([{ field: 'deal_successors', reason: id }, { field: 'reason', reason: 'x' }])).toEqual([id]);
		expect(staleDealIds([{ field: `deal_successors.${id}`, reason: 'сделка не принадлежит увольняемому' }])).toEqual([id]);
		expect(staleDealIds([])).toEqual([]);
	});
});
