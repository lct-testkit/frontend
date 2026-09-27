// Guard: optional fields carry NO suffix — only required ones are marked (the DS asterisk, `required` prop).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string, out: string[] = []): string[] {
	for (const name of readdirSync(dir)) {
		const p = join(dir, name);
		if (statSync(p).isDirectory()) walk(p, out);
		else if (/\.svelte$/.test(name)) out.push(p);
	}
	return out;
}

describe('required-field policy', () => {
	const files = walk(join(process.cwd(), 'src'));

	it('has no "(необязательно)" / "(опционально)" suffixes in labels', () => {
		const bad = files.filter((f) => /\((?:не\s?обязательно|опционально|optional)\)/i.test(readFileSync(f, 'utf8')));
		expect(bad).toEqual([]);
	});

	it('has no hand-made " *" in field labels (use the required prop)', () => {
		const bad = files.filter((f) => /label=\{[^}]*\} \*`|label="[^"]+ \*"/.test(readFileSync(f, 'utf8')));
		expect(bad).toEqual([]);
	});

	it('has no hand-made asterisk spans next to labels', () => {
		const bad = files.filter((f) => /<span[^>]*>\s*\*\s*<\/span>|\{label\}\s*\*/.test(readFileSync(f, 'utf8')));
		expect(bad).toEqual([]);
	});
});
