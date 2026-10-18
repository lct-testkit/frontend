// Ночная сверка справки с соседними репозиториями (без зависимостей; нужны node и tar):
//   node tools/check-help-drift.mjs
// 1. Каждый скрипт (`scripts/<имя>`) и каждая переменная окружения из руководства администратора (src/lib/content/help/admin/*.md)
//    есть в репозитории deploy@main. Нужен токен чтения DEPLOY_READ_TOKEN.
// 2. Список кодов в docs/error-catalog.json совпадает с перечнем `code` в openapi.json бэкенда@main. Нужен токен BACKEND_READ_TOKEN.
// Нет токена — печатается ::warning:: и проверка пропускается (а не молча «зеленеет»). Коды возврата: 0 — чисто или пропущено, 1 — расхождение.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { envVarsIn, scriptsIn } from './lib/help-checks.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORG = 'lct-testkit';
let failed = false;

const fail = (msg) => {
	console.error(`::error::${msg}`);
	failed = true;
};

async function github(path, token, accept = 'application/vnd.github+json') {
	const res = await fetch(`https://api.github.com/repos/${ORG}/${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: accept }, redirect: 'follow' });
	if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
	return res;
}

function* walk(dir) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) yield* walk(full);
		else yield full;
	}
}

// --- 1. руководство администратора и репозиторий deploy
const adminDir = resolve(root, 'src/lib/content/help/admin');
const guide = readdirSync(adminDir)
	.filter((f) => f.endsWith('.md'))
	.map((f) => readFileSync(join(adminDir, f), 'utf8'))
	.join('\n');
const scripts = scriptsIn(guide);
const vars = envVarsIn(guide);

const deployToken = process.env.DEPLOY_READ_TOKEN;
if (!deployToken) {
	console.log('::warning::DEPLOY_READ_TOKEN не задан — сверка скриптов и переменных руководства администратора с deploy@main пропущена (Settings -> Secrets репозитория)');
} else {
	try {
		const work = mkdtempSync(join(tmpdir(), 'deploy-'));
		const archive = join(work, 'deploy.tgz');
		writeFileSync(archive, Buffer.from(await (await github('deploy/tarball/main', deployToken)).arrayBuffer()));
		mkdirSync(join(work, 'src'));
		execFileSync('tar', ['-xzf', archive, '-C', join(work, 'src'), '--strip-components=1']);
		const src = join(work, 'src');
		const texts = [...walk(src)]
			.filter((f) => !/\.(png|jpg|gif|ico|woff2?|gz|tgz|zip)$/i.test(f))
			.map((f) => readFileSync(f, 'utf8'));
		const all = texts.join('\n');
		for (const s of scripts) if (!existsSync(join(src, 'scripts', s))) fail(`Руководство администратора ссылается на scripts/${s}, а в deploy@main такого скрипта нет`);
		for (const v of vars) if (!new RegExp(`\\b${v}\\b`).test(all)) fail(`Руководство администратора упоминает переменную ${v}, а в deploy@main её нет`);
		console.log(`deploy@main: проверено скриптов ${scripts.length}, переменных ${vars.length}`);
	} catch (e) {
		fail(`Не удалось сверить с deploy@main: ${e.message}`);
	}
}

// --- 2. каталог ошибок и бэкенд
const backendToken = process.env.BACKEND_READ_TOKEN;
if (!backendToken) {
	console.log('::warning::BACKEND_READ_TOKEN не задан — сверка docs/error-catalog.json с backend@main пропущена');
} else {
	try {
		const schema = await (await github('backend/contents/openapi.json?ref=main', backendToken, 'application/vnd.github.raw+json')).json();
		const api = new Set(schema.components.schemas.Problem.properties.code.enum);
		const catalog = new Set(JSON.parse(readFileSync(resolve(root, 'docs/error-catalog.json'), 'utf8')).codes.map((c) => c.code));
		for (const c of api) if (!catalog.has(c)) fail(`Код ${c} есть в backend@main, но нет в docs/error-catalog.json (добавьте запись и выполните node tools/gen-error-chapter.mjs)`);
		for (const c of catalog) if (!api.has(c)) fail(`Код ${c} есть в docs/error-catalog.json, но нет в backend@main`);
		console.log(`backend@main: кодов в каталоге ${catalog.size}, в API ${api.size}`);
	} catch (e) {
		fail(`Не удалось сверить с backend@main: ${e.message}`);
	}
}

process.exit(failed ? 1 : 0);
