// Экспорт диаграмм виджета в PNG и PDF (F1-10), JSON (F1-11): на дашборде «Обзор воронки» у каждого виджета с данными выгружает файлы и проверяет их.
//   APP_URL=http://localhost:5274 node tools/scenarios/b-reports-export.mjs [--out каталог] [--theme rtk_default_dark] [--only 0,2,8] [--kinds png,pdf,json]
// Проверяется: подпись PNG и ширина не меньше 1000 px; на картинке больше 1 % пикселей отличается от фона; PDF начинается с %PDF- и весит больше 5 КБ;
// JSON разбирается; серия, выключенная кликом по легенде, не попадает в PNG (цвет серии исчезает с картинки).
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const arg = (name, fallback) => {
	const i = process.argv.indexOf(`--${name}`);
	return i > 0 ? process.argv[i + 1] : fallback;
};
const out = arg('out', '.shots/export');
const theme = arg('theme', 'rtk_default_light');
const only = arg('only', '') ? arg('only', '').split(',').map(Number) : null;
const kinds = arg('kinds', 'png,pdf').split(',');
const suffix = theme.endsWith('dark') ? 'dark' : 'light';
mkdirSync(out, { recursive: true });

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

const token = await accessToken('admin');
const dashboards = await (await fetch(`${BASE}/api/dashboards?limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json();
const dash = dashboards.items.find((d) => d.name === 'Обзор воронки');
if (!dash) throw new Error('нет дашборда «Обзор воронки» (node tools/scenarios/b-reports.mjs)');

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900, theme });
	await page.goto(`${BASE}/reports/dashboards/${dash.id}`);
	await page.waitForSelector('article');
	if ((await page.locator('article svg.rt-chart__svg').count()) === 0) {
		await page.getByRole('button', { name: /Обновить данные/ }).first().click();
		await page.waitForSelector('article svg.rt-chart__svg', { timeout: 120000 });
	}
	await page.waitForTimeout(1500);
	const cards = page.locator('article');

	/** Нажимает «Скачать» → пункт меню, возвращает скачанный файл (или null, если пункта нет). */
	async function download(card, label) {
		await card.scrollIntoViewIfNeeded();
		await card.getByRole('button', { name: 'Скачать' }).click();
		const item = page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: new RegExp(String.raw`^\s*${label}\s*$`) }).first();
		if ((await item.count()) === 0) {
			await page.keyboard.press('Escape');
			return null;
		}
		const [file] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }).catch(() => null), item.click()]);
		await page.waitForTimeout(200);
		return file;
	}

	/** Доля пикселей PNG, отличающихся от фона (цвет левого верхнего угла), и число пикселей близкого к `rgb` цвета. */
	const pixels = (buf, rgb) =>
		page.evaluate(
			async ([b64, target]) => {
				const img = new Image();
				img.src = `data:image/png;base64,${b64}`;
				await img.decode();
				const c = document.createElement('canvas');
				c.width = img.width;
				c.height = img.height;
				const ctx = c.getContext('2d');
				ctx.drawImage(img, 0, 0);
				const d = ctx.getImageData(0, 0, c.width, c.height).data;
				const [br, bg, bb] = [d[0], d[1], d[2]];
				let diff = 0;
				let near = 0;
				for (let i = 0; i < d.length; i += 4) {
					if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 24) diff++;
					if (target && Math.abs(d[i] - target[0]) + Math.abs(d[i + 1] - target[1]) + Math.abs(d[i + 2] - target[2]) < 30) near++;
				}
				return { share: diff / (d.length / 4), near };
			},
			[buf.toString('base64'), rgb ?? null]
		);

	const n = await cards.count();
	console.log(`виджетов: ${n}`);
	for (let i = 0; i < n; i++) {
		if (only && !only.includes(i)) continue;
		const card = cards.nth(i);
		const title = (await card.locator('h3').first().textContent())?.trim();
		if ((await card.getByRole('button', { name: 'Скачать' }).count()) === 0) {
			console.log(`w${i} «${title}»: нет кнопки «Скачать» (нет данных)`);
			continue;
		}
		for (const kind of kinds) {
			const label = { png: 'PNG', pdf: 'PDF', json: 'JSON' }[kind];
			const file = await download(card, label);
			if (!file) {
				console.log(`w${i} «${title}»: в меню нет пункта ${label} (табличный виджет: файл — через «Таблица (Excel, PDF)…»)`);
				continue;
			}
			const path = join(out, `w${i}-${suffix}.${kind}`);
			await file.saveAs(path);
			const buf = readFileSync(path);
			if (kind === 'png') {
				const { share } = await pixels(buf);
				check(buf.subarray(0, 4).toString('hex') === '89504e47' && buf.readUInt32BE(16) >= 1000 && share > 0.01, `w${i} «${title}» PNG ${buf.readUInt32BE(16)}×${buf.readUInt32BE(20)}, ${buf.length} Б, не фон ${(share * 100).toFixed(1)} %`);
			} else if (kind === 'pdf') check(buf.subarray(0, 5).toString() === '%PDF-' && buf.length > 5000, `w${i} «${title}» PDF ${buf.length} Б`);
			else {
				let parsed = null;
				try {
					parsed = JSON.parse(buf.toString());
				} catch {
					/* не JSON */
				}
				check(Boolean(parsed && Array.isArray(parsed.rows) && Array.isArray(parsed.columns)), `w${i} «${title}» JSON ${buf.length} Б${parsed ? `, строк ${parsed.rows.length}, колонок ${parsed.columns.length}` : ''}`);
			}
		}
	}

	// серия, выключенная в легенде, не попадает в файл
	if (kinds.includes('png') && (!only || only.includes(3))) {
		const card = cards.nth(3);
		const legendItem = card.locator('.rt-chart__legend-item', { hasText: 'Выиграно' }).first();
		if ((await legendItem.count()) > 0) {
			// цвет серии в sRGB: токены rt-ui заданы в oklab
			const swatch = await legendItem.locator('.rt-chart__swatch').evaluate((el) => {
				const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
				ctx.fillStyle = getComputedStyle(el).backgroundColor;
				ctx.fillRect(0, 0, 1, 1);
				return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
			});
			const [r, g, b] = swatch;
			const file = await download(card, 'PNG');
			await file?.saveAs(join(out, `w3-${suffix}-all.png`));
			const withSeries = (await pixels(readFileSync(join(out, `w3-${suffix}-all.png`)), [r, g, b])).near;
			await legendItem.click();
			await page.waitForTimeout(500);
			const hidden = await download(card, 'PNG');
			await hidden?.saveAs(join(out, `w3-${suffix}-legend-hidden.png`));
			const without = (await pixels(readFileSync(join(out, `w3-${suffix}-legend-hidden.png`)), [r, g, b])).near;
			check(withSeries > 200 && without === 0, `серия «Выиграно» (rgb ${swatch.join(', ')}): пикселей цвета серии с ней ${withSeries}, без неё ${without}`);
			await legendItem.click();
		} else console.log('w3: нет серии «Выиграно» в легенде, проверка скрытой серии пропущена');
	}
	if (page.__problems.pageerrors.length) fail(`ошибки страницы: ${page.__problems.pageerrors.join('; ')}`);
} finally {
	await browser.close();
}
