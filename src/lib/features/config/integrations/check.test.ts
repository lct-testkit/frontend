import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '$lib/api';
import { SourceChecks, checkFailure, summarize } from './check.svelte';

const src = (code: string, is_active = true) => ({ code, name: `Имя ${code}`, is_active });
const at = new Date(2026, 9, 21, 1, 32);

describe('summarize', () => {
	it('«Проверено в 01:32: 1 из 1 отвечает»', () => {
		const s = summarize([{ code: 'cms', name: 'Сайт', ok: true, message: 'Отвечает', durationMs: 120 }], at);
		expect(s.text).toBe('Проверено в 01:32: 1 из 1 отвечает');
		expect(s.allOk).toBe(true);
		expect(s.failed).toEqual([]);
	});
	it('несколько источников: «отвечают», неответившие перечислены с причиной', () => {
		const s = summarize(
			[
				{ code: 'cms', name: 'Сайт', ok: true, message: 'Отвечает', durationMs: 1 },
				{ code: 'lms', name: 'LMS', ok: false, message: 'Таймаут', durationMs: 5000 },
				{ code: 'bitrix24', name: 'Bitrix24', ok: true, message: 'Отвечает', durationMs: 1 }
			],
			at
		);
		expect(s.text).toBe('Проверено в 01:32: 2 из 3 отвечают');
		expect(s.allOk).toBe(false);
		expect(s.failed.map((r) => [r.name, r.message])).toEqual([['LMS', 'Таймаут']]);
	});
});

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

describe('checkFailure', () => {
	it('429 и 409 — человеческими словами', () => {
		expect(checkFailure(new ApiError({ status: 429 }))).toContain('Подождите минуту');
		expect(checkFailure(new ApiError({ status: 409, code: 'CRM-1703' }))).toBe('Источник выключен: проверять нечего.');
	});
});
