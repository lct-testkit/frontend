// Производительность клиента на большом списке без живого стенда (мок-стенд): открыть /deals при замедлении CPU в 4 раза, собрать LCP,
// размер JS первой загрузки (по сети, со сжатием), время до первой строки, догрузить все 1000 сделок и замерить длинные задачи.
//   APP_URL=http://localhost:4273 node tools/perf.mjs                 печатает JSON (медиана из трёх прогонов)
//   APP_URL=… node tools/perf.mjs --check                             сравнивает с tools/perf-baseline.json; код 1, если LCP или JS первой загрузки выросли больше чем на 20 %
//   APP_URL=… node tools/perf.mjs --update                            записывает замер в tools/perf-baseline.json
// Мерить нужно production-сборку (`pnpm build && pnpm preview`): dev-сервер отдаёт модули без сжатия и склейки, цифры с него бессмысленны.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from './lib.mjs';
import { newBrowser, newMockPage } from './mock/page.mjs';
import { createSampler, loadSpec, uuidFor } from './mock/sample.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE = resolve(here, 'perf-baseline.json');
const TOTAL = 1000;
const PAGE = 100;
const TOLERANCE = 0.2;
const CPU = Number(process.env.PERF_CPU ?? 4);
// сколько секунд догружать список: полный прогон (PERF_FULL=1) ждёт все 1000 строк, обычный — не дольше 30 с (при замедлении CPU догрузка тысячи строк занимает минуты)
const LOAD_CAP_MS = process.env.PERF_FULL ? 300000 : 30000;
const RUNS = Number(process.env.PERF_RUNS ?? 3);

const args = process.argv.slice(2);

/** 1000 сделок: страницы по `limit` (приложение просит 50) с курсором (`next_cursor` — смещение строкой), первая строка — по схеме ответа, остальные — её копии с разными id и названиями. */
function dealsOverride(state) {
	const spec = loadSpec();
	const sampler = createSampler(spec);
	const schema = spec.paths['/api/deals'].get.responses['200'].content['application/json'].schema;
	const template = sampler.sample(schema, 'deals').items[0];
	const row = (i) => ({ ...template, id: uuidFor(`deal-${i}`), title: `Сделка ${i + 1}`, number: `D-2026-${String(i + 1).padStart(5, '0')}` });
	return {
		method: 'GET',
		re: /^\/api\/deals$/,
		list: true,
		reply: ({ url }) => {
			const from = Number(url.searchParams.get('cursor') ?? 0) || 0;
			const limit = Math.min(Number(url.searchParams.get('limit') ?? PAGE) || PAGE, PAGE);
			const to = Math.min(from + limit, TOTAL);
			// счётчики вкладок («Все», «Под угрозой» …) спрашивают limit=1 — это не страницы списка
			if (limit > 1) {
				state.pages++;
				state.served = to;
			}
			return { items: Array.from({ length: to - from }, (_, k) => row(from + k)), next_cursor: to < TOTAL ? String(to) : null, total: TOTAL };
		}
	};
}

async function measureOnce(browser) {
	const state = { pages: 0, served: 0 };
	const page = await newMockPage(browser, 'kam', { overrides: [dealsOverride(state)] });
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
	await cdp.send('Network.enable');
	const jsUrls = new Map();
	let jsBytes = 0;
	cdp.on('Network.responseReceived', (e) => {
		if (/\.js(\?|$)/.test(e.response.url)) jsUrls.set(e.requestId, e.response.url);
	});
	cdp.on('Network.loadingFinished', (e) => {
		if (jsUrls.has(e.requestId)) jsBytes += e.encodedDataLength;
	});
	await page.addInitScript(() => {
		window.__lcp = 0;
		window.__long = [];
		new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true });
		new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ type: 'longtask', buffered: true });
	});
	const t0 = Date.now();
	await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
	await page.waitForFunction(() => document.body.innerText.includes('Сделка 1'), null, { timeout: 30000 });
	const firstRowMs = Date.now() - t0;
	await page.waitForLoadState('networkidle').catch(() => {});
	const firstLoadJsKb = Math.round(jsBytes / 1024);
	await page.waitForTimeout(500);
	const lcpMs = Math.round(await page.evaluate(() => window.__lcp || performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint')?.startTime || 0));
	const longBefore = await page.evaluate(() => window.__long.length);

	// догрузка кнопкой «Показать ещё»: подгрузка прокруткой срабатывает один раз (подвал таблицы липкий и всегда в поле зрения), а кнопка работает всегда
	const t1 = Date.now();
	const more = page.getByRole('button', { name: 'Показать ещё' });
	while (state.served < TOTAL && Date.now() - t1 < LOAD_CAP_MS) {
		const before = state.served;
		if (await more.count()) await more.first().click({ timeout: 5000 }).catch(() => {});
		await page.waitForFunction(() => !document.body.innerText.includes('Загрузка'), null, { timeout: 5000 }).catch(() => {});
		for (let k = 0; k < 40 && state.served === before && state.served < TOTAL; k++) await page.waitForTimeout(50);
	}
	const loadAllMs = Date.now() - t1;
	const long = await page.evaluate(() => window.__long);
	await page.context().close();
	return {
		lcpMs,
		firstLoadJsKb,
		firstRowMs,
		loadAllMs,
		pagesLoaded: state.pages,
		rowsLoaded: state.served,
		longTasksOnLoad: longBefore,
		longTasksOnScroll: long.length - longBefore,
		longestTaskMs: Math.round(Math.max(0, ...long))
	};
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

const browser = await newBrowser();
let result;
try {
	const runs = [];
	for (let i = 0; i < RUNS; i++) runs.push(await measureOnce(browser));
	result = Object.fromEntries(Object.keys(runs[0]).map((k) => [k, median(runs.map((r) => r[k]))]));
} finally {
	await browser.close();
}
console.log(JSON.stringify(result, null, 2));

if (result.rowsLoaded < TOTAL) console.log(`за ${LOAD_CAP_MS / 1000} с догружено ${result.rowsLoaded} строк из ${TOTAL} (PERF_FULL=1 ждёт все)`);
if (args.includes('--update')) {
	writeFileSync(BASELINE, JSON.stringify({ measuredAt: new Date().toISOString().slice(0, 10), runs: RUNS, cpuThrottle: 4, ...result }, null, '\t') + '\n');
	console.log(`записано в ${BASELINE}`);
}
if (args.includes('--check')) {
	if (!existsSync(BASELINE)) {
		console.error('нет tools/perf-baseline.json: сначала --update');
		process.exit(1);
	}
	const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
	for (const key of ['lcpMs', 'firstLoadJsKb']) {
		const limit = base[key] * (1 + TOLERANCE);
		const ok = result[key] <= limit;
		console.log(`${ok ? '✓' : '✗'} ${key}: ${result[key]} (база ${base[key]}, предел ${Math.round(limit)})`);
		if (!ok) process.exitCode = 1;
	}
}
