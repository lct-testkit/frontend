import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV } from '$lib/nav';
import { CHAPTERS } from './chapters';

const read = (file: string) => readFileSync(join(resolve(process.cwd(), 'src/lib/content/help'), file), 'utf8').replace(/\r\n/g, '\n');

const MENU = new Set(['Настройка', 'Администрирование', ...NAV.flatMap((s) => [s.title ?? '', ...s.items.map((i) => i.label)]).filter(Boolean)]);

/** роль → сколько сценариев обещает глава (задание F6-7) */
const SCENARIOS: Record<string, number> = { 'role-kam': 7, 'role-head': 6, 'role-admin': 8, 'role-auditor': 5 };

describe('главы по ролям', () => {
	for (const [slug, minScenarios] of Object.entries(SCENARIOS)) {
		const chapter = CHAPTERS.find((c) => c.slug === slug)!;
		const text = read(chapter.file);

		it(`${slug}: есть разделы «Что вы видите», «Что вы можете и чего нет», «Типовые сценарии»`, () => {
			expect(text).toMatch(/^## Что вы видите$/m);
			expect(text).toMatch(/^## Что вы можете и чего нет$/m);
			expect(text).toMatch(/^## Типовые сценарии$/m);
		});

		it(`${slug}: не меньше ${minScenarios} сценариев`, () => {
			expect([...text.matchAll(/^### \d+\. /gm)].length).toBeGreaterThanOrEqual(minScenarios);
		});

		it(`${slug}: названия пунктов меню в «Что вы видите» существуют в боковом меню`, () => {
			const section = /^## Что вы видите\n([\s\S]*?)^## /m.exec(text)?.[1] ?? '';
			const names = [...section.matchAll(/«([^»]+)»/g)].map((m) => m[1]);
			expect(names.length).toBeGreaterThan(0);
			for (const name of names) expect(MENU.has(name) || name === 'Справка', `${slug}: «${name}»`).toBe(true);
		});
	}

	it('в «Быстром старте» нет опровергнутого утверждения об аудиторе и есть таблица ролей', () => {
		const start = read('01-start.md');
		expect(start).not.toContain('Аудитор видит только журнал');
		expect(start).toContain('| Действие | КАМ | Руководитель | Администратор | Аудитор |');
	});
});
