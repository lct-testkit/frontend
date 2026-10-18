// Интеграции (F5): сквозной сценарий на живом бэкенде. Нужен мок сайта (`GET /api/v1/leads`), доступный воркеру бэкенда:
//   MOCK_CMS_URL=http://host.docker.internal:4011 APP_URL=http://localhost:5274 node tools/scenarios/e-integrations.mjs
// Состояние источника «Сайт» до проверки запоминается и в конце возвращается.
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const MOCK = process.env.MOCK_CMS_URL;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

async function api(method, path, body) {
	const token = await accessToken('admin');
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}


const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) });
const fillIn = async (scope, label, text, nth = 0) => field(scope, label).nth(nth).locator('input, textarea').first().fill(text);
const pickIn = async (page, scope, label, text, nth = 0) => {
	await field(scope, label).nth(nth).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: text }).first().click();
	await page.waitForTimeout(150);
};

const before = (await api('GET', '/api/admin/integrations/sources')).json.find((s) => s.code === 'cms');
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const card = page.locator('article[aria-label="Сайт (Laravel CMS)"]');

	console.log('(a) выключенный источник: «Забрать сейчас» недоступна, причина в подсказке');
	await api('PATCH', '/api/admin/integrations/sources/cms', { is_active: false });
	await page.goto(`${BASE}/admin/integrations`);
	await card.waitFor();
	check(await card.getByRole('button', { name: 'Забрать сейчас' }).isDisabled(), 'кнопка недоступна у выключенного источника');

	console.log('(d) «Показать ещё» во «Входящих»: вторая страница по X-Next-Cursor (ответы подменены: 50 + 12 строк)');
	{
		const row = (i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, source_code: 'cms', external_id: `fake-${i}`, message_type: 'lead', channel: 'webhook', status: 'processed', signature_valid: true, error: null, resulting_entity_type: null, resulting_entity_id: null, processed_at: null, received_at: new Date(Date.now() - i * 60000).toISOString() });
		const seen = [];
		await page.route('**/api/admin/integrations/inbound-messages**', (route) => {
			const url = new URL(route.request().url());
			const cursor = url.searchParams.get('cursor');
			seen.push(cursor);
			const items = cursor ? Array.from({ length: 12 }, (_, i) => row(50 + i)) : Array.from({ length: 50 }, (_, i) => row(i));
			route.fulfill({ status: 200, contentType: 'application/json', headers: cursor ? {} : { 'X-Next-Cursor': 'page2', 'Access-Control-Expose-Headers': 'X-Next-Cursor' }, body: JSON.stringify(items) });
		});
		await page.goto(`${BASE}/admin/integrations?tab=inbound`);
		await page.getByText('fake-0', { exact: false }).first().waitFor();
		const more = page.getByRole('button', { name: /Показать ещё/ });
		check((await more.count()) === 1, 'при 50 строках и курсоре есть кнопка «Показать ещё»');
		await more.click();
		await page.getByText('fake-61', { exact: false }).first().waitFor();
		check(seen.includes('page2'), 'вторая страница запрошена с cursor из заголовка');
		check((await page.getByRole('button', { name: /Показать ещё/ }).count()) === 0, 'после последней страницы кнопки нет');
		await page.unroute('**/api/admin/integrations/inbound-messages**');
	}

	console.log('(e) «Поля заявки»: правила, предпросмотр сервера, сохранение, возврат встроенного');
	{
		await api('DELETE', '/api/admin/integrations/sources/cms/mapping');
		await page.goto(`${BASE}/admin/integrations`);
		await card.waitFor();
		await card.getByRole('button', { name: 'Изменить поля заявки' }).click();
		const dr = page.locator('.atmr-drawer');
		await dr.getByText('Поля заявки').first().waitFor();
		await dr.getByText('Вставьте пример запроса').waitFor({ timeout: 5000 });
		ok('пустой пример: «Вставьте пример запроса, чтобы увидеть результат»');
		await fillIn(dr, 'Тело запроса (JSON)', '{ "lead_id": ');
		check(await dr.getByText('Это не JSON').isVisible(), 'невалидный JSON: ошибка под полем');
		await dr.getByRole('button', { name: 'Вставить типовой' }).click();
		await dr.getByText('Как примет сервер').waitFor({ timeout: 8000 });
		check(await dr.getByText('Не использованы').count() === 0, 'без правил показывается результат встроенных названий');
		const rows = [
			['Email', 'email'],
			['Телефон', 'phone'],
			['Внешний id заявки', 'lead_id'],
			['Курс/продукт', 'product_interest']
		];
		for (let i = 0; i < rows.length; i++) {
			await dr.getByRole('button', { name: 'Добавить правило' }).click();
			const rule = dr.locator(`li[aria-label="Правило ${i + 1}"]`);
			await pickIn(page, rule, 'Поле CRM', rows[i][0]);
			await fillIn(rule, 'Ключ в запросе', rows[i][1]);
		}
		await dr.getByText('Как примет сервер').waitFor({ timeout: 8000 });
		await page.waitForTimeout(1200);
		const pv = await dr.locator('section, div').filter({ hasText: 'Что получится' }).last().innerText();
		check(/Внешний id заявки[\s\S]*lead-1001/.test(pv), 'предпросмотр: внешний id = lead-1001');
		check(/Не использованы: .*name/.test(pv), 'лишние ключи перечислены (name, source_campaign, submitted_at)');
		await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/mapping-desktop.png` : undefined });
		await dr.getByText('Что получится').scrollIntoViewIfNeeded();
		await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/mapping-preview-desktop.png` : undefined });
		await dr.getByRole('button', { name: 'Сохранить' }).click();
		await page.waitForSelector('text=Поля заявки сохранены');
		const saved = (await api('GET', '/api/admin/integrations/sources/cms/mapping')).json.mapping;
		check(saved && saved.rules.length === 4 && saved.version >= 1, `сохранено 4 правила, версия ${saved?.version}`);
		await card.getByRole('button', { name: 'Изменить поля заявки' }).click();
		await page.locator('li[aria-label="Правило 4"]').waitFor();
		ok('после повторного открытия правила на месте');
		await page.keyboard.press('Escape');
		await api('DELETE', '/api/admin/integrations/sources/cms/mapping');
	}

	console.log('(f) «Куда попадают заявки»: маршрут по умолчанию и правило, строка на карточке');
	{
		await api('DELETE', '/api/admin/integrations/sources/cms/routing');
		await page.goto(`${BASE}/admin/integrations`);
		await card.waitFor();
		await card.getByText('B2C, воронка по умолчанию').waitFor({ timeout: 8000 });
		ok('без настройки карточка: «B2C, воронка по умолчанию»');
		await card.getByRole('button', { name: 'Изменить маршрут заявок' }).click();
		const dr = page.locator('.atmr-drawer');
		await dr.getByText('По умолчанию').first().waitFor();
		await pickIn(page, dr, 'Тип сделки', 'B2B', 0);
		await pickIn(page, dr, 'Воронка', 'B2B: взаимодействие с вузом', 0);
		await page.waitForTimeout(800);
		await pickIn(page, dr, 'Статус новой заявки', 'Организация встречи', 0);
		await dr.getByRole('button', { name: 'Добавить правило' }).click();
		const rule = dr.locator('li[aria-label="Правило 1"]');
		await pickIn(page, rule, 'Поле заявки', 'Тип заявки');
		await fillIn(rule, 'Значение', 'university');
		await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/routing-desktop.png` : undefined });
		await dr.getByRole('button', { name: 'Сохранить' }).click();
		await page.waitForSelector('text=Маршрут заявок сохранён');
		const saved = (await api('GET', '/api/admin/integrations/sources/cms/routing')).json.routing;
		check(saved?.default?.deal_type === 'b2b' && saved.default.workflow_code === 'b2b_university_v2', `сохранён маршрут: ${JSON.stringify(saved?.default)}`);
		check(saved?.rules?.length === 1 && saved.rules[0].when.equals === 'university', 'сохранено правило lead_kind = university');
		await card.getByText('B2B, воронка «B2B: взаимодействие с вузом', { exact: false }).waitFor({ timeout: 8000 });
		ok(`карточка: ${(await card.getByText('B2B, воронка', { exact: false }).first().innerText()).trim()}`);
		await api('DELETE', '/api/admin/integrations/sources/cms/routing');
	}

	console.log('(g) настройка источника: имя переменной, метка времени, чужие ключи config не теряются');
	{
		await api('PATCH', '/api/admin/integrations/sources/cms', { config: { note_f5: 'keep' }, credentials_ref: 'CMS_WEBHOOK_SECRET' });
		await page.goto(`${BASE}/admin/integrations`);
		await card.waitFor();
		await card.getByRole('button', { name: 'Настроить источник' }).click();
		const dr = page.locator('.atmr-drawer');
		await dr.getByText('Подпись входящих запросов').waitFor();
		await fillIn(dr, 'Ссылка на секрет', '1ABC');
		await dr.getByRole('button', { name: 'Сохранить' }).click();
		await dr.getByText('латиница, цифры и «_»').waitFor({ timeout: 5000 });
		ok('«1ABC» в «Ссылке на секрет»: ошибка под полем, на сервер не ушло');
		await fillIn(dr, 'Ссылка на секрет', 'CMS_WEBHOOK_SECRET');
		await fillIn(dr, 'Секрет подписи (имя переменной)', 'CMS_SIGNING_SECRET');
		await dr.getByText('Требовать метку времени X-Timestamp').click();
		await dr.getByText('Как подключить').click();
		check((await dr.locator('pre').innerText()).includes('X-Timestamp: $TS') && (await dr.locator('pre').innerText()).includes('$CMS_SIGNING_SECRET'), 'пример в паспорте: с X-Timestamp и именем переменной из поля');
		await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/source-drawer-desktop.png` : undefined });
		await dr.getByRole('button', { name: 'Сохранить' }).click();
		await page.waitForSelector('text=Источник сохранён');
		const cfg = (await api('GET', '/api/admin/integrations/sources')).json.find((x) => x.code === 'cms').config;
		check(cfg.require_timestamp === true && cfg.signing_secret_ref === 'CMS_SIGNING_SECRET' && cfg.note_f5 === 'keep', `config сохранён: ${JSON.stringify(cfg)}`);
		await api('PATCH', '/api/admin/integrations/sources/cms', { config: before.config });
	}

	if (!MOCK) {
		console.log('  (нет MOCK_CMS_URL — забор не проверяем)');
	} else {
		console.log('(b) «Забрать сейчас»: индикатор, затем итог');
		await api('PATCH', '/api/admin/integrations/sources/cms', { base_url: MOCK, is_active: true });
		await page.goto(`${BASE}/admin/integrations`);
		await card.waitFor();
		const pull = card.getByRole('button', { name: 'Забрать сейчас' });
		check(await pull.isEnabled(), 'у включённого источника кнопка доступна');
		await pull.click();
		await card.getByRole('button', { name: /Забираем|Запускаем/ }).waitFor({ timeout: 5000 });
		ok('кнопка показывает «Забираем…» и недоступна');
		await card.locator('section[aria-label="Последний забор"] >> text=Идёт').waitFor({ timeout: 5000 });
		ok('в блоке «Последний забор» чип «Идёт»');
		await card.locator('section[aria-label="Последний забор"] >> text=/Успешно|Частично|Ошибка/').waitFor({ timeout: 130_000 });
		const block = await card.locator('section[aria-label="Последний забор"]').innerText();
		check(/получено: \d+/.test(block), `итог с числами: ${block.replace(/\s+/g, ' ')}`);
		check((await card.locator('dd', { hasText: /\d{4}-|T\d\d:/ }).count()) >= 1, 'строка «Курсор» заполнена');
		await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/pulled.png` : undefined });

		console.log('(c) повторный запуск при очереди: кнопка недоступна, а не 409');
		await card.getByRole('button', { name: 'Забрать сейчас' }).click();
		await card.getByRole('button', { name: /Забираем|Запускаем/ }).waitFor({ timeout: 5000 });
		const again = await api('POST', '/api/admin/integrations/sources/cms/pull', {});
		check(again.status === 409, `второй запрос в очередь — 409 (${again.status})`);
		await card.getByRole('button', { name: 'Забрать сейчас' }).waitFor({ timeout: 130_000 });
		ok('после завершения кнопка снова доступна');
	}
} finally {
	await api('PATCH', '/api/admin/integrations/sources/cms', { base_url: before.base_url, is_active: before.is_active, pull_enabled: before.pull_enabled });
	await browser.close();
}
