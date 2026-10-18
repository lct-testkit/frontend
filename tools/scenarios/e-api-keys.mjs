// API-ключи для внешних систем (F5-10): выпуск в интерфейсе (ключ виден один раз), вызов API по X-API-Key, отзыв — после него тот же вызов даёт 401.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-api-keys.mjs
import { BASE, newBrowser, newPage } from '../lib.mjs';
import { apiAs } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const field = (page, label) => page.locator('.atmr-input', { has: page.locator(`.atmr-input__label :text-is("${label}")`) }).last();

const NAME = `E2E F9 ключ ${Date.now().toString(36)}`;
const admin = await apiAs('admin');
const callWith = async (key) => (await fetch(`${BASE}/api/deals?limit=1`, { headers: { 'X-API-Key': key } })).status;

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(`${BASE}/admin/integrations?tab=keys`);
	await page.getByTestId('key-create').waitFor({ timeout: 10000 });

	console.log('(a) выпуск, ключ один раз');
	await page.getByTestId('key-create').click();
	await field(page, 'Название').locator('input').fill(NAME);
	await page.getByRole('button', { name: 'Создать ключ' }).click();
	await page.getByText('Сохраните сейчас, потом он будет недоступен').waitFor({ timeout: 8000 });
	const key = await page.locator('input[readonly]').last().inputValue();
	check(key.length >= 20, 'ключ показан в окне после выпуска');
	check((await page.getByText('X-API-Key: $CRM_API_KEY').count()) > 0 && !(await page.locator('pre').first().innerText()).includes(key), 'пример вызова есть, значения ключа в нём нет');
	await page.getByTestId('secret-done').click();
	await page.getByText(NAME).first().waitFor();
	const list = (await admin('/api/admin/integrations/api-keys')).body;
	const row = list.find((k) => k.name === NAME);
	check(!!row && !('key' in row) && key.startsWith(row.key_prefix), 'в списке только начало ключа, самого ключа в ответах API нет');

	console.log('(b) вызов по X-API-Key');
	check((await callWith(key)) === 200, 'GET /api/deals с ключом отвечает 200');
	check((await callWith(key + 'x')) === 401, 'с чужим ключом — 401');

	console.log('(c) отзыв');
	await page.reload();
	await page.getByText(NAME).first().waitFor();
	await page.getByRole('button', { name: 'Отозвать ключ' }).first().click();
	await page.getByRole('button', { name: 'Отозвать', exact: true }).click();
	await page.getByRole('heading', { name: 'Ключ отозван' }).waitFor({ timeout: 8000 });
	check((await page.getByText('Отозван', { exact: true }).count()) > 0, 'в списке состояние «Отозван»');
	check((await callWith(key)) === 401, 'после отзыва тот же вызов — 401');
	await page.close();
} finally {
	await browser.close();
}
