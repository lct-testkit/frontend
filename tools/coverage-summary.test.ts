import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs без типов
import { groupOf, summarize, toMarkdown } from './coverage-summary.mjs';

const cov = (c: number, t: number) => ({ covered: c, total: t, pct: t ? Math.round((100 * c) / t) : 100 });
const file = (l: [number, number]) => ({ lines: cov(...l), branches: cov(1, 2), functions: cov(1, 1) });

describe('coverage-summary', () => {
	it('группирует features по области, остальное по первой папке', () => {
		expect(groupOf('D:/x/src/lib/features/signing/otp.ts')).toBe('features/signing');
		expect(groupOf('D:/x/src/lib/auth/session.svelte.ts')).toBe('auth');
		expect(groupOf('D:/x/src/lib/nav.ts')).toBe('nav.ts');
		expect(groupOf('D:/x/other/file.ts')).toBeNull();
	});
	it('складывает файлы группы и печатает таблицу', () => {
		const json = {
			total: { lines: cov(3, 4), branches: cov(2, 4), functions: cov(2, 2) },
			'D:/x/src/lib/auth/a.ts': file([1, 2]),
			'D:/x/src/lib/auth/b.ts': file([2, 2])
		};
		expect(summarize(json).get('auth').lines).toEqual([3, 4]);
		const md = toMarkdown(json);
		expect(md).toContain('| `auth` | 75% | 50% | 100% |');
		expect(md).toContain('строки 75%');
	});
});
