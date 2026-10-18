// Название статуса воронки: правила ручки `PATCH /api/workflows/{id}/statuses/{status_id}` (1–255 символов) и поиск такого же имени среди шагов.
export const STATUS_NAME_MAX = 255;

/** Название без пробелов по краям. */
export const normalizeStatusName = (raw: string | null | undefined): string => (raw ?? '').trim();

/** Что не так с названием (текст для поля) или `null`, если его можно сохранять. */
export function statusNameError(raw: string | null | undefined): string | null {
	const name = normalizeStatusName(raw);
	if (!name) return 'Введите название';
	if (name.length > STATUS_NAME_MAX) return `Не длиннее ${STATUS_NAME_MAX} символов`;
	return null;
}

/** Есть ли у другого неархивного статуса такое же название (без учёта регистра и пробелов по краям). */
export function hasSameName(statuses: readonly { key: string; name: string; is_archived?: boolean }[], key: string, name: string): boolean {
	const wanted = normalizeStatusName(name).toLocaleLowerCase('ru');
	if (!wanted) return false;
	return statuses.some((s) => s.key !== key && !s.is_archived && normalizeStatusName(s.name).toLocaleLowerCase('ru') === wanted);
}
