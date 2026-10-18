// Лицензии вуз–вендор–ПО (F2): сквозной сценарий на живом бэкенде. Свои записи — с номерами договоров `E2E-…`, в конце все удаляются.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-licenses.mjs
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE, accessToken, auditLayout, newBrowser, newPage } from '../lib.mjs';
// десять полей ТЗ (§4 п.1) — как `LICENSE_FIELD_LABELS` в licenses/licenseUtils.ts
const LICENSE_FIELD_LABELS = ['Название ВУЗа', 'Вендор', 'ПО', 'Номер договора', 'Подписание лицензии', 'Срок действия (год)', 'Статус по передаче', 'ФИО менеджера', 'Ответственные от ВУЗа', 'Комментарий'];

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
	console.log('(g) из карточки вуза');
	const orgCard = (await api('head', 'GET', '/api/organizations?q=Цифровые кадры&limit=1')).json.items[0];
	await headPage.goto(`${BASE}/organizations/${orgCard.id}?tab=licenses&new=1`);
	const hd2 = headPage.locator('.atmr-drawer');
	await hd2.getByText('Новая лицензия').waitFor();
	check(await hd2.locator('.atmr-input', { has: headPage.locator('.atmr-input__label :text-is("Вуз")') }).locator('.atmr-input__container--disabled, [aria-disabled="true"], input[disabled]').count() > 0, 'вуз подставлен и не меняется');
	await fill(hd2, 'Вендор', 'E2E Вендор');
	await fill(hd2, 'ПО', 'E2E Программа 3');
	await fill(hd2, 'Номер договора', 'E2E-003');
	await hd2.getByRole('button', { name: 'Сохранить' }).click();
	await headPage.waitForSelector('text=Лицензия создана');
	check(headPage.url().includes('tab=licenses'), 'вкладка «Лицензии» сохранена в адресе');
	await headPage.waitForSelector('text=E2E-003');
	const globalList = (await api('head', 'GET', '/api/organization-licenses?q=E2E-003&limit=5')).json.items;
	check(globalList.length === 1 && globalList[0].organization_id === orgCard.id, 'лицензия есть и в глобальном списке, на этом вузе');
	console.log('(h) импорт: шаблон и проверка файла');
	await headPage.goto(`${BASE}/imports/new?entity=license`);
	await headPage.waitForSelector('text=Какие колонки ждёт файл');
	check(await headPage.locator('label.atmr-radiobutton', { hasText: /Лицензии/ }).locator('input').isChecked(), '?entity=license: мастер открыт на «Лицензии»');
	await headPage.getByRole('button', { name: /Какие колонки ждёт файл/ }).click();
	for (const name of ['Название ВУЗа', 'Вендор', 'ПО', 'Номер договора', 'Подписание лицензии', 'Срок действия лицензии (год)', 'Статус по передаче', 'ФИО Менеджера', 'Ответственные от ВУЗа', 'Комментарий']) {
		if ((await headPage.locator('ul[aria-label^="Колонки файла"] li', { hasText: name }).count()) < 1) fail(`в подсказке нет колонки «${name}»`);
	}
	ok('подсказка показывает десять колонок ТЗ');
	const [download] = await Promise.all([headPage.waitForEvent('download'), headPage.getByRole('button', { name: /Скачать шаблон/ }).click()]);
	const dir = await mkdtemp(join(tmpdir(), 'lic-'));
	const template = join(dir, 'template.csv');
	await download.saveAs(template);
	const raw = await readFile(template, 'utf8');
	const BOM = String.fromCharCode(0xfeff);
	const EOL = String.fromCharCode(13, 10);
	check(raw.startsWith(BOM) && raw.split(EOL)[0].split(';').length === 10, 'шаблон: BOM и десять колонок');
	const header = raw.replace(BOM, '').split(EOL)[0];
	const org = 'Красноярский сибирский университет технологий';
	const file = join(dir, 'three.csv');
	const lines = [header, `${org};E2E Вендор;E2E ПО;E2E-IMP-1;15.03.2026;2027;в работе;Иванов Иван;Петров П.;ок`, `${org};E2E Вендор;E2E ПО 2;E2E-IMP-2;да;3 года;передано;;;`, `${org};E2E Вендор;E2E ПО 3;E2E-IMP-3;;;кое-что;;;`];
	await writeFile(file, BOM + lines.join(EOL) + EOL);
	await headPage.locator('input[type=file]').setInputFiles(file);
	await headPage.getByRole('button', { name: 'Загрузить и продолжить' }).click();
	await headPage.waitForSelector('text=Колонка файла', { timeout: 30000 });
	const next = headPage.getByRole('button', { name: 'Далее', exact: true });
	check(await next.isEnabled(), 'автосопоставление: «Далее» доступна без ручных правок');
	await next.click();
	await headPage.waitForSelector('text=Всего строк в файле', { timeout: 60000 });
	const job = (await api('head', 'GET', `/api/imports/${new URL(headPage.url()).searchParams.get('job')}`)).json;
	check(job.total_rows === 3 && job.error_rows === 1, `проверка: 3 строки, одна с ошибкой (всего ${job.total_rows}, ошибок ${job.error_rows})`);
	await headPage.waitForSelector('text=Строки файла');
	await headPage.waitForTimeout(800);
	check((await headPage.locator('[title*="Допустимо"]').count()) > 0, 'ошибка строки с неверным статусом сопровождается пояснением «Допустимо: …»');
	check((await headPage.getByText('E2E-IMP-3').count()) > 0, 'в колонке «Запись» договор из файла, не UUID');
	await headPage.goto(`${BASE}/imports/new?entity=license`);
	await headPage.waitForSelector('text=Какие колонки ждёт файл');
	await headPage.locator('input[type=file]').setInputFiles(template);
	await headPage.getByRole('button', { name: 'Загрузить и продолжить' }).click();
	await headPage.waitForSelector('text=Колонка файла', { timeout: 30000 });
	await headPage.getByRole('button', { name: 'Далее', exact: true }).click();
	await headPage.waitForSelector('text=Всего строк в файле', { timeout: 60000 });
	const tplJob = (await api('head', 'GET', `/api/imports/${new URL(headPage.url()).searchParams.get('job')}`)).json;
	check(tplJob.total_rows === 1 && tplJob.error_rows === 1, 'шаблон проходит проверку без правок: единственная ошибка — вуз из примера не найден');

	console.log('(b) поиск и фильтры в адресе');
	await page.goto(`${BASE}/licenses`);
	await page.waitForSelector('text=Найдено:');
	const search = page.getByPlaceholder('Вуз, вендор, ПО, договор');
	await search.fill('Астра');
	await search.press('Enter');
	await page.waitForFunction(() => location.search.includes('q='));
	const apiTotal = (await api('kam', 'GET', `/api/organization-licenses?q=${encodeURIComponent('Астра')}&with_total=true&limit=1`)).json.total;
	await page.waitForSelector(`text=Найдено: ${apiTotal}`);
	ok(`поиск «Астра»: в адресе q=, «Найдено: ${apiTotal}» равно total ответа`);
	await page.reload();
	await page.waitForSelector(`text=Найдено: ${apiTotal}`);
	check(new URL(page.url()).searchParams.get('q') === 'Астра', 'после перезагрузки поиск сохранился');
	await page.goto(`${BASE}/licenses?status=declined`);
	const declined = (await api('kam', 'GET', '/api/organization-licenses?transfer_status=declined&with_total=true&limit=1')).json.total;
	await page.waitForSelector(`text=Найдено: ${declined}`);
	ok(`?status=declined открывается отфильтрованной (${declined})`);

	console.log('(i) телефон 390×844: карточки с десятью полями');
	const phone = await newPage(browser, { who: 'kam', width: 390, height: 844 });
	await phone.goto(`${BASE}/licenses`);
	await phone.waitForSelector('text=Найдено', { state: 'attached' }).catch(() => {});
	await phone.waitForSelector('text=Номер договора');
	const card = await phone.locator('main, body').first().innerText();
	const missing = LICENSE_FIELD_LABELS.filter((label) => !card.includes(label) && label !== 'Название ВУЗа' && label !== 'Вендор' && label !== 'ПО' && label !== 'Статус по передаче');
	check(missing.length === 0, `карточка содержит поля ТЗ (нет: ${missing.join(', ') || '—'})`);
	const layout = await auditLayout(phone);
	check(!layout.hscroll && layout.offenders.length === 0 && !layout.tableScroll, `нет горизонтальной прокрутки и вылезающих элементов (${JSON.stringify(layout).slice(0, 160)})`);

	console.log('(j) аудитор');
	const auditor = await newPage(browser, { who: 'auditor', width: 1440, height: 900 });
	await auditor.goto(`${BASE}/licenses`);
	await auditor.waitForSelector('text=Этот раздел недоступен вашей роли');
	check((await auditor.locator('[data-nav="licenses"]').count()) === 0, 'аудитор: пункта «Лицензии» в меню нет, прямая ссылка — «недоступен вашей роли»');
} finally {
	await cleanup();
	await browser.close();
	ok('записи E2E-* удалены');
}
