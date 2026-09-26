// Наблюдатель в сделке только читает: бэкенд отвечает 403 на правку, переход, комментарий и задачу. Здесь — кто считается
// наблюдателем, чтобы кнопки, которые всё равно закончатся отказом, не показывались.

export interface ParticipantLike {
	user_id: string;
	role_in_deal: string;
}

/**
 * Наблюдатель — участник только с ролью `watcher`, не ответственный за сделку и не руководитель/администратор
 * (им скоуп даёт роль). Соисполнитель и юрист работают со сделкой как обычно.
 */
export function isWatcherOnly(participants: readonly ParticipantLike[], ownerId: string | null | undefined, me: { id: string; role: string | null } | null): boolean {
	if (!me || me.role === 'ADMIN' || me.role === 'HEAD' || ownerId === me.id) return false;
	const mine = participants.filter((p) => p.user_id === me.id);
	return mine.length > 0 && mine.every((p) => p.role_in_deal === 'watcher');
}
