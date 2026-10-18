import { describe, expect, it } from 'vitest';
import { publications } from './publications';

const entry = (id: string, at: string, hash: string | null, over: Record<string, unknown> = {}) => ({ id, created_at: at, actor_id: 'u1', result: 'success', changes: hash ? { graph_hash: { new: hash, old: null } } : {}, ...over });

describe('publications', () => {
	it('новые сверху, у последней успешной — отметка «действующая»', () => {
		const list = publications([entry('a', '2026-10-01T10:00:00Z', 'aaaaaaaaaaaaaaaa'), entry('b', '2026-10-02T10:00:00Z', 'bbbbbbbbbbbbbbbb')]);
		expect(list.map((p) => p.id)).toEqual(['b', 'a']);
		expect(list.map((p) => p.current)).toEqual([true, false]);
		expect(list[0].hash).toBe('bbbbbbbbbb');
	});
	it('неуспешные не показываются, запись без хэша — пустой хэш', () => {
		const list = publications([entry('a', '2026-10-01T10:00:00Z', null), entry('b', '2026-10-02T10:00:00Z', 'x', { result: 'failure' })]);
		expect(list).toHaveLength(1);
		expect(list[0]).toMatchObject({ id: 'a', hash: '', current: true });
	});
	it('пусто — пустой список', () => expect(publications([])).toEqual([]));
});
