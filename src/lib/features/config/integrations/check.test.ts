import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api';
import { SourceChecks } from './check.svelte';

const src = (code: string, is_active = true) => ({ code, name: `Имя ${code}`, is_active });
const at = new Date(2026, 9, 21, 1, 32);

describe('SourceChecks.run', () => {
	it('проверяет только включённые', async () => {
		const check = vi.fn().mockResolvedValue({ ok: true, message: 'Отвечает', duration_ms: 10 });
		const c = new SourceChecks({ check, now: () => at });
		await c.run([src('cms'), src('lms', false), src('bitrix24')]);
		expect(check.mock.calls.map((a) => a[0]).sort()).toEqual(['bitrix24', 'cms']);
		expect(c.summary?.text).toBe('Проверено в 01:32: 2 из 2 отвечают');
		expect(c.running).toBe(false);
	});
	it('ok=false приходит как 200: причина из message; упавший запрос не роняет остальные', async () => {
		const check = vi.fn(async (code: string) => {
			if (code === 'lms') throw new ApiError({ status: 429, detail: 'rate' });
			return code === 'cms' ? { ok: false, message: 'Отказ в доступе', duration_ms: 30 } : { ok: true, message: 'Отвечает', duration_ms: 30 };
		});
		const c = new SourceChecks({ check, now: () => at });
		await c.run([src('cms'), src('lms'), src('bitrix24')]);
		expect(c.summary?.text).toBe('Проверено в 01:32: 1 из 3 отвечают');
		expect(c.summary?.failed.map((r) => r.message)).toEqual(['Отказ в доступе', 'Слишком много проверок подряд. Подождите минуту и повторите.']);
	});
	it('нет включённых — ничего не вызывает и не пишет итог', async () => {
		const check = vi.fn();
		const c = new SourceChecks({ check, now: () => at });
		await c.run([src('cms', false)]);
		expect(check).not.toHaveBeenCalled();
		expect(c.summary).toBeNull();
	});
	it('повторный запуск во время проверки игнорируется', async () => {
		let release!: () => void;
		const check = vi.fn(() => new Promise<{ ok: boolean; message: string; duration_ms: number }>((res) => (release = () => res({ ok: true, message: 'Отвечает', duration_ms: 1 }))));
		const c = new SourceChecks({ check, now: () => at });
		const first = c.run([src('cms')]);
		await c.run([src('cms')]);
		expect(check).toHaveBeenCalledTimes(1);
		release();
		await first;
	});
});

describe('тексты итога', () => {
	it('один источник: «отвечает»; 429 и 409 — человеческими словами', async () => {
		const ok = new SourceChecks({ check: async () => ({ ok: true, message: 'Отвечает', duration_ms: 1 }), now: () => at });
		await ok.run([src('cms')]);
		expect(ok.summary?.text).toBe('Проверено в 01:32: 1 из 1 отвечает');
		expect(ok.summary?.allOk).toBe(true);
		expect(ok.summary?.failed).toEqual([]);

		const off = new SourceChecks({ check: async () => { throw new ApiError({ status: 409, code: 'CRM-1703' }); }, now: () => at });
		await off.run([src('cms')]);
		expect(off.summary?.failed[0].message).toBe('Источник выключен: проверять нечего.');
	});
});
