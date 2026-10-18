import { describe, expect, it } from 'vitest';
import { cursorLines, intervalLabel, parseRun, pullBlocked, runChip, runCounts } from './sourceState';

const cmsRun = { trigger: 'manual', finished_at: '2026-10-18T10:00:00+00:00', fetched: 5, created: 3, duplicates: 1, failed: 0, skipped: 1, error: null, status: 'ok' };

describe('parseRun', () => {
	it('пустой и чужой объект — null', () => {
		expect(parseRun(null)).toBeNull();
		expect(parseRun({})).toBeNull();
		expect(parseRun('x')).toBeNull();
	});
	it('сайт: created читается как «применено»; LMS: applied', () => {
		expect(parseRun(cmsRun)).toMatchObject({ applied: 3, duplicates: 1, trigger: 'manual' });
		expect(parseRun({ finished_at: '2026-10-18T10:00:00Z', fetched: 2, applied: 2, skipped: 0, failed: 0 })).toMatchObject({ applied: 2, duplicates: null });
	});
	it('запуск с одной ошибкой без счётчиков тоже виден', () => {
		expect(parseRun({ finished_at: 'x', error: 'Нет связи' })).toMatchObject({ error: 'Нет связи', fetched: null });
	});
});

describe('runChip', () => {
	it('нет запусков, успех, частичный успех, ошибка', () => {
		expect(runChip(null)).toEqual({ label: 'Не запускался', tone: 'neutral' });
		expect(runChip(parseRun(cmsRun))).toEqual({ label: 'Успешно', tone: 'success' });
		expect(runChip(parseRun({ ...cmsRun, failed: 2 }))).toEqual({ label: 'Частично', tone: 'warning' });
		expect(runChip(parseRun({ ...cmsRun, error: 'Сайт не ответил' }))).toEqual({ label: 'Ошибка', tone: 'error' });
	});
});

describe('runCounts', () => {
	it('сайт: создано и дубликаты; LMS: применено', () => {
		expect(runCounts(parseRun(cmsRun), 'cms').map((c) => `${c.label} ${c.value}`)).toEqual(['получено 5', 'создано 3', 'дубликатов 1', 'пропущено 1', 'с ошибкой 0']);
		expect(runCounts(parseRun({ finished_at: 'x', fetched: 4, applied: 3, skipped: 1, failed: 0 }), 'lms').map((c) => c.label)).toEqual(['получено', 'применено', 'пропущено', 'с ошибкой']);
	});
	it('строки с ошибкой подсвечены', () => {
		expect(runCounts(parseRun({ ...cmsRun, failed: 2 }), 'cms').find((c) => c.label === 'с ошибкой')?.tone).toBe('error');
	});
});

describe('cursorLines', () => {
	it('пустые курсоры скрыты, известные названы по-русски, неизвестные — кодом', () => {
		expect(cursorLines({ leads_updated_since: '2026-10-18T09:00:00Z', students_progress: null, other: 'v' })).toEqual([
			{ key: 'leads_updated_since', label: 'Заявки с сайта', value: '2026-10-18T09:00:00Z', text: expect.stringMatching(/^до 18\.10\.2026, \d\d:\d\d$/) },
			{ key: 'other', label: 'other', value: 'v', text: 'v' }
		]);
		expect(cursorLines(undefined)).toEqual([]);
	});
});

describe('pullBlocked / intervalLabel', () => {
	it('выключенный источник и Bitrix24 называют причину', () => {
		expect(pullBlocked({ code: 'cms', is_active: false })).toMatch(/отключён/);
		expect(pullBlocked({ code: 'bitrix24', is_active: true })).toMatch(/Bitrix24/);
		expect(pullBlocked({ code: 'lms', is_active: true })).toBeNull();
	});
	it('интервал: часы, минуты, секунды', () => {
		expect(intervalLabel(1800)).toBe('30 мин');
		expect(intervalLabel(3600)).toBe('1 ч');
		expect(intervalLabel(90)).toBe('90 с');
	});
});

describe('disableMessage', () => {
	it('для LMS называет остановку забора, для остальных — приём сообщений', async () => {
		const { disableMessage } = await import('./sourceState');
		expect(disableMessage('lms')).toMatch(/забор прогресса/);
		expect(disableMessage('cms')).toMatch(/Входящие сообщения/);
		expect(disableMessage('bitrix24')).toMatch(/Входящие сообщения/);
	});
});

describe('sourcesSummary', () => {
	const src = (is_active: boolean, last_error: string | null = null, name = 'S') => ({ is_active, name, last_error });
	it('включено 1 из 3, все отключены, ошибка у включённого', async () => {
		const { sourcesSummary } = await import('./sourceState');
		expect(sourcesSummary([])).toBeNull();
		expect(sourcesSummary([src(true), src(false), src(false)])).toEqual({ text: 'Включено источников: 1 из 3', tone: 'neutral' });
		expect(sourcesSummary([src(true), src(true)])?.tone).toBe('success');
		expect(sourcesSummary([src(false), src(false)])).toEqual({ text: 'Все источники отключены', tone: 'warning' });
		expect(sourcesSummary([src(true, 'нет связи', 'Сайт'), src(false, 'старая')])).toEqual({ text: 'Ошибка забора: Сайт', tone: 'error' });
	});
});
