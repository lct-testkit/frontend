// Сверка двух OpenAPI-схем «по смыслу» (порядок ключей игнорируется — backend пишет их отсортированными,
// gen-api — в порядке приложения).
//
//   node tools/check-contract.mjs docs/openapi.json /path/to/backend-openapi.json
//
// Код возврата 1 и список расхождений (пути, операции, схемы), если контракт фронтенда отстал от backend.
// Лечение: pnpm gen:api --url <backend openapi.json> и закоммитить результат.
import { readFile } from 'node:fs/promises';

const canon = (v) =>
	Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
const load = async (path) => canon(JSON.parse(await readFile(path, 'utf8')));

const [frontPath, backPath] = process.argv.slice(2);
if (!frontPath || !backPath) {
	console.error('использование: check-contract.mjs <frontend openapi.json> <backend openapi.json>');
	process.exit(2);
}
const front = await load(frontPath);
const back = await load(backPath);

const problems = [];
const ops = (doc) => {
	const out = {};
	for (const [path, item] of Object.entries(doc.paths ?? {})) for (const [method, op] of Object.entries(item)) out[`${method.toUpperCase()} ${path}`] = JSON.stringify(op);
	return out;
};
const f = ops(front);
const b = ops(back);
for (const key of Object.keys(b)) {
	if (!(key in f)) problems.push(`нет во frontend: ${key}`);
	else if (f[key] !== b[key]) problems.push(`изменилась операция: ${key}`);
}
for (const key of Object.keys(f)) if (!(key in b)) problems.push(`удалена в backend: ${key}`);

const fs = front.components?.schemas ?? {};
const bs = back.components?.schemas ?? {};
for (const key of Object.keys(bs)) {
	if (!(key in fs)) problems.push(`нет схемы во frontend: ${key}`);
	else if (JSON.stringify(fs[key]) !== JSON.stringify(bs[key])) problems.push(`изменилась схема: ${key}`);
}
for (const key of Object.keys(fs)) if (!(key in bs)) problems.push(`схема удалена в backend: ${key}`);

if (problems.length) {
	console.error(`Контракт frontend расходится с backend (${problems.length}):`);
	for (const p of problems.slice(0, 40)) console.error(`  - ${p}`);
	if (problems.length > 40) console.error(`  … и ещё ${problems.length - 40}`);
	console.error('\nОбновите: pnpm gen:api --url <путь к backend/openapi.json> && закоммитьте docs/openapi.json, src/lib/api/schema.d.ts, docs/api-endpoints.md');
	process.exit(1);
}
console.log(`контракты совпадают: ${Object.keys(b).length} операций, ${Object.keys(bs).length} схем`);
