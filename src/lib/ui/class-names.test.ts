// Guard against a Tailwind name clash: `rounded-s` / `rounded-m` / `rounded-l` are NOT radius sizes (`-s` = start corners, `-l` = left
// corners), so a card written with `rounded-l` gets a 4 px left edge and a 12 px right one. Sizes are `rounded-sm | md | lg`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return walk(path);
		return /\.(svelte|ts|css|html)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.d.ts') ? [path] : [];
	});
}

describe('tailwind class names', () => {
	it('no rounded-s / rounded-m / rounded-l (use rounded-sm / rounded-md / rounded-lg)', () => {
		const bad = walk('src').flatMap((file) =>
			readFileSync(file, 'utf8')
				.split('\n')
				.flatMap((line, i) => (/(?<![\w-])rounded-[sml](?![\w-])/.test(line) ? [`${file}:${i + 1}`] : []))
		);
		expect(bad).toEqual([]);
	});
});
