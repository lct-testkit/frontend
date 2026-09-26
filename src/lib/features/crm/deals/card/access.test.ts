import { describe, expect, it } from 'vitest';
import { isWatcherOnly } from './access';

const me = { id: 'u1', role: 'KAM' };
const watcher = { user_id: 'u1', role_in_deal: 'watcher' };

describe('isWatcherOnly', () => {
	it('участник только с ролью «наблюдатель» — наблюдатель', () => {
		expect(isWatcherOnly([watcher], 'owner', me)).toBe(true);
	});

	it('соисполнитель, юрист или методист работают как обычно', () => {
		expect(isWatcherOnly([{ user_id: 'u1', role_in_deal: 'co_owner' }], 'owner', me)).toBe(false);
		expect(isWatcherOnly([watcher, { user_id: 'u1', role_in_deal: 'lawyer' }], 'owner', me)).toBe(false);
	});

	it('ответственный, руководитель и администратор — нет', () => {
		expect(isWatcherOnly([watcher], 'u1', me)).toBe(false);
		expect(isWatcherOnly([watcher], 'owner', { id: 'u1', role: 'HEAD' })).toBe(false);
		expect(isWatcherOnly([watcher], 'owner', { id: 'u1', role: 'ADMIN' })).toBe(false);
	});

	it('не участник и неизвестный пользователь — не наблюдатель', () => {
		expect(isWatcherOnly([{ user_id: 'u2', role_in_deal: 'watcher' }], 'owner', me)).toBe(false);
		expect(isWatcherOnly([], 'owner', me)).toBe(false);
		expect(isWatcherOnly([watcher], 'owner', null)).toBe(false);
	});
});
