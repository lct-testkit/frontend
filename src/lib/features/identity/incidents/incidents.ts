// Инциденты ПДн (152-ФЗ ст. 21 ч. 3.1): статусы, сроки уведомления РКН (24 и 72 часа), какие действия доступны, подписи полей уведомления.
// Решения принимает человек: система считает сроки, формирует тексты и фиксирует «отправлено»; подачу на портал РКН делает сам администратор.
import type { components } from '$lib/api';
import { formatDateTime, formatDuration } from '$lib/utils/format';
import type { StatusMeta } from '../types';

export type Incident = components['schemas']['IncidentOut'];
export type IncidentStage = '24h' | '72h';

export const INCIDENT_STATUSES = ['candidate', 'open', 'rkn_24_sent', 'rkn_72_sent', 'closed', 'dismissed'] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

const STATUS: Record<IncidentStatus, StatusMeta> = {
	candidate: { label: 'Кандидат', tone: 'warning' },
	open: { label: 'Открыт', tone: 'error' },
	rkn_24_sent: { label: 'РКН: 24 ч подано', tone: 'info' },
	rkn_72_sent: { label: 'РКН: 72 ч подано', tone: 'info' },
	closed: { label: 'Закрыт', tone: 'success' },
	dismissed: { label: 'Отклонён', tone: 'neutral' }
};

export const STATUS_HINTS: Record<IncidentStatus, string> = {
	candidate: 'Система или администратор заподозрили утечку. Сроки уведомления РКН ещё не идут: их запускает подтверждение.',
	open: 'Инцидент подтверждён, идёт срок 24 часа на уведомление РКН.',
	rkn_24_sent: 'Первое уведомление в РКН подано, идёт срок 72 часа на итоги расследования.',
	rkn_72_sent: 'Оба уведомления поданы. Осталось закрыть инцидент.',
	closed: 'Инцидент закрыт.',
	dismissed: 'Кандидат отклонён: утечки не было.'
};

export const incidentStatusMeta = (s: string): StatusMeta => STATUS[s as IncidentStatus] ?? { label: s, tone: 'neutral' };
export const incidentStatusHint = (s: string): string | undefined => STATUS_HINTS[s as IncidentStatus];

export const SEVERITIES = [
	{ key: 'info', value: 'Низкая' },
	{ key: 'warning', value: 'Средняя' },
	{ key: 'critical', value: 'Высокая' }
] as const;
const SEVERITY_TONE: Record<string, StatusMeta['tone']> = { info: 'neutral', warning: 'warning', critical: 'error' };
export const severityMeta = (s: string): StatusMeta => ({ label: SEVERITIES.find((x) => x.key === s)?.value ?? s, tone: SEVERITY_TONE[s] ?? 'neutral' });

export const SOURCE_LABELS: Record<string, string> = { event: 'По событию безопасности', manual: 'Заведён вручную' };
export const sourceLabel = (s: string): string => SOURCE_LABELS[s] ?? s;

/** Категории данных для уведомления: значения идут в текст как есть, поэтому ключ и подпись совпадают. */
export const DATA_CATEGORIES = ['ФИО', 'Контактные данные (телефон, почта)', 'Паспортные данные', 'Данные об обучении', 'Данные о договорах и оплатах', 'Учётные данные сотрудников', 'Иное'];

// --- Вкладки списка ----------------------------------------------------------------

export const STATUS_TABS = [
	{ key: 'all', label: 'Все' },
	{ key: 'candidate', label: 'Кандидаты' },
	{ key: 'active', label: 'В работе' },
	{ key: 'done', label: 'Закрытые' }
] as const;
const TAB_STATUSES: Record<string, IncidentStatus[] | undefined> = {
	candidate: ['candidate'],
	active: ['open', 'rkn_24_sent', 'rkn_72_sent'],
	done: ['closed', 'dismissed']
};
/** Вкладка из адреса; неизвестное или пустое — «Все». */
export const statusTab = (raw: string | null | undefined): string => STATUS_TABS.find((t) => t.key === raw)?.key ?? 'all';
/** Статусы для запроса к серверу; `undefined` — без фильтра. */
export const tabStatuses = (tab: string): IncidentStatus[] | undefined => TAB_STATUSES[tab];

// --- Шаги и сроки -----------------------------------------------------------------------

export const INCIDENT_STEPS = ['Кандидат', 'Подтверждён', 'РКН · 24 часа', 'РКН · 72 часа', 'Закрыт'] as const;
// индекс — шаг, который сейчас ждёт выполнения (как у запросов на удаление ПДн)
const STEP_INDEX: Record<string, number> = { candidate: 1, open: 2, rkn_24_sent: 3, rkn_72_sent: 4, closed: 4, dismissed: 0 };
export const incidentStepIndex = (status: string): number => STEP_INDEX[status] ?? 0;

export interface DeadlineInfo {
	state: 'none' | 'sent' | 'ok' | 'soon' | 'overdue';
	label: string;
	tone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
}

const HOUR = 3_600_000;

/** Срок уведомления: отправлено, идёт (с запасом или меньше 6 часов, как в напоминаниях сервера) или просрочено. */
export function deadlineInfo(dueAt: string | null | undefined, sentAt: string | null | undefined, now: number = Date.now()): DeadlineInfo {
	if (sentAt) return { state: 'sent', label: 'Отправлено', tone: 'success' };
	if (!dueAt) return { state: 'none', label: 'Срок не задан', tone: 'neutral' };
	const left = new Date(dueAt).getTime() - now;
	if (!Number.isFinite(left)) return { state: 'none', label: 'Срок не задан', tone: 'neutral' };
	if (left < 0) return { state: 'overdue', label: `Просрочено на ${formatDuration(left)}`, tone: 'error' };
	return { state: left <= 6 * HOUR ? 'soon' : 'ok', label: `Осталось ${formatDuration(left)}`, tone: left <= 6 * HOUR ? 'warning' : 'info' };
}

/** Срок, который сейчас важен для статуса: 24 часа у открытого, 72 часа после первой отправки. Остальным — нет. */
export function currentDeadline(inc: Pick<Incident, 'status' | 'rkn_24_due_at' | 'rkn_24_sent_at' | 'rkn_72_due_at' | 'rkn_72_sent_at'>, now: number = Date.now()): { stage: IncidentStage; info: DeadlineInfo } | null {
	if (inc.status === 'open') return { stage: '24h', info: deadlineInfo(inc.rkn_24_due_at, inc.rkn_24_sent_at, now) };
	if (inc.status === 'rkn_24_sent') return { stage: '72h', info: deadlineInfo(inc.rkn_72_due_at, inc.rkn_72_sent_at, now) };
	return null;
}

// --- Действия ---------------------------------------------------------------------------

export interface IncidentActions {
	confirm: boolean;
	edit: boolean;
	/** на какой стадии можно сформировать и отметить уведомление РКН */
	stage: IncidentStage | null;
	subjects: boolean;
	close: boolean;
	/** «Отклонить» вместо «Закрыть» — для кандидата */
	dismiss: boolean;
}

/** Что можно сделать с инцидентом (только ADMIN: `manage`). Порядок переходов проверяет сервер, здесь — что показывать. */
export function incidentActions(status: string, manage: boolean): IncidentActions {
	const none: IncidentActions = { confirm: false, edit: false, stage: null, subjects: false, close: false, dismiss: false };
	if (!manage) return none;
	const finished = status === 'closed' || status === 'dismissed';
	return {
		confirm: status === 'candidate',
		edit: !finished,
		stage: status === 'open' ? '24h' : status === 'rkn_24_sent' ? '72h' : null,
		subjects: status === 'open' || status === 'rkn_24_sent' || status === 'rkn_72_sent',
		close: !finished && status !== 'candidate',
		dismiss: status === 'candidate'
	};
}

// --- Уведомление РКН --------------------------------------------------------------------

/** Поля формы портала РКН: подписи; остальные ключи ответа сервера (технические) не показываются. */
export const NOTICE_FIELDS: { key: string; label: string }[] = [
	{ key: 'operator_name', label: 'Оператор' },
	{ key: 'number', label: 'Номер инцидента' },
	{ key: 'detected_at', label: 'Выявлено' },
	{ key: 'incident_summary', label: 'Суть инцидента' },
	{ key: 'data_categories', label: 'Категории данных' },
	{ key: 'subjects_estimate', label: 'Число субъектов' },
	{ key: 'probable_causes', label: 'Предполагаемые причины' },
	{ key: 'probable_harm', label: 'Предполагаемый вред' },
	{ key: 'measures', label: 'Принятые меры' },
	{ key: 'rkn_24_sent_at', label: 'Первое уведомление подано' },
	{ key: 'investigation_summary', label: 'Итоги расследования' },
	{ key: 'rkn_contact', label: 'Контакт ответственного' }
];

export interface NoticeRow {
	key: string;
	label: string;
	value: string;
}

const DATE_FIELDS = new Set(['detected_at', 'rkn_24_sent_at']);

/** Строки для копирования на портал: только известные поля с непустыми значениями, в порядке формы. */
export function noticeRows(fields: Record<string, unknown> | null | undefined): NoticeRow[] {
	const out: NoticeRow[] = [];
	for (const f of NOTICE_FIELDS) {
		const raw = fields?.[f.key];
		if (raw === null || raw === undefined || raw === '') continue;
		out.push({ key: f.key, label: f.label, value: DATE_FIELDS.has(f.key) ? formatDateTime(String(raw)) : String(raw) });
	}
	return out;
}

/** В настройках не указан контакт для РКН: сервер подставляет «не указано (заполните pdn.rkn_contact …)». */
export const contactMissing = (fields: Record<string, unknown> | null | undefined): boolean => /не указано/i.test(String(fields?.rkn_contact ?? ''));

// --- Время выявления ---------------------------------------------------------------------

/** «Дата + время» формы → момент (локальное время браузера); пустое или кривое — `null`. */
export function combineDateTime(date: string | null | undefined, time: string | null | undefined): Date | null {
	const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? '');
	const t = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((time ?? '').trim());
	if (!d || !t) return null;
	return new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
}

export const pad2 = (n: number): string => String(n).padStart(2, '0');
export const dateValue = (d: Date): string => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const timeValue = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
