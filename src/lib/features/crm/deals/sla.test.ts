import { describe, expect, it } from 'vitest';
import { MS_HOUR } from '../shared/duration';
import { slaColorScheme, slaLabel, slaProgress } from './sla';

const T0 = Date.parse('2026-09-21T09:00:00Z');
const deal = (overrides: Partial<Parameters<typeof slaProgress>[0]> = {}) => ({
	status_changed_at: new Date(T0).toISOString(),
	sla_due_at: new Date(T0 + 10 * MS_HOUR).toISOString(),
	sla_state: 'ok',
	closed_at: null,
	...overrides
});

describe('slaProgress', () => {
	it('в норме, пока прошло меньше 75% срока', () => {
		const p = slaProgress(deal(), T0 + 5 * MS_HOUR);
		expect(p.state).toBe('ok');
		expect(p.fraction).toBeCloseTo(0.5);
		expect(p.remainingMs).toBe(5 * MS_HOUR);
		expect(p.overdueMs).toBeNull();
		expect(slaLabel(p)).toBe('Осталось 5 ч');
	});

	it('предупреждение с 75% (порог воркера бэкенда), даже если sla_state ещё "ok"', () => {
		const p = slaProgress(deal({ sla_state: 'ok' }), T0 + 8 * MS_HOUR);
		expect(p.state).toBe('warning');
		expect(p.fraction).toBeCloseTo(0.8);
	});

	it('нарушение после дедлайна с длительностью просрочки', () => {
		const p = slaProgress(deal(), T0 + 11 * MS_HOUR);
		expect(p.state).toBe('breached');
		expect(p.overdueMs).toBe(MS_HOUR);
		expect(p.remainingMs).toBeNull();
		expect(slaLabel(p)).toBe('Просрочено на 1 ч');
		expect(slaColorScheme(p.state)).toBe('error');
	});

	it('пауза (статус parked) — без дроби и остатка', () => {
		const p = slaProgress(deal({ sla_state: 'paused', sla_due_at: null }), T0);
		expect(p.state).toBe('paused');
		expect(p.fraction).toBeNull();
		expect(slaLabel(p)).toBe('На паузе');
	});

	it('закрытая сделка и статус без правила — таймера нет', () => {
		expect(slaProgress(deal({ closed_at: new Date(T0).toISOString() }), T0 + MS_HOUR).state).toBe('none');
		expect(slaProgress(deal({ sla_due_at: null }), T0).state).toBe('none');
		expect(slaLabel(slaProgress(deal({ sla_due_at: null }), T0))).toBe('—');
		expect(slaColorScheme('none')).toBe('neutral');
	});

	it('не падает на мусорных датах', () => {
		expect(slaProgress(deal({ status_changed_at: 'вчера' }), T0).state).toBe('none');
	});
});

describe('slaLabel: короткая форма для плотных мест', () => {
	it('просрочка со знаком минус, остаток без слов, пауза одним словом', () => {
		const breached = slaProgress(deal({ sla_due_at: new Date(T0 - 3_600_000).toISOString(), status_changed_at: new Date(T0 - 7_200_000).toISOString() }), T0);
		expect(slaLabel(breached, true)).toBe('−1 ч');
		const left = slaProgress(deal({ sla_due_at: new Date(T0 + 5 * 3_600_000).toISOString(), status_changed_at: new Date(T0 - 3_600_000).toISOString() }), T0);
		expect(slaLabel(left, true)).toBe('5 ч');
		expect(slaLabel(slaProgress(deal({ sla_state: 'paused' }), T0), true)).toBe('Пауза');
	});
});
