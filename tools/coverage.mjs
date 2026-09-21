// Which backend operations does the UI call? Compares docs/openapi.json with `api.<METHOD>('<path>'` calls (and raw fetches) in src/.
//   node tools/coverage.mjs            → summary + the list of operations nothing calls
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spec = JSON.parse(await readFile(resolve(root, 'docs/openapi.json'), 'utf8'));

const ops = [];
for (const [path, item] of Object.entries(spec.paths)) {
	for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
		if (item[method]) ops.push({ method: method.toUpperCase(), path, tag: item[method].tags?.[0] ?? '—', summary: item[method].summary ?? '' });
	}
}

async function walk(dir) {
	const out = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		const full = resolve(dir, e.name);
		if (e.isDirectory()) out.push(...(await walk(full)));
		else if (/\.(svelte|ts)$/.test(e.name) && !e.name.endsWith('.d.ts') && !e.name.endsWith('.test.ts')) out.push(full);
	}
	return out;
}
const files = await walk(resolve(root, 'src'));
const used = new Set();
const machine = new Set(); // called through raw fetch with a literal path

// api.GET('/api/x/{id}' … ) — the typed client
const typed = /\bapi\s*\.\s*(GET|POST|PUT|PATCH|DELETE)\s*\(\s*(['"`])([^'"`]+)\2/g;
// helpers that take (method, path) style or raw fetch('/api/…')
const raw = /fetch\(\s*[`'"]([^`'"]*\/(?:api|public)\/[^`'"?]*)/g;
for (const file of files) {
	const text = await readFile(file, 'utf8');
	for (const m of text.matchAll(typed)) used.add(`${m[1]} ${m[3]}`);
	for (const m of text.matchAll(raw)) machine.add(m[1].replace(/\$\{[^}]+\}/g, '{}'));
}

// raw fetch paths cover any method of a matching template path
const norm = (p) => p.replace(/\{[^}]+\}/g, '{}');
const rawSet = new Set([...machine].map(norm));

const covered = [];
const missing = [];
for (const op of ops) {
	const key = `${op.method} ${op.path}`;
	if (used.has(key) || rawSet.has(norm(op.path))) covered.push(op);
	else missing.push(op);
}

console.log(`operations in OpenAPI: ${ops.length} · called from the UI: ${covered.length} (${Math.round((covered.length / ops.length) * 100)}%) · not called: ${missing.length}\n`);
const byTag = new Map();
for (const op of missing) byTag.set(op.tag, [...(byTag.get(op.tag) ?? []), op]);
for (const [tag, list] of [...byTag].sort()) {
	console.log(`## ${tag}`);
	for (const op of list) console.log(`  ${op.method.padEnd(6)} ${op.path}  — ${op.summary}`);
}
