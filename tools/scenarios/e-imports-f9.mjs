// Импорт, хвосты F2-8/F2-9 (F9): шаблон xlsx/xls с сервера, параметры чтения (строка заголовка, заполнение сверху), сводка проверки, фильтр строк по замечанию,
// итог применения, отчёт, откат; типы «Направления» и «Ответственные» только для администратора.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-imports-f9.mjs      (SHOTS_DIR=… — снять кадры шагов)
// Создаёт вуз «E2E F9 Вуз импорта», лицензии «E2E F9 …» (откатываются в конце) и вендора/ПО «E2E F9 …».
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';
import { apiAs } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const FIXTURE = fileURLToPath(new URL('../fixtures/import-license-f9.xlsx', import.meta.url));
const SHOTS = process.env.SHOTS_DIR;
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const shot = async (page, name) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));

const admin = await apiAs('admin');
const orgName = 'E2E F9 Вуз импорта';
const found = (await admin(`/api/organizations?q=${encodeURIComponent(orgName)}&limit=20`)).body.items?.find((o) => o.name === orgName);
if (!found) {
	const created = await admin('/api/organizations', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ name: orgName, org_type: 'university', source: 'e2e' }) });
	check(created.status === 201, `вуз «${orgName}» заведён (${created.status})`);
}

const browser = await newBrowser();
try {
	console.log('(a) шаблоны с сервера');
	const page = await newPage(browser, { who: 'admin', width: W, height: H, theme: process.env.THEME ?? 'rtk_default_light' });
	await page.goto(`${BASE}/imports/new?entity=license`);
	await page.getByText('Какие колонки ждёт файл').click();
	for (const format of ['xlsx', 'xls']) {
		const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.getByTestId(`import-template-${format}`).click()]);
		const path = await download.path();
		const { size } = await import('node:fs').then((fs) => fs.statSync(path));
		check(download.suggestedFilename() === `license-template.${format}` && size > 1000, `«Скачать шаблон .${format}»: ${download.suggestedFilename()}, ${size} байт`);
	}
	await shot(page, 'step1-template');

	console.log('(b) загрузка, параметры чтения');
	await page.locator('input[type=file]').setInputFiles(FIXTURE);
	await page.getByRole('button', { name: 'Загрузить и продолжить' }).click();
	await page.getByText('Параметры чтения файла').waitFor({ timeout: 30000 });
	await page.getByText('находятся в строке 3').waitFor({ timeout: 8000 });
	ok('на шаге сопоставления: «названия колонок находятся в строке 3»');
	await shot(page, 'step2-before');
	await page.getByRole('button', { name: 'Взять строку 3' }).click();
	await page.getByText('Название ВУЗа').first().waitFor({ timeout: 10000 });
	await page.waitForFunction(() => !document.body.innerText.includes('Взять строку 3'), null, { timeout: 8000 });
	ok('после «Взять строку 3» колонки файла прочитаны, подсказка ушла');
	await shot(page, 'step2-header-row');

	// встроенный пресет сервера (без id) предлагается рядом с сохранёнными и применяется
	await page.getByPlaceholder('Применить пресет').first().click();
	const builtin = page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: 'встроенный' });
	check((await builtin.count()) > 0, 'в списке пресетов есть «(встроенный)» пресет сервера');
	await builtin.first().click();
	await page.waitForTimeout(500);
	await shot(page, 'step2-preset');

	// заполнение пустых ячеек сверху: вуз и вендор указаны один раз на несколько строк
	const fill = page.locator('.atmr-input', { has: page.locator('.atmr-input__label :text-is("Заполнять пустые ячейки значением сверху")') }).last();
	for (const header of ['Название ВУЗа', 'Вендор']) {
		await fill.click();
		await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: header }).first().click();
	}
	await page.keyboard.press('Escape');
	await shot(page, 'step2-filldown');

	console.log('(c) проверка: сводка и фильтр по замечанию');
	await page.getByRole('button', { name: 'Далее', exact: true }).click();
	await page.getByTestId('check-summary').waitFor({ timeout: 60000 });
	const summaryText = await page.getByTestId('check-summary').innerText();
	check(/Будет создано:\s*2\s*лицензии/.test(summaryText), 'сводка: «Будет создано: 2 лицензии»');
	check(/Несуществующий вуз E2E F9.*не найдено/s.test(summaryText), 'сводка называет проблему «вуз не найден» с названием');
	await shot(page, 'step3-summary');
	await page.getByTestId('check-issue-org_not_found').click();
	await page.getByText('Только строки с замечанием').waitFor({ timeout: 8000 });
	// шапка + одна строка (на телефоне таблицы нет — карточки)
	if (W >= 768) await page.waitForFunction(() => document.querySelectorAll('[data-table-row="true"]').length === 2, null, { timeout: 8000 });
	ok('«Показать»: в списке одна строка с этим замечанием');
	await shot(page, 'step3-filter');
	await page.getByRole('button', { name: 'Показать все' }).click();

	console.log('(d) применение, итог, отчёт, откат');
	await page.getByRole('button', { name: /^Применить/ }).click();
	await page.getByText('Импорт завершён').first().waitFor({ timeout: 60000 });
	await page.getByText('Создано:').first().waitFor({ timeout: 10000 });
	check(/Создано:\s*2\s*лицензии/.test(await page.getByTestId('check-summary').innerText()), 'итог: «Создано: 2 лицензии»');
	await shot(page, 'step5-done');
	// «Отчёт .xlsx»: ссылка на файл от сервера, по ней лежит настоящая книга (zip: «PK»)
	const [link] = await Promise.all([page.waitForResponse((r) => /\/download-url/.test(r.url()), { timeout: 15000 }), page.getByTestId('import-report').click()]);
	const { download_url: reportUrl } = await link.json();
	const bytes = Buffer.from(await (await fetch(reportUrl)).arrayBuffer());
	check(link.status() === 200 && bytes.subarray(0, 2).toString() === 'PK', `«Отчёт .xlsx»: ссылка выдана, файл — книга xlsx (${bytes.length} байт)`);
	await page.getByRole('button', { name: 'Откатить импорт' }).click();
	await page.getByRole('button', { name: 'Откатить', exact: true }).click();
	await page.getByText('Импорт откачен').waitFor({ timeout: 60000 });
	ok('откат: «Импорт откачен»');
	await page.close();

	console.log('(e) типы только для администратора');
	const head = await newPage(browser, { who: 'head', width: 1440, height: 900 });
	await head.goto(`${BASE}/imports/new?entity=direction`);
	await head.getByText('Что загружаем').waitFor({ timeout: 10000 });
	const disabled = async (label) => head.locator('label.atmr-radiobutton', { hasText: label }).locator('input').isDisabled();
	check((await disabled('Направления')) && (await disabled('Ответственные за вуз')), 'руководителю «Направления» и «Ответственные за вуз» недоступны');
	check(!(await disabled('Лицензии')), '«Лицензии» руководителю доступны');
	await shot(head, 'step1-head');
	await head.close();
	const adm = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await adm.goto(`${BASE}/imports/new?entity=direction`);
	await adm.getByText('Что загружаем').waitFor({ timeout: 10000 });
	check(await adm.locator('label.atmr-radiobutton', { hasText: 'Направления' }).locator('input').isChecked(), 'администратору ?entity=direction открывает «Направления»');

	console.log('(f) «Направления» и «Ответственные за вуз» — файл из шаблона сервера, только проверка');
	const dir = mkdtempSync(join(tmpdir(), 'f9-import-'));
	const token = await accessToken('admin');
	for (const [code, label, expect] of [
		['direction', 'Направления', /Будет создано:\s*2\s*направления/],
		['responsible', 'Ответственные за вуз', /Вуз не найден/]
	]) {
		const res = await fetch(`${BASE}/api/imports/templates/${code}?format=xlsx`, { headers: { Authorization: `Bearer ${token}` } });
		const file = join(dir, `${code}.xlsx`);
		writeFileSync(file, Buffer.from(await res.arrayBuffer()));
		await adm.goto(`${BASE}/imports/new`);
		await adm.getByText('Что загружаем').waitFor({ timeout: 10000 });
		await adm.locator('label.atmr-radiobutton', { hasText: label }).click();
		await adm.locator('input[type=file]').setInputFiles(file);
		await adm.getByRole('button', { name: 'Загрузить и продолжить' }).click();
		await adm.getByText('Параметры чтения файла').waitFor({ timeout: 30000 });
		await adm.getByRole('button', { name: 'Далее', exact: true }).click();
		await adm.getByTestId('check-summary').waitFor({ timeout: 60000 });
		check(expect.test(await adm.getByTestId('check-summary').innerText()), `${label}: сводка проверки показана (${code})`);
		await shot(adm, `step3-${code}`);
	}
	await adm.close();
} finally {
	await browser.close();
}
