import { describe, expect, it } from 'vitest';
import type { StageItem } from '../../types';
import { STAGE_STATES, stageEvidence, stageSla, stageTime, stageVisitsNote, stagesSummary } from './stages';

const ev = (required: string[], attached: string[], ok: boolean): StageItem['evidence'] => ({ required, attached, ok });

describe('этапы сделки', () => {
	it('время: не посещённый этап — прочерк, посещённый — длительность', () => {
		expect(stageTime({ state: 'pending', visits: 0, time_spent_seconds: 0 })).toBe('—');
		expect(stageTime({ state: 'done', visits: 1, time_spent_seconds: 90_000 })).toBe('1 д 1 ч');
		expect(stageTime({ state: 'current', visits: 1, time_spent_seconds: 20 })).toBe('меньше минуты');
	});

	it('заходы: только при возвратах', () => {
		expect(stageVisitsNote(0)).toBe('');
		expect(stageVisitsNote(1)).toBe('');
		expect(stageVisitsNote(2)).toBe('2 захода');
		expect(stageVisitsNote(5)).toBe('5 заходов');
	});

	it('срок: без срока, просрочен, в срок, впереди', () => {
		expect(stageSla({ sla_hours: null, sla_breached: null, state: 'done' }).text).toBe('без срока');
		expect(stageSla({ sla_hours: 72, sla_breached: true, state: 'done' })).toEqual({ text: 'Просрочен · срок 3 дн.', tone: 'error' });
		expect(stageSla({ sla_hours: 1, sla_breached: false, state: 'current' })).toEqual({ text: 'В срок · 1 ч', tone: 'success' });
		expect(stageSla({ sla_hours: 0.05, sla_breached: false, state: 'pending' })).toEqual({ text: 'срок 3 мин', tone: 'neutral' });
	});

	it('вложения: нет требований, всё приложено, не хватает', () => {
		expect(stageEvidence({ evidence: ev([], [], true) }).kind).toBe('none');
		expect(stageEvidence({ evidence: ev(['contract'], ['contract'], true) })).toMatchObject({ kind: 'ok', text: 'Договор', tone: 'success' });
		expect(stageEvidence({ evidence: ev(['contract', 'act'], ['act'], false) })).toMatchObject({ kind: 'missing', text: 'Нет: Договор', tone: 'warning' });
	});

	it('сводка и подписи состояний', () => {
		const data = { summary: { done: 8, current: 1, skipped: 1, pending: 4, sla_breached: 0 }, items: new Array(14) as StageItem[] };
		expect(stagesSummary(data)).toBe('Пройдено 8 из 14 · пропущено 1 · просрочек нет');
		expect(stagesSummary({ ...data, summary: { ...data.summary, skipped: 0, sla_breached: 2 } })).toBe('Пройдено 8 из 14 · просрочено по сроку: 2');
		// ST-2: «Обсуждение (4)» против суммы столбца «Комм.»
		const onStages = data.items.reduce((n, i) => n + i.comments_count, 0);
		expect(stagesSummary(data, onStages + 3)).toContain(`комментарии на этапах: ${onStages} из ${onStages + 3}`);
		expect(stagesSummary(data, onStages)).toBe('Пройдено 8 из 14 · пропущено 1 · просрочек нет');
		expect(stagesSummary(data, null)).toBe('Пройдено 8 из 14 · пропущено 1 · просрочек нет');
		expect(STAGE_STATES.current.label).toBe('Сейчас');
	});
});
