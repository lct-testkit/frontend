// Проверка актуальности справки в запросе (без зависимостей, нужны только git и node):
//   node tools/check-help.mjs --base origin/main     сравнить с веткой, в которую идёт запрос
//   node tools/check-help.mjs --strict               предупреждения о картинках считать ошибками
// Ошибка (код 1): менялись главы, картинки, индекс глав или каталог ошибок, а `HELP_REV` не поднят.
//   Обход для правки опечатки — строка `[help-rev: skip]` в сообщении любого коммита ветки.
// Предупреждение (`::warning file=…::` в аннотациях CI): картинка старше файлов, от которых она зависит (tools/help-shots.manifest.json).
// Коды возврата: 0 — чисто, 1 — ошибка, 2 — неверные аргументы.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { needsRevBump, revOf, staleShots } from './lib/help-checks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REV_FILE = 'src/lib/stores/help-attention.svelte.ts';

const args = process.argv.slice(2);
const strict = args.includes('--strict');
const baseIdx = args.indexOf('--base');
const base = baseIdx > -1 ? args[baseIdx + 1] : null;
if (args.some((a) => a.startsWith('--') && !['--strict', '--base'].includes(a)) || (baseIdx > -1 && !base)) {
	console.error('использование: node tools/check-help.mjs [--base <ветка>] [--strict]');
	process.exit(2);
}

const git = (...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitTry = (...a) => {
	try {
		return git(...a);
	} catch {
		return '';
	}
};

let errors = 0;
let warnings = 0;

// 1. HELP_REV поднят, если менялась справка
if (base) {
	const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
	if (needsRevBump(changed)) {
		const before = revOf(git('show', `${base}:${REV_FILE}`));
		const after = revOf(readFileSync(resolve(root, REV_FILE), 'utf8'));
		const skipped = git('log', `${base}..HEAD`, '--format=%B').includes('[help-rev: skip]');
		if (before === after && !skipped) {
			console.error(`::error file=${REV_FILE}::Справка изменена, а HELP_REV остался ${after}: поднимите дату, чтобы метка «Справка просит внимания» загорелась у тех, кто читал прежнюю (для правки опечатки добавьте в сообщение коммита [help-rev: skip])`);
			errors++;
		} else {
			console.log(`HELP_REV: ${before} → ${after}${before === after ? ' (пропуск: [help-rev: skip])' : ''}`);
		}
	} else {
		console.log('HELP_REV: справка в запросе не менялась');
	}
}

// 2. картинка не старше своих источников
const manifest = JSON.parse(readFileSync(resolve(root, 'tools/help-shots.manifest.json'), 'utf8')).shots;
const time = (path) => Number(gitTry('log', '-1', '--format=%ct', '--', path)) || 0;
const times = {};
for (const shot of manifest) {
	times[shot.file] = time(shot.file);
	for (const src of shot.sources ?? []) times[src] ??= time(src);
}
for (const shot of staleShots(manifest, times)) {
	const newest = shot.sources.filter((s) => times[s] > times[shot.file]).join(', ');
	console.log(`::warning file=${shot.file}::Картинка «${shot.name}» могла устареть: после неё менялись ${newest}. Переснимите (node tools/help-shots.mjs --only ${shot.name}) и проверьте главу`);
	warnings++;
}

if (errors || (strict && warnings)) {
	console.error(`справка: ошибок ${errors}, предупреждений ${warnings}${strict && warnings ? ' (--strict)' : ''}`);
	process.exit(1);
}
console.log(`справка: чисто${warnings ? ` (предупреждений: ${warnings})` : ''}`);
