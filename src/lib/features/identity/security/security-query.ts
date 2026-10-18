// Фильтры журнала безопасности ↔ адресная строка ↔ параметры API. Типы событий — несколько значений через запятую (`type=LOGIN_FAILED,MASS_EXPORT`),
// серьёзность — «не ниже» (`min_severity`), даты календарные, как в журнале аудита.
import { dayEnd, dayStart } from '../audit/audit-query';
import { securityEventLabel, SEVERITY_LABELS } from './security-labels';

export interface SecurityFilters {
	type: string;
	severity: string;
	user: string;
	ip: string;
	from: string;
	to: string;
}

export const SECURITY_FILTER_KEYS = ['type', 'severity', 'user', 'ip', 'from', 'to'] as const;
export const emptySecurityFilters = (): SecurityFilters => ({ type: '', severity: '', user: '', ip: '', from: '', to: '' });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SEVERITIES = ['info', 'warning', 'critical'] as const;

export const splitTypes = (raw: string): string[] => [...new Set(raw.split(',').map((t) => t.trim()).filter(Boolean))];
export const joinTypes = (types: readonly string[]): string => types.join(',');

/** Чтение из адресной строки: пустые значения остаются пустыми, неизвестная серьёзность отбрасывается. */
export function readFilters(get: (key: string) => string | null | undefined): SecurityFilters {
	const f = emptySecurityFilters();
	for (const key of SECURITY_FILTER_KEYS) f[key] = (get(key) ?? '').trim();
	if (!(SEVERITIES as readonly string[]).includes(f.severity)) f.severity = '';
	return f;
}

/** Параметры запроса списка и выгрузки (одни и те же). */
export function apiQuery(f: SecurityFilters) {
	const types = splitTypes(f.type);
	return {
		event_type: types.length ? types : undefined,
		min_severity: f.severity || undefined,
		user_id: UUID.test(f.user) ? f.user : undefined,
		ip: f.ip || undefined,
		from: dayStart(f.from),
		to: dayEnd(f.to)
	};
}

export const activeCount = (f: SecurityFilters): number => Object.values(f).filter(Boolean).length;

/** Применённые фильтры словами — для подтверждения выгрузки: «тип: Неверная подпись вебхука; период: с 2026-10-01». Пусто — без фильтров. */
export function describeFilters(f: SecurityFilters, userName?: (id: string) => string): string[] {
	const out: string[] = [];
	const types = splitTypes(f.type);
	if (types.length) out.push(`события: ${types.map(securityEventLabel).join(', ')}`);
	if (f.severity) out.push(`серьёзность: ${f.severity === 'info' ? 'любая' : `не ниже «${SEVERITY_LABELS[f.severity] ?? f.severity}»`}`);
	if (f.user) out.push(`сотрудник: ${userName ? userName(f.user) : f.user}`);
	if (f.ip) out.push(`адрес: ${f.ip}`);
	if (f.from || f.to) out.push(`период: ${f.from ? `с ${f.from}` : ''}${f.from && f.to ? ' ' : ''}${f.to ? `по ${f.to}` : ''}`);
	return out;
}

export const exportFilename = (now = new Date()): string => `security-events-${now.toISOString().slice(0, 10)}.ndjson`;
