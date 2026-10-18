// Смена выборки в таблице сделок: старые строки не должны «улетать» (регресс: строки съезжали поверх меню при переходе данные → пусто).
//   APP_URL=http://localhost:5275 node tools/scenarios/e-fly.mjs [--shots dir] [--size phone]
import { mkdirSync } from 'node:fs';
import { BASE, SIZES, newBrowser, newPage } from '../lib.mjs';
const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const shots = arg('--shots');
const size = arg('--size') ?? 'desktop';
if (shots) mkdirSync(shots, { recursive: true });
const [width, height] = SIZES[size];
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width, height });
await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
await page.waitForSelector('[role="row"], .atmr-tablegrid__layout, .animate-pulse', { timeout: 15000 });
await page.waitForTimeout(1500);

/** во время перехода пишем положение и прозрачность каждой строки/карточки каждый кадр */
async function watch(action) {
	await page.evaluate(() => {
		window.__fly = [];
		const t0 = performance.now();
		const tick = () => {
			const rows = [...document.querySelectorAll('[data-table-row="true"], .atmr-tablegrid__cell')].filter((r) => { const b = r.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
			const info = rows.slice(0, 40).map((r) => { const b = r.getBoundingClientRect(); const s = getComputedStyle(r); return { x: Math.round(b.x), y: Math.round(b.y), o: +s.opacity, t: s.transform }; });
			const main = document.querySelector('main')?.getBoundingClientRect();
			const odd = rows.find((r) => r.getBoundingClientRect().x < 256); const chain = []; for (let e = odd; e && e !== document.body; e = e.parentElement) { const bb = e.getBoundingClientRect(); const c = getComputedStyle(e); chain.push(`${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')} rect=${Math.round(bb.x)},${Math.round(bb.y)} ${Math.round(bb.width)}x${Math.round(bb.height)} disp=${c.display} pos=${c.position} left=${c.left} style=${(e.getAttribute('style') || '').slice(0, 90)}`); }
			window.__fly.push({ chain: chain.slice(0, 9), at: Math.round(performance.now() - t0), n: rows.length, info, mainX: main ? Math.round(main.x) : null });
			if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
		};
		requestAnimationFrame(tick);
	});
	const t = Date.now();
	await action();
	let i = 0;
	while (shots && Date.now() - t < 600) { await page.screenshot({ path: `${shots}/${size}-${String(i++).padStart(2, '0')}.png` }); }
	await page.waitForTimeout(1600);
	return page.evaluate(() => window.__fly);
}

// сначала пустая вкладка: данные → пусто
const tab = (name) => page.getByRole('tab', { name: new RegExp(name) }).first();
const tr = await watch(() => tab('Под угрозой').click());
const flyers = tr.filter((f) => f.info.some((r) => r.x < f.mainX - 2 || (r.t !== 'none' && r.t !== 'matrix(1, 0, 0, 1, 0, 0)') || (r.o > 0 && r.o < 1)));
console.log(`кадров ${tr.length}; кадров с летящими/полупрозрачными строками: ${flyers.length}`);
if (flyers.length) console.log(JSON.stringify(flyers[0].chain, null, 1));
// обратно: пусто → данные
const back = await watch(() => tab('Все').click());
const flyers2 = back.filter((f) => f.info.some((r) => r.x < f.mainX - 2 || (r.o > 0 && r.o < 1)));
console.log(`обратно: кадров ${back.length}; с летящими/полупрозрачными: ${flyers2.length}; строк в конце: ${back.at(-1).n}`);
await browser.close();
process.exit(flyers.length + flyers2.length ? 1 : 0);
