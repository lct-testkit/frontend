// Короткие подписи для интерфейса редактора воронки.
import { plural } from '$lib/utils/format';

/** 72 → «3 дн.», 36 → «36 ч», 24 → «1 дн.» */
export function formatHours(hours: number): string {
	if (hours >= 24 && hours % 24 === 0) return `${hours / 24} дн.`;
	return `${hours} ч`;
}

export const statusesWord = (n: number): string => `${n} ${plural(n, ['статус', 'статуса', 'статусов'])}`;
export const transitionsWord = (n: number): string => `${n} ${plural(n, ['переход', 'перехода', 'переходов'])}`;
