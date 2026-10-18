// Три состояния экрана по коду: для каждого +page.svelte обходит импорты внутри features/ и routes/ (глубина 3) и ищет признаки
// загрузки, пустого списка и ошибки. Это эвристика: «есть» значит «экран умеет показать состояние», а не «показывает его на каждом запросе».
//   node tools/screen-states.mjs [--json]
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const MAX_DEPTH = 3;
const STRONG = {
	loading: /<Skeleton|loading=\{|\{#await|aria-busy/,
	empty: /<EmptyState|emptyText=|\{emptyText\}|empty=\{|\{#snippet empty/,
	error: /<ErrorState|onRetry=|error=\{(?!errors)/
};

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) yield* walk(path);
		else yield path;
	}
}

function resolveImport(from, spec) {
	const base = spec.startsWith('$lib/') ? join(src, 'lib', spec.slice(5)) : spec.startsWith('.') ? resolve(dirname(from), spec) : null;
	if (!base) return null;
	return [base, base + '.ts', base + '.svelte.ts', base + '.svelte'].find((c) => existsSync(c) && statSync(c).isFile()) ?? null;
}

const ownCode = (f) => f.startsWith(join(src, 'lib', 'features')) || f.startsWith(join(src, 'routes'));

function closure(start) {
	const seen = new Set([start]);
	let frontier = [start];
	for (let depth = 0; depth < MAX_DEPTH; depth++) {
		const next = [];
		for (const file of frontier) {
			for (const m of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
				const found = resolveImport(file, m[1]);
				if (found && !seen.has(found) && /\.(svelte|ts)$/.test(found) && !found.endsWith('.test.ts') && ownCode(found)) {
					seen.add(found);
					next.push(found);
				}
			}
		}
		frontier = next;
	}
	return [...seen];
}

/** -> [{ route, dataTable, loading, empty, error }]: значение true, если признак найден */
export function scan() {
	return [...walk(join(src, 'routes'))]
		.filter((p) => p.endsWith('+page.svelte'))
		.sort()
		.map((page) => {
			const texts = closure(page).map((f) => readFileSync(f, 'utf8'));
			const route = '/' + relative(join(src, 'routes'), dirname(page)).replaceAll('\\', '/').replace(/\(app\)\/?/g, '');
			return {
				route: route.length > 1 ? route.replace(/\/$/, '') : '/',
				dataTable: texts.some((t) => t.includes('<DataTable')),
				...Object.fromEntries(Object.entries(STRONG).map(([k, re]) => [k, texts.some((t) => re.test(t))]))
			};
		});
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
	const rows = scan();
	if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
	else for (const r of rows) console.log(r.route.padEnd(44), r.dataTable ? 'DT ' : '-  ', r.loading ? 'load ' : '---- ', r.empty ? 'empty ' : '----- ', r.error ? 'error' : '-----');
}
