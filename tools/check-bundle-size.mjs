// Бюджет размера бандла: требование «отклик UI ≤ 1 с» (спека §0) во многом упирается в объём JS/CSS,
// который браузер тянет по слабому каналу вуза. Скрипт считает gzip-размер результата `pnpm build` и
// падает, если он превысил бюджет из tools/bundle-budget.json.
//
//   pnpm build && node tools/check-bundle-size.mjs            проверить
//   node tools/check-bundle-size.mjs --update                 записать текущие размеры +10% как новый бюджет
//
// Бюджет — «потолок», а не цель: поднимайте его осознанно (в PR с объяснением), а не молча.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const budgetFile = join(root, 'tools/bundle-budget.json');
const update = process.argv.includes('--update');

async function* walk(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) yield* walk(path);
		else yield path;
	}
}

const stats = { jsTotalKb: 0, cssTotalKb: 0, largestJsKb: 0, largestJsFile: '' };
for await (const file of walk(buildDir)) {
	if (!/\.(js|mjs|css)$/.test(file)) continue;
	// воркер pdf.js — отдельный файл, грузится только на странице с PDF; в бюджет «первого экрана» не входит
	if (/pdf\.worker/.test(file)) continue;
	const gz = gzipSync(await readFile(file)).length / 1024;
	if (file.endsWith('.css')) stats.cssTotalKb += gz;
	else {
		stats.jsTotalKb += gz;
		if (gz > stats.largestJsKb) Object.assign(stats, { largestJsKb: gz, largestJsFile: file.replace(buildDir, '') });
	}
}
const round = (n) => Math.round(n * 10) / 10;
const current = { jsTotalKb: round(stats.jsTotalKb), cssTotalKb: round(stats.cssTotalKb), largestJsKb: round(stats.largestJsKb) };

if (update) {
	const budget = Object.fromEntries(Object.entries(current).map(([k, v]) => [k, Math.ceil(v * 1.1)]));
	await writeFile(budgetFile, JSON.stringify({ _comment: 'gzip, КиБ. Потолок = замер + 10%. Обновление: node tools/check-bundle-size.mjs --update', ...budget }, null, '\t') + '\n');
	console.log('бюджет обновлён:', budget, 'от замера', current);
	process.exit(0);
}

const budget = JSON.parse(await readFile(budgetFile, 'utf8'));
let failed = false;
const rows = [];
for (const key of Object.keys(current)) {
	const over = current[key] > budget[key];
	failed ||= over;
	rows.push(`${over ? '❌' : '✅'} ${key.padEnd(14)} ${String(current[key]).padStart(8)} КиБ (бюджет ${budget[key]})`);
}
console.log(rows.join('\n'));
console.log(`самый большой JS-чанк: ${stats.largestJsFile}`);
if (process.env.GITHUB_STEP_SUMMARY) {
	const md = `### Размер бандла (gzip)\n\n| метрика | КиБ | бюджет |\n|---|---|---|\n${Object.keys(current).map((k) => `| ${k} | ${current[k]} | ${budget[k]} |`).join('\n')}\n\n`;
	await writeFile(process.env.GITHUB_STEP_SUMMARY, md, { flag: 'a' });
}
if (failed) {
	console.error('\nБюджет размера бандла превышен. Если рост осознанный — node tools/check-bundle-size.mjs --update и объясните в PR.');
	process.exit(1);
}
