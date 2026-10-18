// Сводка покрытия тестами в Markdown: итог и разбивка по модулям src/lib (читает coverage/coverage-summary.json после `vitest run --coverage`).
//   node tools/coverage-summary.mjs >> "$GITHUB_STEP_SUMMARY"
import { readFileSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Группа файла: `features/<область>` для features, иначе первая папка (или сам файл) в src/lib. */
export function groupOf(file) {
	const rel = file.split(sep).join('/').split('/src/lib/')[1];
	if (!rel) return null;
	const parts = rel.split('/');
	return parts[0] === 'features' && parts.length > 2 ? parts.slice(0, 2).join('/') : parts[0];
}

export function summarize(json) {
	const groups = new Map();
	for (const [file, v] of Object.entries(json)) {
		const key = file === 'total' ? null : groupOf(file);
		if (!key) continue;
		const g = groups.get(key) ?? { lines: [0, 0], branches: [0, 0], functions: [0, 0] };
		for (const k of Object.keys(g)) {
			g[k][0] += v[k].covered;
			g[k][1] += v[k].total;
		}
		groups.set(key, g);
	}
	return groups;
}

const pct = ([c, t]) => (t === 0 ? '—' : `${Math.round((100 * c) / t)}%`);

export function toMarkdown(json) {
	const t = json.total;
	const rows = [...summarize(json)].sort(([a], [b]) => a.localeCompare(b));
	return [
		'### Покрытие unit-тестами',
		'',
		`Итого: строки ${t.lines.pct}%, ветки ${t.branches.pct}%, функции ${t.functions.pct}%. Пороги — в \`vite.config.ts\`.`,
		'',
		'| Модуль | Строки | Ветки | Функции |',
		'|---|---:|---:|---:|',
		...rows.map(([k, g]) => `| \`${k}\` | ${pct(g.lines)} | ${pct(g.branches)} | ${pct(g.functions)} |`)
	].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	console.log(toMarkdown(JSON.parse(readFileSync(resolve(root, 'coverage/coverage-summary.json'), 'utf8'))));
}
