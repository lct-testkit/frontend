import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd(), 'src/lib/content/help');

function mdFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? mdFiles(full) : name.endsWith('.md') ? [full] : [];
	});
}

/** Утверждения, которые код опроверг (F6-8): в справку они не должны возвращаться. */
export const STALE_PHRASES = [
	'проверяются на вирусы',
	'проверяются на вирус',
	'юрист получает',
	'приходит по СМС или на почту',
	'Аудитор видит только журнал',
	'сервер пока не проверяет вложения',
	'интерфейс ещё не построен'
];

describe('справка не повторяет опровергнутое', () => {
	const files = mdFiles(ROOT).map((f) => ({ f, text: readFileSync(f, 'utf8').replace(/\r\n/g, '\n') }));

	it('запрещённые формулировки не встречаются ни в одной главе', () => {
		for (const { f, text } of files) {
			for (const phrase of STALE_PHRASES) expect(text.toLowerCase().includes(phrase.toLowerCase()), `${f}: «${phrase}»`).toBe(false);
		}
	});

	it('в главе «О проекте» честно названы заглушка и имитация', () => {
		const about = files.find((x) => x.f.endsWith('13-about.md'))!.text.toLowerCase();
		expect(about).toContain('заглушка');
		expect(about).toContain('имитатор');
	});
});
