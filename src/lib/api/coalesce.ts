// Два места экрана, которым нужны одни и те же данные, спрашивают сервер дважды (карточка сделки: права и список участников; «Подписание»: счётчик и вкладка).
// `coalesce(ключ, запрос)` отдаёт второму вызову тот же ответ, если первый был меньше `ttl` мс назад (в полёте или только что пришёл).
// Только для чтения: после изменения вызывайте `forget(ключ)`.
const calls = new Map<string, { at: number; promise: Promise<unknown> }>();

export function coalesce<T>(key: string, fetcher: () => Promise<T>, ttl = 1500): Promise<T> {
	const hit = calls.get(key);
	if (hit && Date.now() - hit.at < ttl) return hit.promise as Promise<T>;
	const promise = fetcher().catch((e) => {
		if (calls.get(key)?.promise === promise) calls.delete(key);
		throw e;
	});
	calls.set(key, { at: Date.now(), promise });
	return promise;
}

export function forget(key: string): void {
	calls.delete(key);
}
