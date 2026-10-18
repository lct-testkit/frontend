// Обращения к ручкам лицензий, нужные нескольким экранам: одна запись по id (панель по ссылке, обновление после конфликта версий).
import { api, unwrap, ApiError } from '$lib/api';
import type { OrganizationLicense } from '../types';

/** `GET /api/organization-licenses/{id}`; чужая по скоупу или удалённая лицензия (404) — `null`. */
export async function getLicense(id: string, signal?: AbortSignal): Promise<OrganizationLicense | null> {
	try {
		return await unwrap(api.GET('/api/organization-licenses/{license_id}', { params: { path: { license_id: id } }, signal }));
	} catch (e) {
		if (e instanceof ApiError && e.isNotFound) return null;
		throw e;
	}
}

/** Строка из уже загруженных; если её нет (ссылка на запись с дальней страницы) — запрос по id. */
export async function resolveLicense(
	items: readonly OrganizationLicense[],
	id: string,
	fetcher: (id: string) => Promise<OrganizationLicense | null> = (i) => getLicense(i)
): Promise<OrganizationLicense | null> {
	return items.find((l) => l.id === id) ?? fetcher(id);
}
