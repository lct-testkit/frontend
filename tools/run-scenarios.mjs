// Раннер сценариев tools/scenarios: список и уровни — tools/scenarios/e2e.list.json. Каждый сценарий — отдельный процесс с таймаутом;
// код возврата 1, если упал хотя бы один; в конце таблица «сценарий — секунды — результат».
//   APP_URL=http://localhost:28080 node tools/run-scenarios.mjs --tier smoke       быстрые шесть
//   APP_URL=… node tools/run-scenarios.mjs --tier full [--retry 1] [--only a-deal-flow,c-sign] [--timeout 240]
// Сценарии создают и меняют данные: только живой бэкенд на одноразовом стенде (или демо, если не жалко записей), не мок-стенд.
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LIST = resolve(root, 'tools/scenarios/e2e.list.json');

/** Какие сценарии запускать на уровне: `smoke` — только быстрые, `full` — все. */
export function selectScenarios(list, tier = 'full', only = []) {
	const byTier = list.scenarios.filter((s) => (tier === 'smoke' ? s.tier === 'smoke' : true));
	return only.length ? byTier.filter((s) => only.includes(s.file.replace(/\.mjs$/, ''))) : byTier;
}

/** Сводка по результатам прогона: текст таблицы и код возврата. */
export function summarize(results) {
	const rows = results.map((r) => `${r.ok ? '✓' : '✗'} ${r.file.padEnd(34)} ${String(r.seconds).padStart(5)} с  ${r.ok ? 'ok' : r.timedOut ? 'таймаут' : `код ${r.code}`}${r.retried ? ' (после повтора)' : ''}`);
	const failed = results.filter((r) => !r.ok).length;
	rows.push('', failed ? `упало ${failed} из ${results.length}` : `все ${results.length} сценариев прошли`);
	return { text: rows.join('\n'), exitCode: failed ? 1 : 0 };
}

function runOne(file, timeoutMs) {
	return new Promise((done) => {
		const started = Date.now();
		const child = spawn(process.execPath, [resolve(root, 'tools/scenarios', file)], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], env: process.env });
		let timedOut = false;
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill();
		}, timeoutMs);
		child.on('close', (code) => {
			clearTimeout(timer);
			done({ file, ok: code === 0 && !timedOut, code, timedOut, seconds: Math.round((Date.now() - started) / 1000) });
		});
	});
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const args = process.argv.slice(2);
	const opt = (name, fallback) => {
		const i = args.indexOf(`--${name}`);
		return i > -1 ? args[i + 1] : fallback;
	};
	const tier = opt('tier', 'full');
	const retry = Number(opt('retry', '0'));
	const timeoutMs = Number(opt('timeout', '240')) * 1000;
	const only = opt('only', '')
		.split(',')
		.filter(Boolean);
	const list = JSON.parse(readFileSync(LIST, 'utf8'));
	const results = [];
	for (const s of selectScenarios(list, tier, only)) {
		console.log(`\n=== ${s.file} (${s.tier}) ===`);
		let r = await runOne(s.file, timeoutMs);
		// один повтор только для таймаута: упавшая проверка повтором не лечится
		if (!r.ok && r.timedOut && retry > 0) {
			console.log(`таймаут, повтор ${s.file}`);
			r = { ...(await runOne(s.file, timeoutMs)), retried: true };
		}
		results.push(r);
	}
	const { text, exitCode } = summarize(results);
	console.log(`\n${text}`);
	process.exitCode = exitCode;
}
