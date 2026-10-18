// Числа в шапке README считаются из кода, а не пишутся руками.
//   node tools/fill-stats.mjs                    переписать блок <!--STATS--> в README.md
//   node tools/fill-stats.mjs --check            код 1, если README отстал от кода
//   node tools/fill-stats.mjs --print            напечатать числа (JSON)
//   node tools/fill-stats.mjs --tests-json FILE  взять число тестов из готового отчёта vitest (--reporter=json), не запуская его
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdtempSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const README = join(root, 'README.md');
/** Блоки B1–B15 — история приёмки из docs/REBUILD-PLAN.md, не код. */
export const BLOCKS = 15;

export const plural = (n, [one, few, many]) =>
	n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

export function render(s) {
	return [
		`**${s.screens}** ${plural(s.screens, ['экран', 'экрана', 'экранов'])}`,
		`**${s.called}** из **${s.operations}** ручек API с экранами`,
		`**${s.components}** ${plural(s.components, ['компонент', 'компонента', 'компонентов'])} \`lib/ui\``,
		`**${BLOCKS}** блоков B1–B${BLOCKS} (приняты)`,
		`**${s.tests}** ${plural(s.tests, ['тест', 'теста', 'тестов'])} клиента`,
		`**${s.roles}** ${plural(s.roles, ['роль', 'роли', 'ролей'])}`,
		`**${s.themes}** ${plural(s.themes, ['тема', 'темы', 'тем'])}`
	].join(' &nbsp;·&nbsp; ');
}

const BLOCK_RE = /(<!--STATS-->\n)[\s\S]*?(\n<!--\/STATS-->)/;
export function replaceBlock(readme, line) {
	if (!BLOCK_RE.test(readme)) throw new Error('в README нет маркеров <!--STATS-->');
	return readme.replace(BLOCK_RE, (_m, a, b) => `${a}${line}${b}`);
}

function walk(dir, pick, out = []) {
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) walk(p, pick, out);
		else if (pick(e.name)) out.push(p);
	}
	return out;
}

// --- по одной функции на число ---
export const countScreens = () => walk(join(root, 'src/routes'), (n) => n === '+page.svelte').length;
export const countComponents = () => walk(join(root, 'src/lib/ui'), (n) => n.endsWith('.svelte')).length;
export const countThemes = () => {
	const m = readFileSync(join(root, 'src/lib/stores/theme.svelte.ts'), 'utf8').match(/(?:export )?const THEMES = \[([^\]]*)\]/);
	if (!m) throw new Error('THEMES не найден в theme.svelte.ts');
	return (m[1].match(/'[^']+'/g) ?? []).length;
};
export const countRoles = () => {
	const cfg = JSON.parse(readFileSync(join(root, 'static/config.json'), 'utf8'));
	return new Set(cfg.demoAccounts.map((a) => a.role)).size;
};
export function countOperations() {
	const r = spawnSync(process.execPath, [join(root, 'tools/coverage.mjs'), '--json'], { encoding: 'utf8' });
	if (r.status !== 0) throw new Error(`coverage.mjs --json: ${r.stderr}`);
	const j = JSON.parse(r.stdout);
	return { operations: j.operations, called: j.called };
}
export function countTests(jsonFile) {
	let file = jsonFile;
	if (!file) {
		file = join(mkdtempSync(join(tmpdir(), 'stats-')), 'vitest.json');
		const r = spawnSync(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', '--reporter=json', `--outputFile=${file}`], { cwd: root, encoding: 'utf8' });
		if (!existsSync(file)) throw new Error(`vitest не дал отчёт: ${r.stderr}`);
	}
	return JSON.parse(readFileSync(file, 'utf8')).numTotalTests;
}

export function collect(jsonFile) {
	return { screens: countScreens(), ...countOperations(), components: countComponents(), tests: countTests(jsonFile), roles: countRoles(), themes: countThemes() };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const argv = process.argv.slice(2);
	const ti = argv.indexOf('--tests-json');
	const stats = collect(ti >= 0 ? argv[ti + 1] : undefined);
	if (argv.includes('--print')) {
		console.log(JSON.stringify(stats, null, 2));
	} else {
		const current = readFileSync(README, 'utf8');
		const next = replaceBlock(current, render(stats));
		if (argv.includes('--check')) {
			if (next !== current) {
				console.error('README.md отстал от кода: выполните `node tools/fill-stats.mjs` и закоммитьте README.\nДолжно быть:\n' + render(stats));
				process.exit(1);
			}
			console.log('README.md: числа в блоке STATS совпадают с кодом');
		} else {
			writeFileSync(README, next);
			console.log(next === current ? 'README.md: без изменений' : 'README.md: блок STATS обновлён');
		}
	}
}
