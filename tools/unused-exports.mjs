// Экспорты из src/lib, чьё имя не встречается в других файлах (эвристика по тексту имени, граф импортов не строится).
//   node tools/unused-exports.mjs            список: «нигде» и «только тесты»
//   node tools/unused-exports.mjs --max N    код 1, если экспортов без вызывающего кода (даже тестового) больше N
// Имя в динамическом обращении (по ключу из строки) скрипт не видит: после удаления гоняйте сценарии на стенде.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const BS = String.fromCharCode(92); // обратная косая черта: для границ слова в RegExp
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
(function walk(d) {
	for (const n of readdirSync(d)) {
		const p = join(d, n);
		if (statSync(p).isDirectory()) walk(p);
		else if (/\.(ts|svelte)$/.test(n) && !n.endsWith('.d.ts')) files.push(p);
	}
})(join(root, 'src'));
const text = new Map(files.map((f) => [f, readFileSync(f, 'utf8')]));
const isTest = (f) => /\.test\.ts$/.test(f);
const rows = [];
for (const [file, body] of text) {
	if (isTest(file) || !file.includes(join('src', 'lib'))) continue;
	for (const m of body.matchAll(/^export\s+(?:async\s+)?(?:function\*?|const|let|class|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
		const re = new RegExp(BS + 'b' + m[1].split('$').join(BS + '$') + BS + 'b');
		let used = false;
		let usedInTest = false;
		for (const [other, t] of text) {
			if (other === file || !re.test(t)) continue;
			if (isTest(other)) usedInTest = true;
			else used = true;
		}
		if (!used) rows.push({ file: relative(root, file).split(sep).join('/'), name: m[1], onlyTests: usedInTest });
	}
}
rows.sort((a, b) => a.file.localeCompare(b.file) || a.name.localeCompare(b.name));
for (const r of rows) console.log(`${r.file}  ${r.name}${r.onlyTests ? '  (только тесты)' : ''}`);
const nowhere = rows.filter((r) => !r.onlyTests).length;
console.log(`\nвсего: ${rows.length}, нигде: ${nowhere}, только в тестах: ${rows.length - nowhere}`);
const i = process.argv.indexOf('--max');
const max = i > -1 ? Number(process.argv[i + 1]) : Number.NaN;
if (Number.isFinite(max) && rows.length > max) {
	console.error(`экспортов без вызывающего кода ${rows.length} > ${max}`);
	process.exitCode = 1;
}
