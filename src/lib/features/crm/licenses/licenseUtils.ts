// Лицензии/договоры вуз–вендор–ПО: чистое форматирование для таблицы, карточки и панели.
// Поля ТЗ (§4 п.1) и то, как бэкенд хранит «Подписание» и «Срок действия» (B3-1/B3-3): подписание — «да/нет» и/или дата,
// срок — дата окончания, срок в годах или «бессрочно». Колонка `license_valid_year` — то, что было написано в файле (год или число лет).
import { count, formatDate } from '$lib/utils/format';
import { TRANSFER_STATUS_LABELS } from '../shared/labels';
import type { OrganizationLicense } from '../types';

/** Десять полей ТЗ в порядке ТЗ — заголовки таблицы, подписи карточки, глава справки. */
export const LICENSE_FIELD_LABELS = [
	'Название ВУЗа',
	'Вендор',
	'ПО',
	'Номер договора',
	'Подписание лицензии',
	'Срок действия (год)',
	'Статус по передаче',
	'ФИО менеджера',
	'Ответственные от ВУЗа',
	'Комментарий'
] as const;

/** Заголовки колонок таблицы: короче полей ТЗ (иначе десять колонок не помещаются), полное название поля ТЗ — в подсказке заголовка. */
export const LICENSE_COLUMN_TITLES = ['Вуз', 'Вендор', 'ПО', 'Договор', 'Подписание', 'Срок', 'Передача', 'Менеджер', 'Ответственные', 'Комментарий'] as const;

/** Вендор без формы собственности и кавычек: «ООО «Астра Линукс»» → «Астра Линукс» (полное — в подсказке). */
export function shortVendor(name: string): string {
	const stripped = name
		.replace(/^\s*(ООО|АО|ПАО|ЗАО|ОАО|НКО|ИП|Фирма)\s+/i, '')
		.replace(/[«»"]/g, '')
		.trim();
	return stripped || name;
}

/** Год меньше этого — не год окончания, а срок в годах («3» из файла). */
const MIN_REAL_YEAR = 1900;

export interface TermInfo {
	text: string;
	tone: 'neutral' | 'warning' | 'error';
	/** «Истекает» — заканчивается в этом году; «Истекла» — уже закончилась */
	badge?: 'Истекает' | 'Истекла' | 'Проверьте';
	hint?: string;
}

type TermFields = Pick<OrganizationLicense, 'is_perpetual' | 'license_valid_until' | 'license_term_years' | 'license_valid_year'>;

const isoDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function byEndDate(until: string, now: Date): TermInfo {
	const year = Number(until.slice(0, 4));
	const hint = `Действует до ${formatDate(until)}`;
	if (until < isoDay(now)) return { text: String(year), tone: 'error', badge: 'Истекла', hint };
	if (year === now.getFullYear()) return { text: String(year), tone: 'warning', badge: 'Истекает', hint };
	return { text: String(year), tone: 'neutral', hint };
}

function byEndYear(year: number, now: Date): TermInfo {
	if (year < now.getFullYear()) return { text: String(year), tone: 'error', badge: 'Истекла', hint: `Действовала до ${year} года` };
	if (year === now.getFullYear()) return { text: String(year), tone: 'warning', badge: 'Истекает', hint: `Действует до конца ${year} года` };
	return { text: String(year), tone: 'neutral', hint: `Действует до ${year} года` };
}

/**
 * Колонка «Срок действия (год)»: год окончания и пометка «Истекает»/«Истекла»; «Бессрочно»; срок в годах без даты окончания.
 * Порядок: бессрочно, дата окончания, срок в годах, старое значение из файла (год или число лет).
 */
export function licenseTermInfo(l: TermFields, now: Date = new Date()): TermInfo {
	if (l.is_perpetual) return { text: 'Бессрочно', tone: 'neutral' };
	if (l.license_valid_until) return byEndDate(l.license_valid_until, now);
	if (l.license_term_years != null) return { text: `на ${count(l.license_term_years, ['год', 'года', 'лет'])}`, tone: 'neutral', hint: 'Срок в годах, дата окончания не указана' };
	const raw = l.license_valid_year;
	if (raw == null) return { text: '—', tone: 'neutral' };
	if (raw >= MIN_REAL_YEAR) return byEndYear(raw, now);
	return { text: `на ${count(raw, ['год', 'года', 'лет'])}`, tone: 'warning', badge: 'Проверьте', hint: 'Похоже на срок в годах, а не на год окончания: уточните в договоре' };
}

/** Колонка «Подписание лицензии»: дата, а если даты нет — «Подписана»/«Не подписана». */
export function licenseSignedText(l: Pick<OrganizationLicense, 'is_signed' | 'license_signed_at'>): string {
	if (l.license_signed_at) return formatDate(l.license_signed_at);
	if (l.is_signed === true) return 'Подписана';
	if (l.is_signed === false) return 'Не подписана';
	return 'Нет данных';
}

/** Подпись статуса передачи; неизвестное или пустое значение — как в остальных перечислениях бэкенда. */
export function transferStatusLabel(status: OrganizationLicense['transfer_status']): string {
	if (!status) return '—';
	return TRANSFER_STATUS_LABELS[status] ?? status;
}

/** Название вуза строки: краткое, если есть (полное — в подсказке); без имени от сервера — «—». */
export function licenseOrgTitle(l: Pick<OrganizationLicense, 'organization_name' | 'organization_short_name'>): string {
	return l.organization_short_name || l.organization_name || '—';
}
