/** `ГГГГ-ММ-ДД` строго раньше сегодняшнего дня (по местному времени). Пустое и не-дата — не «прошлое». */
export function isPastDay(iso: string | null | undefined, now: Date = new Date()): boolean {
	const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
	if (!m) return false;
	const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	return day.getTime() < today.getTime();
}
