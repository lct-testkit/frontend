// «Скачать JSON» у отчёта (F1-11): панель после запуска, «Мои отчёты» (в том числе строка без файла и отчёт «только файлом»), ошибка 403.
//   APP_URL=http://localhost:5274 node tools/scenarios/b-reports-json.mjs [--out каталог со снимками]
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';
import { readXlsxRows } from './xlsx-lite.mjs';

const i = process.argv.indexOf('--out');
const out = i > 0 ? process.argv[i + 1] : '.shots/json';
mkdirSync(out, { recursive: true });
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const token = await accessToken('admin');
const api = async (path) => (await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })).json();

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const drawer = page.locator('.atmr-drawer');

	console.log('Панель после запуска');
	await page.goto(`${BASE}/reports`);
	await page.getByRole('button', { name: /Сделки по вузам и направлениям/ }).click();
	await drawer.getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 90000 });
	const job = (await api('/api/reports?limit=1')).items[0];
	const link = (await api(`/api/reports/${job.id}/download`)).url;
	const xlsx = readXlsxRows(Buffer.from(await (await fetch(link)).arrayBuffer()));
	const [file] = await Promise.all([page.waitForEvent('download'), drawer.getByRole('button', { name: 'Скачать JSON' }).click()]);
	const path = join(out, 'panel.json');
	await file.saveAs(path);
	const json = JSON.parse(readFileSync(path, 'utf8'));
	check(/^Сделки_по_вузам_и_направлениям_\d{4}-\d{2}-\d{2}\.json$/.test(file.suggestedFilename()), `имя файла: ${file.suggestedFilename()}`);
	check(JSON.stringify(json.columns) === JSON.stringify(xlsx[0]), `columns JSON совпадают с первой строкой xlsx: ${json.columns.join(', ')}`);
	check(json.row_count === xlsx.length - 1 && json.rows.length === json.row_count, `row_count ${json.row_count} = строк в xlsx ${xlsx.length - 1}`);
	check(readFileSync(path, 'utf8').startsWith('{\n  "'), 'отступ 2 пробела');
	await page.screenshot({ path: join(out, 'panel-1440.png') });
	await drawer.getByRole('button', { name: 'Закрыть', exact: true }).last().click();

	console.log('Мои отчёты');
	const dataCalls = [];
	page.on('request', (r) => /\/api\/reports\/[^/]+\/data/.test(r.url()) && dataCalls.push(r.url()));
	await page.route(/\/api\/reports\?/, async (route) => {
		const res = await route.fetch();
		const body = await res.json();
		// 0 — обычная строка, 1 — без файла, 2 — «только файлом» (LMS)
		if (body.items[1]) body.items[1] = { ...body.items[1], file_id: null };
		if (body.items[2]) body.items[2] = { ...body.items[2], template_code: 'lms_users_upload' };
		await route.fulfill({ response: res, json: body });
	});
	await page.goto(`${BASE}/reports/history`);
	await page.waitForSelector('text=Готов');
	const rows = page.locator('[data-table-row]');
	await rows.first().waitFor();
	const dataRow = (n) => rows.nth(n + 1); // нулевая «строка» — заголовок таблицы DS
	const jsonBtn = (n) => dataRow(n).getByRole('button', { name: 'Скачать JSON' });
	check((await jsonBtn(0).count()) === 1, 'у обычной строки есть «Скачать JSON»');
	check((await jsonBtn(1).count()) === 1 && (await dataRow(1).getByRole('button', { name: 'Скачать', exact: true }).count()) === 0, 'у строки без файла JSON есть, «Скачать» файл нет');
	check((await jsonBtn(2).count()) === 0, 'у отчёта «Загрузка пользователей в LMS» кнопки JSON нет');
	await page.screenshot({ path: join(out, 'history-1440.png') });
	const before = dataCalls.length;
	const [f2] = await Promise.all([page.waitForEvent('download'), jsonBtn(1).click()]);
	await f2.saveAs(join(out, 'no-file.json'));
	check(dataCalls.length === before + 1 && JSON.parse(readFileSync(join(out, 'no-file.json'), 'utf8')).columns.length > 0, 'строка без файла: один запрос /data, файл с данными');

	console.log('403');
	await page.route(/\/api\/reports\/[^/]+\/data/, (route) => route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'CRM-1102', detail: 'Только файлом' }) }));
	await jsonBtn(0).click();
	await page.waitForSelector('text=Этот отчёт содержит персональные данные и доступен только файлом', { timeout: 5000 }).then(() => ok('403: тост про персональные данные'), () => fail('403: нет тоста'));
	await page.screenshot({ path: join(out, 'toast-403-1440.png') });
	if (page.__problems.pageerrors.length) fail(`ошибки страницы: ${page.__problems.pageerrors.join('; ')}`);
} finally {
	await browser.close();
}
