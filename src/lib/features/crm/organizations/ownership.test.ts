import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api/errors';
import { BULK_CHUNK, canAssignOwner, chunk, ownerHistory, runBulkOwnerChange, validateReason } from './ownership';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `org-${i}`);
const change = { ownerId: 'u1', reason: 'Уход в отпуск' };

describe('canAssignOwner', () => {
	it('да для набора прав Руководителя, нет для менеджера и аудитора', () => {
		const head = new Set(['organization:read', 'organization:write', 'organization:assign_owner', 'deal:reassign']);
		const kam = new Set(['organization:read', 'organization:write']);
		expect(canAssignOwner((p) => head.has(p))).toBe(true);
		expect(canAssignOwner((p) => kam.has(p))).toBe(false);
		expect(canAssignOwner(() => false)).toBe(false);
	});
});

describe('validateReason', () => {
	it('короткая и слишком длинная причины отклоняются, пробелы не считаются', () => {
		expect(validateReason('  ')).toMatch(/Укажите причину/);
		expect(validateReason('ab')).toMatch(/не короче 3/);
		expect(validateReason('Уход в отпуск')).toBeNull();
		expect(validateReason('я'.repeat(501))).toMatch(/длиннее 500/);
		expect(validateReason('я'.repeat(500))).toBeNull();
	});
});

describe('runBulkOwnerChange', () => {
	it('250 вузов идут тремя вызовами по 100, 100 и 50, ответы складываются', async () => {
		const call = vi.fn(async (b: { organization_ids: string[] }) => ({ changed: b.organization_ids.length - 1, deals_reassigned: 2, skipped: [{ organization_id: b.organization_ids[0], reason: 'нет доступа к организации' }] }));
		const res = await runBulkOwnerChange(ids(250), change, call);
		expect(call.mock.calls.map((c) => c[0].organization_ids.length)).toEqual([BULK_CHUNK, BULK_CHUNK, 50]);
		expect(res.changed).toBe(247);
		expect(res.dealsReassigned).toBe(6);
		expect(res.skipped).toHaveLength(3);
	});
	it('вызовы идут по очереди, не одновременно', async () => {
		let active = 0;
		let peak = 0;
		await runBulkOwnerChange(ids(300), change, async (b) => {
			active += 1;
			peak = Math.max(peak, active);
			await Promise.resolve();
			active -= 1;
			return { changed: b.organization_ids.length };
		});
		expect(peak).toBe(1);
	});
	it('пакет, упавший целиком (403), помечается пропущенным с причиной, остальные продолжаются', async () => {
		let n = 0;
		const call = vi.fn(async (b: { organization_ids: string[] }) => {
			n += 1;
			if (n === 1) throw new ApiError({ status: 403, detail: 'Недостаточно прав' });
			return { changed: b.organization_ids.length };
		});
		const res = await runBulkOwnerChange(ids(150), change, call);
		expect(res.changed).toBe(50);
		expect(res.skipped).toHaveLength(100);
		expect(res.skipped[0]).toMatchObject({ organization_id: 'org-0' });
		expect(res.skipped[0].reason.length).toBeGreaterThan(3);
	});
	it('дубли id убираются, причина обрезается, снятие — owner_id null, галка сделок уходит в запрос', async () => {
		const call = vi.fn(async (b: unknown) => ({ changed: (b as { organization_ids: string[] }).organization_ids.length }));
		await runBulkOwnerChange(['a', 'a', 'b'], { ownerId: null, reason: '  Реорганизация  ', carryOpenDeals: true }, call);
		expect(call).toHaveBeenCalledWith({ organization_ids: ['a', 'b'], owner_id: null, reason: 'Реорганизация', carry_open_deals: true });
	});
	it('пустой список не делает вызовов', async () => {
		const call = vi.fn();
		expect(await runBulkOwnerChange([], change, call)).toEqual({ changed: 0, dealsReassigned: 0, skipped: [] });
		expect(call).not.toHaveBeenCalled();
	});
});

describe('chunk', () => {
	it('режет на части заданного размера', () => {
		expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
		expect(chunk([], 3)).toEqual([]);
	});
});

describe('ownerHistory', () => {
	it('разбирает {old, new} и причину, пропускает записи без owner_id, сортирует от новых к старым', () => {
		const rows = ownerHistory([
			{ created_at: '2026-10-01T10:00:00Z', actor_id: 'h', changes: { owner_id: { old: 'a', new: 'b' }, reason: { old: null, new: 'Отпуск' } } },
			{ created_at: '2026-10-02T10:00:00Z', actor_id: 'h', changes: { name: { old: 'x', new: 'y' } } },
			{ created_at: '2026-10-03T10:00:00Z', actor_id: null, changes: { owner_id: { old: 'b', new: null }, reason: 'Реорганизация' } },
			{ created_at: '2026-10-04T10:00:00Z', changes: null }
		]);
		expect(rows).toEqual([
			{ at: '2026-10-03T10:00:00Z', actorId: null, oldId: 'b', newId: null, reason: 'Реорганизация' },
			{ at: '2026-10-01T10:00:00Z', actorId: 'h', oldId: 'a', newId: 'b', reason: 'Отпуск' }
		]);
	});
});
