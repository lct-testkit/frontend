// Импорт (агент B): сквозной сценарий под ADMIN на живом бэкенде — реальный xlsx на 240 строк (часть строк с ошибками) и csv.
// Файлы готовит скрипт из README раздела (openpyxl в контейнере) → .shots/b-data/orgs.xlsx, products.csv.
//   node tools/scenarios/b-imports.mjs
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const XLSX = resolve('.shots/b-data/orgs.xlsx');
const CSV = resolve('.shots/b-data/products.csv');
if (!existsSync(XLSX) || !existsSync(CSV)) throw new Error('нет файлов .shots/b-data — сначала сгенерируйте (см. заголовок)');

async function api(method, path, body) {
	const token = await accessToken('admin');
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function run(page, file, entityLabel) {
	await page.goto(`${BASE}/imports/new`);
	await page.locator('label.atmr-radiobutton', { hasText: new RegExp(entityLabel) }).click(); // настоящий <input type=radio> у DS скрыт, кликаем по подписи
	await page.locator('input[type=file]').setInputFiles(file);
	await page.getByRole('button', { name: 'Загрузить и продолжить' }).click();
	await page.waitForSelector('text=Колонка файла', { timeout: 30000 });
	ok('шаг 1 → 2: файл загружен, профиль получен');
	const rows = await page.locator('.atmr-input:has(.atmr-select), .atmr-select').count();
	console.log(`    полей сопоставления: ${rows}`);
	// автоподбор: «Далее» должна быть доступна без ручных правок для наших заголовков
	const next = page.getByRole('button', { name: 'Далее', exact: true });
	check(await next.isEnabled(), 'автоподбор сопоставил ключевое поле — «Далее» доступна');
	await next.click();
	await page.waitForSelector('text=Всего строк в файле', { timeout: 60000 });
	const tiles = await page.locator('.tabular-nums').allTextContents();
	console.log(`    плитки проверки: ${tiles.map((t) => t.trim()).join(' | ')}`);
	const url = page.url();
	const jobId = new URL(url).searchParams.get('job');
	const job = (await api('GET', `/api/imports/${jobId}`)).json;
	check(job.status === 'validated' && job.total_rows > 0, `dry-run: ${job.total_rows} строк, ok=${job.ok_rows} warn=${job.warn_rows} err=${job.error_rows}`);
	return { jobId, job };
}

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });

	console.log('xlsx: организации (240 строк)');
	const { jobId, job } = await run(page, XLSX, 'Организации');
	check(job.total_rows === 240, 'в файле 240 строк данных');
	check(job.error_rows >= 5, `строки с намеренными ошибками найдены (${job.error_rows})`);
	check(Boolean(job.result_file_id), 'есть файл отчёта об ошибках');
	await page.screenshot({ path: '.shots/b-data/imports-step3.png' });

	await page.getByRole('button', { name: /^Применить/ }).click();
	await page.waitForSelector('text=Импорт завершён', { timeout: 90000 });
	ok('применение: «Импорт завершён»');
	const done = (await api('GET', `/api/imports/${jobId}`)).json;
	check(done.status.startsWith('completed') && done.rollback_available, `статус ${done.status}, откат доступен`);
	const orgs = (await api('GET', '/api/organizations?q=демо-импорт&limit=100')).json;
	check(orgs.items.length > 0, `в базе появились организации (${orgs.items.length}+ на странице)`);
	await page.screenshot({ path: '.shots/b-data/imports-step5.png' });

	await page.getByRole('button', { name: 'Откатить импорт' }).click();
	await page.getByRole('button', { name: 'Откатить', exact: true }).click();
	await page.waitForSelector('text=Импорт откачен', { timeout: 90000 });
	const rolled = (await api('GET', `/api/imports/${jobId}`)).json;
	check(rolled.status === 'rolled_back', 'откат выполнен: rolled_back');
	const left = (await api('GET', '/api/organizations?q=демо-импорт&limit=100')).json;
	check(left.items.length === 0, 'после отката организаций из файла в списке нет');

	console.log('csv: продукты (30 строк)');
	const csv = await run(page, CSV, 'Продукты');
	check(csv.job.total_rows === 30, 'в файле 30 строк данных');
	await page.getByRole('button', { name: /^Применить/ }).click();
	await page.waitForSelector('text=Импорт завершён', { timeout: 90000 });
	ok('csv применён');
	await page.getByRole('button', { name: 'Откатить импорт' }).click();
	await page.getByRole('button', { name: 'Откатить', exact: true }).click();
	await page.waitForSelector('text=Импорт откачен', { timeout: 90000 });
	ok('csv откачен');

	console.log('Журнал и карточка');
	await page.goto(`${BASE}/imports`);
	await page.waitForSelector('text=Откачен');
	check((await page.getByText('Откачен').count()) >= 2, 'журнал показывает откаченные задания');
	await page.goto(`${BASE}/imports/${jobId}`);
	await page.waitForSelector('text=Сопоставление колонок');
	ok('карточка задания: сопоставление колонок показано');
	await page.screenshot({ path: '.shots/b-data/imports-detail.png' });

	const p = page.__problems;
	console.log(p.pageerrors.length ? `  ✗ page errors: ${p.pageerrors.join(' | ')}` : '  ✓ нет исключений на странице');
	const real = p.console.filter((c) => !/status of (409|422)/.test(c));
	console.log(real.length ? `  ✗ console: ${real.join(' | ')}` : '  ✓ нет ошибок консоли');
	if (p.failed.length) console.log(`  · неудачные запросы: ${[...new Set(p.failed)].join(' | ')}`);
} finally {
	await browser.close();
}
