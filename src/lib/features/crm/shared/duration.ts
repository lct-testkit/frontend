// Длительности: разбор ISO 8601 (`P1DT2H30M` — так pydantic сериализует timedelta, например `duration_in_prev`
// в истории статусов) и человекочитаемый вывод по-русски.

const ISO_DURATION = /^(-)?P(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/;

export const MS_MINUTE = 60_000;
export const MS_HOUR = 3_600_000;
export const MS_DAY = 86_400_000;

/**
 * ISO 8601 duration → миллисекунды. Число трактуется как секунды (так timedelta уходит в JSON у некоторых
 * сериализаторов). Год/месяц считаются как 365/30 дней — для отображения этого достаточно.
 * Возвращает `null`, если разобрать не удалось.
 */
export function parseIsoDuration(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value * 1000 : null;
	const match = ISO_DURATION.exec(value.trim());
	if (!match) return null;
	const [, sign, years, months, weeks, days, hours, minutes, seconds] = match;
	const num = (s: string | undefined): number => (s ? Number(s) : 0);
	const total =
		num(years) * 365 * MS_DAY +
		num(months) * 30 * MS_DAY +
		num(weeks) * 7 * MS_DAY +
		num(days) * MS_DAY +
		num(hours) * MS_HOUR +
		num(minutes) * MS_MINUTE +
		num(seconds) * 1000;
	return sign ? -total : total;
}

/** Склонение: plural(3, ['день', 'дня', 'дней']) → 'дня'. */
export function pluralRu(n: number, forms: [string, string, string]): string {
	const abs = Math.abs(Math.trunc(n));
	const mod10 = abs % 10;
	const mod100 = abs % 100;
	if (mod10 === 1 && mod100 !== 11) return forms[0];
	if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
	return forms[2];
}

/**
 * Короткая человекочитаемая длительность: «2 д 3 ч», «45 мин», «меньше минуты».
 * Не больше двух значимых единиц — для таблиц и индикаторов.
 */
export function formatDurationShort(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
	const abs = Math.abs(ms);
	if (abs < MS_MINUTE) return 'меньше минуты';
	const days = Math.floor(abs / MS_DAY);
	const hours = Math.floor((abs % MS_DAY) / MS_HOUR);
	const minutes = Math.floor((abs % MS_HOUR) / MS_MINUTE);
	if (days > 0) return hours > 0 ? `${days} д ${hours} ч` : `${days} д`;
	if (hours > 0) return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
	return `${minutes} мин`;
}

/** Полная форма со склонениями: «2 дня 3 часа», «1 час», «5 минут». */
export function formatDurationLong(ms: number | null | undefined): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) return '—';
	const abs = Math.abs(ms);
	if (abs < MS_MINUTE) return 'меньше минуты';
	const days = Math.floor(abs / MS_DAY);
	const hours = Math.floor((abs % MS_DAY) / MS_HOUR);
	const minutes = Math.floor((abs % MS_HOUR) / MS_MINUTE);
	const parts: string[] = [];
	if (days > 0) parts.push(`${days} ${pluralRu(days, ['день', 'дня', 'дней'])}`);
	if (hours > 0) parts.push(`${hours} ${pluralRu(hours, ['час', 'часа', 'часов'])}`);
	if (days === 0 && minutes > 0) parts.push(`${minutes} ${pluralRu(minutes, ['минута', 'минуты', 'минут'])}`);
	return parts.slice(0, 2).join(' ');
}
