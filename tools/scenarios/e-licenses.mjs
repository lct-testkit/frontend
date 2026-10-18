// Лицензии вуз–вендор–ПО (F2): сквозной сценарий на живом бэкенде. Свои записи — с номерами договоров `E2E-…`, в конце все удаляются.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-licenses.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

async function api(who, method, path, body, headers = {}) {
	const token = await accessToken(who);
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}
const mine = async () => (await api('head', 'GET', '/api/organization-licenses?q=E2E-&limit=100')).json.items.filter((l) => (l.contract_number ?? '').startsWith('E2E-'));
async function cleanup() {
	for (const l of await mine()) await api('head', 'DELETE', `/api/organization-licenses/${l.id}`);
}

const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) }).last();
const fill = async (scope, label, text) => field(scope, label).locator('input, textarea').first().fill(text);
const pick = async (page, scope, label, text) => {
	await field(scope, label).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: text }).first().click();
	await page.waitForTimeout(150);
};

const browser = await newBrowser();
try {
	await cleanup();
	const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });

	console.log('(a) таблица');
	await page.goto(`${BASE}/licenses`);
	await page.waitForSelector('text=Найдено:');
	const heads = await page.locator('.atmr-tablegrid__cell--header').allInnerTexts();
	check(heads.length >= 6, `заголовки таблицы (${heads.length}): ${heads.map((h) => h.trim()).join(' | ')}`);

	console.log('(c) создание');
	await page.goto(`${BASE}/licenses?new=1`);
	const drawer = page.locator('.atmr-drawer');
	await drawer.getByText('Новая лицензия').waitFor();
	await drawer.getByRole('button', { name: 'Сохранить' }).click();
	check(await page.getByText('Выберите вуз').isVisible(), 'пустая форма: «Выберите вуз»');
	check(await page.getByText('Укажите вендора').isVisible(), 'пустая форма: «Укажите вендора»');
	await pick(page, drawer, 'Вуз', 'КГТУ');
	await fill(drawer, 'Вендор', 'E2E Вендор');
	await fill(drawer, 'ПО', 'E2E Программа');
	await fill(drawer, 'Номер договора', 'E2E-001');
	await pick(page, drawer, 'Статус по передаче', 'В процессе');
	const save = drawer.getByRole('button', { name: 'Сохранить' });
	await save.dblclick();
	await page.waitForSelector('text=Лицензия создана');
	await page.waitForTimeout(500);
	const created = await mine();
	check(created.length === 1, `двойной щелчок «Сохранить» создал одну запись (${created.length})`);
	check(await page.locator('text=E2E-001').first().isVisible(), 'строка появилась в списке без перезагрузки');

	await page.goto(`${BASE}/licenses?new=1`);
	await pick(page, drawer, 'Вуз', 'КГТУ');
	await fill(drawer, 'Вендор', 'E2E Вендор');
	await fill(drawer, 'ПО', 'E2E Программа');
	await fill(drawer, 'Номер договора', 'E2E-001');
	await drawer.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(800);
	check(await drawer.getByText(/уже существует/).isVisible(), 'дубль ключа: ошибка в форме');
	await drawer.getByRole('button', { name: 'Отмена' }).click();

	console.log('(d) правка и конфликт версий');
	await page.goto(`${BASE}/licenses?edit=${created[0].id}`);
	await drawer.getByText('E2E Вендор').first().waitFor();
	await pick(page, drawer, 'Статус по передаче', 'Передана');
	// другой пользователь правит ту же запись
	const other = await api('head', 'PATCH', `/api/organization-licenses/${created[0].id}`, { comment: 'правка в другой вкладке' }, { 'If-Match': `"${created[0].version}"` });
	check(other.status === 200, 'вторая сторона изменила запись');
	await drawer.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForSelector('text=Загрузить актуальные');
	ok('плашка конфликта версий');
	await page.getByRole('button', { name: 'Загрузить актуальные' }).click();
	await page.waitForTimeout(500);
	await drawer.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForSelector('text=Лицензия сохранена');
	const after = (await api('head', 'GET', `/api/organization-licenses/${created[0].id}`)).json;
	check(after.transfer_status === 'transferred', 'после загрузки актуальной версии правка сохранилась');
	check(after.comment === 'правка в другой вкладке', 'чужая правка комментария не затёрта');

	console.log('(e) удаление');
	await page.goto(`${BASE}/licenses?edit=${created[0].id}`);
	await drawer.getByText('E2E Вендор').first().waitFor();
	check((await drawer.getByRole('button', { name: 'Удалить' }).count()) === 0, 'КАМ: кнопки «Удалить» нет (нет права license:delete)');
	const headPage = await newPage(browser, { who: 'head', width: 1440, height: 900 });
	await headPage.goto(`${BASE}/licenses?q=E2E-001`);
	await headPage.waitForSelector('text=Найдено: 1');
	await headPage.getByText('E2E-001').first().click();
	const hd = headPage.locator('.atmr-drawer');
	await hd.getByRole('button', { name: 'Удалить' }).click();
	await headPage.locator('button.atmr-button--secondary', { hasText: 'Отмена' }).click();
	check((await mine()).length === 1, 'отказ в подтверждении ничего не удаляет');
	await hd.getByRole('button', { name: 'Удалить' }).click();
	await headPage.locator('button.atmr-button--primary, button.atmr-button--danger', { hasText: 'Удалить' }).last().click();
	await headPage.waitForSelector('text=Лицензия удалена');
	await headPage.waitForSelector('text=Ничего не найдено');
	check((await mine()).length === 0, 'после удаления записи нет ни в списке, ни в базе');
	const twin = (await api('head', 'POST', '/api/organization-licenses', { organization_id: created[0].organization_id, vendor: 'E2E Вендор', product_name: 'E2E Программа 2', contract_number: 'E2E-002' }, { 'Idempotency-Key': crypto.randomUUID() })).json;
	await headPage.goto(`${BASE}/licenses?q=E2E-002`);
	await headPage.getByText('E2E-002').first().click();
	await api('head', 'DELETE', `/api/organization-licenses/${twin.id}`);
	await hd.getByRole('button', { name: 'Удалить' }).click();
	await headPage.locator('button.atmr-button--primary, button.atmr-button--danger', { hasText: 'Удалить' }).last().click();
	await headPage.waitForSelector('text=Лицензия уже удалена');
	ok('повторное удаление: «Лицензия уже удалена», без ошибки');
	console.log('(f) лицензия по ссылке');
	const any = (await api('kam', 'GET', '/api/organization-licenses?limit=1')).json.items[0];
	await page.goto(`${BASE}/licenses/${any.id}`);
	await drawer.getByText(any.product_name).first().waitFor();
	check(page.url().includes(`/licenses?edit=${any.id}`), '/licenses/<id> перенаправляет на /licenses?edit=<id> и открывает панель');
	await page.goto(`${BASE}/licenses/00000000-0000-7000-8000-000000000000`);
	await page.waitForSelector('text=Лицензия не найдена или недоступна');
	check(!page.url().includes('edit='), 'чужой/несуществующий id: тост, адрес очищен, панели нет');
} finally {
	await cleanup();
	await browser.close();
	ok('записи E2E-* удалены');
}
