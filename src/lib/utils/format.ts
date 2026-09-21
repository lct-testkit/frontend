// ru-RU formatting. Backend sends dates as ISO 8601 with timezone (UTC) and money as strings ("150000.00").

const NBSP = ' ';

const fmtDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDateTime = new Intl.DateTimeFormat('ru-RU', {
	day: '2-digit',
	month: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	minute: '2-digit'
});
const fmtTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const fmtLongDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtNumber = new Intl.NumberFormat('ru-RU');
const rtf = new Intl.RelativeTimeFormat('ru', { numeric: 'auto' });

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toDate(value: string | number | Date | null | undefined): Date | null {
	if (value === null || value === undefined || value === '') return null;
	// `2026-12-31` (a plain date, no time zone) is that calendar day everywhere, not UTC midnight shifted by the viewer's offset
	const day = typeof value === 'string' ? DATE_ONLY.exec(value) : null;
	if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
	const d = value instanceof Date ? value : new Date(value);
	return Number.isNaN(d.getTime()) ? null : d;
}

export const EMPTY = '—';

/** 05.03.2026 */
export function formatDate(value: string | number | Date | null | undefined): string {
	const d = toDate(value);
	return d ? fmtDate.format(d) : EMPTY;
}

/** 05.03.2026, 14:30 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
	const d = toDate(value);
	return d ? fmtDateTime.format(d) : EMPTY;
}

export function formatTime(value: string | number | Date | null | undefined): string {
	const d = toDate(value);
	return d ? fmtTime.format(d) : EMPTY;
}

/** 5 марта 2026 г. */
export function formatLongDate(value: string | number | Date | null | undefined): string {
	const d = toDate(value);
	return d ? fmtLongDate.format(d) : EMPTY;
}

/** «5 минут назад», «вчера», «через 2 дня»; older than 7 days → absolute date. */
export function formatRelative(value: string | number | Date | null | undefined, now: number = Date.now()): string {
	const d = toDate(value);
	if (!d) return EMPTY;
	const diffSec = Math.round((d.getTime() - now) / 1000);
	const abs = Math.abs(diffSec);
	if (abs < 45) return 'только что';
	if (abs < 3600) return rtf.format(Math.round(diffSec / 60), 'minute');
	if (abs < 86_400) return rtf.format(Math.round(diffSec / 3600), 'hour');
	if (abs < 7 * 86_400) return rtf.format(Math.round(diffSec / 86_400), 'day');
	return formatDate(d);
}

export function formatNumber(value: number | string | null | undefined): string {
	if (value === null || value === undefined || value === '') return EMPTY;
	const n = typeof value === 'string' ? Number(value) : value;
	return Number.isFinite(n) ? fmtNumber.format(n).replace(/ /g, NBSP) : EMPTY;
}

const CURRENCY_SIGN: Record<string, string> = { RUB: '₽', USD: '$', EUR: '€' };

/** 1 250 000 ₽ (kopecks shown only when present). Accepts the backend's string amounts. */
export function formatMoney(value: number | string | null | undefined, currency: string | null | undefined = 'RUB'): string {
	if (value === null || value === undefined || value === '') return EMPTY;
	const n = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(n)) return EMPTY;
	const hasKopecks = Math.round(n * 100) % 100 !== 0;
	const text = new Intl.NumberFormat('ru-RU', {
		minimumFractionDigits: hasKopecks ? 2 : 0,
		maximumFractionDigits: 2
	})
		.format(n)
		.replace(/ /g, NBSP);
	return `${text}${NBSP}${CURRENCY_SIGN[currency ?? 'RUB'] ?? currency}`;
}

/** Compact money for tiles: 1,2 млн ₽ */
export function formatMoneyShort(value: number | string | null | undefined, currency: string | null | undefined = 'RUB'): string {
	if (value === null || value === undefined || value === '') return EMPTY;
	const n = typeof value === 'string' ? Number(value) : value;
	if (!Number.isFinite(n)) return EMPTY;
	const abs = Math.abs(n);
	const sign = CURRENCY_SIGN[currency ?? 'RUB'] ?? currency;
	const trim = (x: number) => x.toFixed(1).replace(/\.0$/, '').replace('.', ',');
	if (abs >= 1e9) return `${trim(n / 1e9)}${NBSP}млрд${NBSP}${sign}`;
	if (abs >= 1e6) return `${trim(n / 1e6)}${NBSP}млн${NBSP}${sign}`;
	if (abs >= 1e3) return `${trim(n / 1e3)}${NBSP}тыс.${NBSP}${sign}`;
	return formatMoney(n, currency);
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
	if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
	return `${value.toFixed(digits).replace('.', ',')}${NBSP}%`;
}

/** Russian plural: plural(5, ['сделка', 'сделки', 'сделок']) → «сделок» */
export function plural(n: number, forms: [one: string, few: string, many: string]): string {
	const abs = Math.abs(n) % 100;
	const last = abs % 10;
	if (abs > 10 && abs < 20) return forms[2];
	if (last > 1 && last < 5) return forms[1];
	if (last === 1) return forms[0];
	return forms[2];
}

/** 12 сделок */
export function count(n: number, forms: [string, string, string]): string {
	return `${formatNumber(n)}${NBSP}${plural(n, forms)}`;
}

export function formatBytes(bytes: number | null | undefined): string {
	if (bytes === null || bytes === undefined) return EMPTY;
	if (bytes < 1024) return `${bytes}${NBSP}Б`;
	const units = ['КБ', 'МБ', 'ГБ'];
	let v = bytes / 1024;
	let i = 0;
	while (v >= 1024 && i < units.length - 1) {
		v /= 1024;
		i++;
	}
	return `${v.toFixed(v < 10 ? 1 : 0).replace('.', ',')}${NBSP}${units[i]}`;
}

/** «12 ч 05 мин» / «3 дн.» from milliseconds */
export function formatDuration(ms: number): string {
	const abs = Math.abs(ms);
	const min = Math.floor(abs / 60_000);
	if (min < 60) return `${Math.max(min, 1)}${NBSP}мин`;
	const h = Math.floor(min / 60);
	if (h < 48) return `${h}${NBSP}ч ${String(min % 60).padStart(2, '0')}${NBSP}мин`;
	const d = Math.floor(h / 24);
	return `${d}${NBSP}${plural(d, ['день', 'дня', 'дней'])}`;
}

export function initials(fullName: string | null | undefined): string {
	if (!fullName) return '?';
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	return (parts[0][0] + (parts.length > 1 ? parts[1][0] : '')).toUpperCase();
}

/** +7 (999) 123-45-67 for RU numbers; masked values (`+7 (9**) ***-**-12`) and foreign numbers pass through. */
export function formatPhone(value: string | null | undefined): string {
	if (!value) return EMPTY;
	if (value.includes('*')) return value;
	const digits = value.replace(/\D/g, '');
	if (digits.length === 11 && (digits.startsWith('7') || digits.startsWith('8'))) {
		return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
	}
	return value;
}
