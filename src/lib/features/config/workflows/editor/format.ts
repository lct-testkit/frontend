// Короткие подписи для интерфейса редактора воронки.
import { plural } from '$lib/utils/format';

/** 0.05 → «3 мин», 0.15 → «9 мин», 1 → «1 ч», 36 → «36 ч», 72 → «3 дн.», 1.5 → «1,5 ч» */
export function formatHours(hours: number): string {
	if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} мин`;
	if (hours >= 24 && hours % 24 === 0) return `${hours / 24} дн.`;
	return `${Number.isInteger(hours) ? hours : String(Math.round(hours * 10) / 10).replace('.', ',')} ч`;
}

export const statusesWord = (n: number): string => `${n} ${plural(n, ['статус', 'статуса', 'статусов'])}`;
export const transitionsWord = (n: number): string => `${n} ${plural(n, ['переход', 'перехода', 'переходов'])}`;
