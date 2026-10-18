import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { THEMES, defaultThemesDir, evaluate, failures, loadTokens, overlaysFromCss } from './check-contrast.mjs';

const dir = defaultThemesDir();
const overlays = overlaysFromCss(readFileSync(new URL('../src/lib/styles/a11y-tokens.css', import.meta.url), 'utf8'));
const rows = evaluate(dir, overlays);

describe('контраст токенов (WCAG AA)', () => {
	for (const theme of THEMES) {
		it(`${theme}: ни одна обязательная пара не ниже порога`, () => {
			expect(failures(rows).filter((f) => f.theme === theme)).toEqual([]);
		});
	}

	it('каждое переопределение приложения ссылается на существующий токен темы', () => {
		for (const theme of THEMES) {
			const base = loadTokens(readFileSync(`${dir}/${theme}.css`, 'utf8'));
			for (const m of (overlays[theme] ?? '').matchAll(/(--atmr-[a-z0-9-]+)\s*:/g)) {
				expect(base.has(m[1]), `${theme}: ${m[1]} нет в теме`).toBe(true);
			}
		}
	});

	it('сторож: без пакета AA проверка краснеет (тест умеет падать)', () => {
		expect(failures(evaluate(dir, {})).length).toBeGreaterThan(50);
	});

	it('каталог не обмелел', () => {
		expect(rows.length).toBeGreaterThanOrEqual(90);
	});
});
