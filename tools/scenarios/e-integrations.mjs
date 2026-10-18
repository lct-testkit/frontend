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
