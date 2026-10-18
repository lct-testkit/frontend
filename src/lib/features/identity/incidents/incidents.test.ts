import { describe, expect, it } from 'vitest';
import {
	INCIDENT_STATUSES,
	STATUS_HINTS,
	combineDateTime,
	contactMissing,
	currentDeadline,
	deadlineInfo,
	incidentActions,
	incidentStatusMeta,
	incidentStepIndex,
	noticeRows,
	severityMeta,
	statusTab,
	tabStatuses
} from './incidents';

const NOW = Date.parse('2026-10-18T12:00:00Z');
const h = (n: number) => new Date(NOW + n * 3_600_000).toISOString();

describe('статусы', () => {
	it('у каждого статуса сервера есть подпись и подсказка, неизвестный показывается как есть', () => {
		for (const s of INCIDENT_STATUSES) {
			expect(incidentStatusMeta(s).label).not.toBe(s);
			expect(STATUS_HINTS[s].length).toBeGreaterThan(10);
		}
		expect(incidentStatusMeta('новый')).toEqual({ label: 'новый', tone: 'neutral' });
		expect(severityMeta('critical')).toEqual({ label: 'Высокая', tone: 'error' });
	});
	it('вкладки: неизвестная — «Все»; «В работе» — три статуса, «Все» — без фильтра', () => {
		expect(statusTab('active')).toBe('active');
		expect(statusTab('что-то')).toBe('all');
		expect(statusTab(null)).toBe('all');
		expect(tabStatuses('active')).toEqual(['open', 'rkn_24_sent', 'rkn_72_sent']);
		expect(tabStatuses('all')).toBeUndefined();
	});
	it('шаги: индекс — шаг, который ждёт выполнения; закрыт на последнем, отклонённый на нуле', () => {
		expect(incidentStepIndex('candidate')).toBe(1);
		expect(incidentStepIndex('open')).toBe(2);
		expect(incidentStepIndex('rkn_24_sent')).toBe(3);
		expect(incidentStepIndex('closed')).toBe(4);
		expect(incidentStepIndex('dismissed')).toBe(0);
	});
});

describe('deadlineInfo', () => {
	it('отправлено — срок уже не важен', () => {
		expect(deadlineInfo(h(-10), h(-12), NOW).state).toBe('sent');
	});
	it('идёт с запасом, меньше 6 часов, просрочено', () => {
		expect(deadlineInfo(h(20), null, NOW)).toMatchObject({ state: 'ok', tone: 'info' });
		expect(deadlineInfo(h(20), null, NOW).label).toMatch(/^Осталось 20.ч 00.мин$/);
		expect(deadlineInfo(h(5), null, NOW)).toMatchObject({ state: 'soon', tone: 'warning' });
		expect(deadlineInfo(h(-2), null, NOW)).toMatchObject({ state: 'overdue', tone: 'error' });
		expect(deadlineInfo(h(-2), null, NOW).label).toMatch(/^Просрочено на 2.ч 00.мин$/);
	});
	it('срока нет или он кривой', () => {
		expect(deadlineInfo(null, null, NOW).state).toBe('none');
		expect(deadlineInfo('не дата', null, NOW).state).toBe('none');
	});
});

describe('currentDeadline', () => {
	const base = { rkn_24_due_at: h(10), rkn_24_sent_at: null, rkn_72_due_at: h(60), rkn_72_sent_at: null };
	it('открытый — 24 часа, после первой отправки — 72 часа, остальные — ничего', () => {
		expect(currentDeadline({ ...base, status: 'open' }, NOW)?.stage).toBe('24h');
		expect(currentDeadline({ ...base, status: 'rkn_24_sent', rkn_24_sent_at: h(-1) }, NOW)?.stage).toBe('72h');
		expect(currentDeadline({ ...base, status: 'candidate' }, NOW)).toBeNull();
		expect(currentDeadline({ ...base, status: 'closed' }, NOW)).toBeNull();
	});
});

describe('incidentActions', () => {
	it('аудитору — ничего', () => {
		expect(incidentActions('open', false)).toEqual({ confirm: false, edit: false, stage: null, subjects: false, close: false, dismiss: false });
	});
	it('кандидат: подтвердить, править, отклонить; уведомлений и закрытия нет', () => {
		expect(incidentActions('candidate', true)).toEqual({ confirm: true, edit: true, stage: null, subjects: false, close: false, dismiss: true });
	});
	it('открытый — стадия 24h, после отправки — 72h, затем только субъекты и закрытие', () => {
		expect(incidentActions('open', true)).toMatchObject({ stage: '24h', subjects: true, close: true, confirm: false });
		expect(incidentActions('rkn_24_sent', true).stage).toBe('72h');
		expect(incidentActions('rkn_72_sent', true)).toMatchObject({ stage: null, subjects: true, close: true });
	});
	it('закрытый и отклонённый — без действий', () => {
		for (const s of ['closed', 'dismissed']) expect(incidentActions(s, true)).toEqual({ confirm: false, edit: false, stage: null, subjects: false, close: false, dismiss: false });
	});
});

describe('noticeRows / contactMissing', () => {
	it('показывает известные поля в порядке формы, пустые и технические пропускает', () => {
		const rows = noticeRows({ file_id: 'x', stage: '24h', incident_summary: 'утечка', measures: 'закрыли доступ', probable_harm: '', subjects_estimate: 5, number: 'INC-1', detected_at: '2026-10-18T21:41:00+00:00' });
		expect(rows.map((r) => r.key)).toEqual(['number', 'detected_at', 'incident_summary', 'subjects_estimate', 'measures']);
		expect(rows.find((r) => r.key === 'detected_at')?.value).not.toContain('T21');
		expect(rows.find((r) => r.key === 'subjects_estimate')?.value).toBe('5');
		expect(noticeRows(null)).toEqual([]);
	});
	it('контакт для РКН не заполнен — серверная пометка «не указано»', () => {
		expect(contactMissing({ rkn_contact: 'не указано (заполните pdn.rkn_contact в системных настройках)' })).toBe(true);
		expect(contactMissing({ rkn_contact: 'Иванов И.И.' })).toBe(false);
		expect(contactMissing(undefined)).toBe(false);
	});
});

describe('combineDateTime', () => {
	it('дата и время → момент; неполное или кривое — null', () => {
		const d = combineDateTime('2026-10-18', '09:05');
		expect(d?.getFullYear()).toBe(2026);
		expect(d?.getHours()).toBe(9);
		expect(d?.getMinutes()).toBe(5);
		expect(combineDateTime('2026-10-18', '25:00')).toBeNull();
		expect(combineDateTime(null, '09:05')).toBeNull();
		expect(combineDateTime('2026-10-18', '')).toBeNull();
	});
});
