// История публикаций воронки из журнала аудита (`WORKFLOW_PUBLISHED`): кто, когда, хэш графа. Снимков версий бэкенд не хранит,
// поэтому «вернуть прошлую версию» невозможно — это только список. Чистая логика (тесты рядом).
export interface AuditLike {
	id: string;
	created_at: string;
	actor_id?: string | null;
	result?: string;
	changes?: unknown;
}

export interface Publication {
	id: string;
	at: string;
	by: string | null;
	/** хэш графа (первые 10 символов), пусто — запись без хэша */
	hash: string;
	/** последняя успешная публикация — действующая версия */
	current: boolean;
}

/** Публикации по времени, новые сверху; неуспешные не показываем, последняя успешная помечена как действующая. */
export function publications(items: readonly AuditLike[]): Publication[] {
	const list = items
		.filter((i) => (i.result ?? 'success') === 'success')
		.sort((a, b) => b.created_at.localeCompare(a.created_at))
		.map<Publication>((i) => {
			const hash = (i.changes as { graph_hash?: { new?: unknown } } | null | undefined)?.graph_hash?.new;
			return { id: i.id, at: i.created_at, by: i.actor_id ?? null, hash: typeof hash === 'string' ? hash.slice(0, 10) : '', current: false };
		});
	if (list.length) list[0].current = true;
	return list;
}
