import { describe, expect, it } from 'vitest';
import { funnel14, stepId } from '../../config/workflows/fixtures/workflow14';
import type { DealRow } from '../deals/list/dealProducts';
import type { DealHistory } from '../types';
import { NO_PRODUCT, filterDeals, groupByProduct, journeyEvents, ribbon } from './journey';

const graph = funnel14();
const deal = (id: string, number: string, over: Partial<DealRow> = {}): DealRow =>
	({ id, number, title: `Сделка ${number}`, status_id: stepId(1), workflow_id: 'wf14', products: [], directions: [], ...over }) as unknown as DealRow;
const product = (id: string, name: string) => ({ product_id: id, product_name: name, product_code: id, direction_id: null, direction_name: null, quantity: 1, stream_number: null });
const change = (n: number, from: string | null, to: string, at: string, over: Record<string, unknown> = {}) => ({
	id: `c${n}`,
	from_status_id: from,
	to_status_id: to,
	changed_at: at,
	changed_by: 'u1',
	comment: null,
	attachments_count: 0,
	reason: 'manual',
	...over
});
const history = (statuses: ReturnType<typeof change>[], events: unknown[] = []): DealHistory => ({ statuses, events, next_events_cursor: null, next_statuses_cursor: null }) as unknown as DealHistory;

describe('groupByProduct', () => {
	it('сделка с двумя продуктами попадает в обе дорожки, без продуктов — в последнюю «Без продукта»', () => {
		const two = deal('a', 'D-2', { products: [product('p2', 'Python'), product('p1', 'Java')] });
		const none = deal('b', 'D-1');
		const one = deal('c', 'D-3', { products: [product('p2', 'Python')] });
		const lanes = groupByProduct([two, none, one]);
		expect(lanes.map((l) => l.name)).toEqual(['Java', 'Python', 'Без продукта']);
		expect(lanes[1].deals.map((d) => d.id)).toEqual(['a', 'c']);
		expect(lanes[0].deals.map((d) => d.id)).toEqual(['a']);
		expect(lanes[2].key).toBe(NO_PRODUCT);
	});
	it('пустой список — нет дорожек', () => expect(groupByProduct([])).toEqual([]));
});

describe('journeyEvents', () => {
	const d = deal('a', 'D-1', { status_id: stepId(4) });
	const h = history([
		change(1, null, stepId(1), '2026-10-01T09:00:00Z'),
		change(2, stepId(1), stepId(2), '2026-10-02T09:00:00Z', { comment: 'Контакт найден' }),
		change(3, stepId(4), stepId(6), '2026-10-05T09:00:00Z', { attachments_count: 1 }),
		change(4, stepId(6), stepId(4), '2026-10-06T09:00:00Z'),
		change(5, stepId(4), 'parked', '2026-10-07T09:00:00Z'),
		change(6, 'parked', stepId(4), '2026-10-08T09:00:00Z')
	]);
	const events = journeyEvents([{ deal: d, history: h, graph }]);

	it('новые сверху', () => expect(events.map((e) => e.id)).toEqual(['c6', 'c5', 'c4', 'c3', 'c2', 'c1']));
	it('виды переходов: создание, вперёд, через шаг с названием обойдённого, назад, заморозка, возобновление', () => {
		const kind = Object.fromEntries(events.map((e) => [e.id, e.kind]));
		expect(kind).toEqual({ c1: 'created', c2: 'forward', c3: 'skip', c4: 'back', c5: 'parked', c6: 'resume' });
		expect(events.find((e) => e.id === 'c3')?.skipped).toEqual(['Корректировка документов перед подписанием (опционально)']);
		expect(events.find((e) => e.id === 'c3')?.filesCount).toBe(1);
		expect(events.find((e) => e.id === 'c2')?.comment).toBe('Контакт найден');
	});
	it('период по дате перехода включительно', () => {
		expect(journeyEvents([{ deal: d, history: h, graph }], { from: '2026-10-05', to: '2026-10-06' }).map((e) => e.id)).toEqual(['c4', 'c3']);
	});
	it('сделки без истории пропускаются, история нескольких сделок сливается по времени', () => {
		const merged = journeyEvents([
			{ deal: d, history: h, graph },
			{ deal: deal('b', 'D-2'), history: history([change(9, null, stepId(1), '2026-10-03T09:00:00Z')]), graph },
			{ deal: deal('c', 'D-3'), history: null, graph }
		]);
		expect(merged.map((e) => e.id).slice(-3)).toEqual(['c9', 'c2', 'c1']);
		expect(merged.some((e) => e.dealId === 'c')).toBe(false);
	});
});

describe('ribbon', () => {
	it('пропуск шага 5 и возврат: шаг 5 пропущен, шаги правее текущего, где сделка была, — «earlier»', () => {
		const skipped = ribbon(graph, deal('a', 'D-1', { status_id: stepId(6) }), history([change(1, null, stepId(1), 'a'), change(2, stepId(4), stepId(6), 'b')]));
		expect(skipped[4].state).toBe('skipped');
		expect(skipped[5].state).toBe('current');
		const back = ribbon(graph, deal('a', 'D-1', { status_id: stepId(6) }), history([change(1, null, stepId(7), 'a'), change(2, stepId(7), stepId(6), 'b')]));
		expect(back[6].state).toBe('earlier');
	});
	it('без истории пропусков не рисуется', () => {
		expect(ribbon(graph, deal('a', 'D-1', { status_id: stepId(6) }), null)[4].state).toBe('done');
	});
	it('замороженная — «stopped» на шаге остановки', () => {
		const parked = ribbon(graph, deal('a', 'D-1', { status_id: 'parked' }), history([change(1, stepId(3), 'parked', 'a')]));
		expect(parked[2].state).toBe('stopped');
	});
});

describe('filterDeals', () => {
	const a = deal('a', 'D-1', { products: [product('p1', 'Java')], directions: [{ id: 'd1', name: 'ПО' }] });
	const b = deal('b', 'D-2');
	it('по продукту, по «без продукта» и по направлению', () => {
		expect(filterDeals([a, b], { product: 'p1' })).toEqual([a]);
		expect(filterDeals([a, b], { product: NO_PRODUCT })).toEqual([b]);
		expect(filterDeals([a, b], { direction: 'd1' })).toEqual([a]);
		expect(filterDeals([a, b], {})).toEqual([a, b]);
	});
});
