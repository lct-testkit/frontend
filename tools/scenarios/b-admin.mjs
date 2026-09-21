// Реестр ЕГРЮЛ, интеграции, шаблоны уведомлений (агент B): сквозной сценарий под ADMIN на живом бэкенде + проверка прав.
//   node tools/scenarios/b-admin.mjs
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
const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) }).last();
const pick = async (page, scope, label, text) => {
	await field(scope, label).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: text }).first().click();
	await page.waitForTimeout(150);
};

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await api('admin', 'GET', '/api/me');

	console.log('Интеграции');
	await page.goto(`${BASE}/admin/integrations`);
	await page.waitForSelector('text=Сайт (CMS)');
	check((await page.getByText('Все системы работают').count()) > 0, 'плашка состояния: «Все системы работают»');
	check((await page.locator('article').count()) === 3, 'три источника: cms, lms, bitrix24');
	const before = (await api('admin', 'GET', '/api/admin/integrations/sources')).json.find((s) => s.code === 'cms');
	// правка base_url + некорректный JSON
	await page.locator('article', { hasText: 'Сайт (CMS)' }).getByLabel('Настроить источник').click();
	const drawer = page.locator('.atmr-drawer');
	await field(drawer, 'Адрес (base URL)').locator('input').fill('https://cms.example.test/api');
	await drawer.locator('textarea').first().fill('{ не json');
	await drawer.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(400);
	check((await drawer.getByText('Некорректный JSON').count()) > 0, 'ошибка JSON показана под полем');
	await drawer.locator('textarea').first().fill('{"timeout": 10}');
	check((await drawer.getByText('Как подключить').count()) > 0, 'паспорт интеграции показан');
	check((await drawer.locator('pre').innerText()).includes('X-Signature'), 'curl-пример содержит заголовок подписи');
	await drawer.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1000);
	const after = (await api('admin', 'GET', '/api/admin/integrations/sources')).json.find((s) => s.code === 'cms');
	check(after.base_url === 'https://cms.example.test/api' && after.config.timeout === 10, 'настройки источника сохранены');
	// переключатель с подтверждением: временно включаем источник, выключение в интерфейсе должно спросить
	await api('admin', 'PATCH', '/api/admin/integrations/sources/cms', { is_active: true });
	await page.reload();
	await page.waitForSelector('article');
	await page.locator('article', { hasText: 'Сайт (CMS)' }).locator('label.atmr-switch').click();
	await page.waitForTimeout(500);
	check((await page.getByText('Отключить «Сайт (CMS)»?').count()) > 0, 'выключение включённого источника просит подтверждение');
	await page.getByRole('button', { name: 'Отмена' }).click();
	await page.waitForTimeout(400);
	check((await api('admin', 'GET', '/api/admin/integrations/sources')).json.find((s) => s.code === 'cms').is_active === true, 'отмена подтверждения не выключила источник');
	// возвращаем как было
	await api('admin', 'PATCH', '/api/admin/integrations/sources/cms', { base_url: before.base_url, config: before.config, is_active: before.is_active });
	for (const tab of ['Исходящие', 'Входящие', 'Связи']) {
		await page.getByRole('tab', { name: tab }).click().catch(async () => page.getByText(tab, { exact: true }).first().click());
		await page.waitForTimeout(700);
		check((await page.locator('[role=alert]').count()) === 0, `вкладка «${tab}» загрузилась без ошибок`);
	}

	console.log('Шаблоны уведомлений');
	await page.goto(`${BASE}/admin/notification-templates`);
	await page.waitForSelector('text=Пароль изменён', { timeout: 15000 }).catch(() => {});
	const total = await page.locator('[role=row], tbody tr, .atmr-tablegrid__row').count();
	console.log(`    строк в списке: ${total}`);
	await page.getByRole('button', { name: 'Создать шаблон' }).first().click();
	const d2 = page.locator('.atmr-drawer');
	await pick(page, d2, 'Событие', 'Событие по сделке');
	await pick(page, d2, 'Канал', 'Электронная почта');
	await field(d2, 'Тема письма').locator('input').fill('Тест: событие {{ deal_number }}');
	await d2.locator('textarea').first().fill('Тестовый шаблон для проверки.');
	await d2.getByRole('button', { name: 'Создать' }).click();
	await page.waitForTimeout(1200);
	// повторный прогон: тестовый шаблон уже есть (удаления у бэкенда нет) — форма осталась открытой с ошибкой, закрываем
	if (await d2.isVisible().catch(() => false)) {
		await page.keyboard.press('Escape');
		await page.waitForTimeout(500);
	}
	const created = (await api('admin', 'GET', '/api/admin/notification-templates?code=DEAL_EVENT&limit=20')).json.items.find((t) => t.channel === 'email' && t.subject_template?.startsWith('Тест:'));
	check(Boolean(created), 'шаблон создан (DEAL_EVENT / email)');
	if (created) {
		// 409: версия изменилась в другой вкладке
		await page.getByText('Событие по сделке').first().click();
		await page.waitForTimeout(500);
		await api('admin', 'PATCH', `/api/admin/notification-templates/${created.id}`, { body_template: 'Изменено в другой вкладке' }, { 'If-Match': `"${created.version}"` });
		await d2.locator('textarea').first().fill('Моя правка');
		await d2.getByRole('button', { name: 'Сохранить' }).click();
		await page.waitForTimeout(900);
		check((await d2.getByText('Данные изменил другой пользователь').count()) > 0, '409: плашка конфликта версий');
		await page.keyboard.press('Escape');
		// деактивируем тестовый шаблон (удаления у бэкенда нет)
		const cur = (await api('admin', 'GET', '/api/admin/notification-templates?code=DEAL_EVENT&limit=20')).json.items.find((t) => t.id === created.id);
		const off = await api('admin', 'PATCH', `/api/admin/notification-templates/${created.id}`, { is_active: false }, { 'If-Match': `"${cur.version}"` });
		check(off.status === 200, 'тестовый шаблон деактивирован (удаление у бэкенда не предусмотрено)');
	}

	console.log('Реестр ЕГРЮЛ');
	await page.goto(`${BASE}/admin/registry`);
	await page.waitForSelector('text=Реестр ЕГРЮЛ');
	await page.waitForTimeout(800);
	const versions = (await api('admin', 'GET', '/api/admin/registry/versions')).json.items;
	console.log(`    версий реестра: ${versions.length}`);
	await page.getByRole('button', { name: 'Загрузить выгрузку' }).first().click();
	const d3 = page.locator('.atmr-drawer');
	check((await d3.getByText('Источник').count()) > 0, 'панель загрузки открылась');
	// синтетическая выгрузка ФНС: схема СвЮЛ (см. backend/app/modules/registry/egrul_xml.py)
	const xml = `<?xml version="1.0" encoding="UTF-8"?><Файл><Документ><СвЮЛ ИНН="7704217370" ОГРН="1027700132195" КПП="770401001" ДатаОГРН="2002-08-14"><СвНаимЮЛ НаимЮЛПолн="ФЕДЕРАЛЬНОЕ ГОСУДАРСТВЕННОЕ БЮДЖЕТНОЕ ОБРАЗОВАТЕЛЬНОЕ УЧРЕЖДЕНИЕ ВЫСШЕГО ОБРАЗОВАНИЯ «ТЕСТОВЫЙ УНИВЕРСИТЕТ»" НаимЮЛСокр="ТЕСТОВЫЙ УНИВЕРСИТЕТ"/><СвОКВЭД><СвОКВЭДОсн КодОКВЭД="85.22"/></СвОКВЭД></СвЮЛ></Документ></Файл>`;
	await d3.locator('input[type=file]').setInputFiles({ name: 'egrul-test.xml', mimeType: 'text/xml', buffer: Buffer.from(xml, 'utf8') });
	await d3.getByRole('button', { name: 'Загрузить' }).click();
	await page.waitForTimeout(2500);
	const after2 = (await api('admin', 'GET', '/api/admin/registry/versions')).json.items;
	check(after2.length === versions.length + 1, 'версия реестра создана (задание принято)');
	await page.waitForFunction(() => !document.body.innerText.includes('В очереди') && !document.body.innerText.includes('Загружается'), null, { timeout: 60000 }).catch(() => {});
	await page.waitForTimeout(800);
	await page.screenshot({ path: '.shots/b-data/registry.png' });
	const last = (await api('admin', 'GET', '/api/admin/registry/versions')).json.items[0];
	console.log(`    последняя версия: ${last.status}${last.error ? ' — ' + last.error : ''} (${last.entries_count} записей)`);

	console.log('Права');
	for (const who of ['head', 'kam', 'auditor']) {
		await api(who, 'GET', '/api/me');
		const p2 = await newPage(browser, { who, width: 1280, height: 800 });
		await p2.goto(`${BASE}/admin/integrations`);
		await p2.waitForSelector('text=Нет доступа', { timeout: 15000 }).catch(() => {});
		check((await p2.getByText('Нет доступа').count()) > 0, `${who}: /admin/integrations → «Нет доступа»`);
		await p2.close();
	}

	const p = page.__problems;
	console.log(p.pageerrors.length ? `  ✗ page errors: ${p.pageerrors.join(' | ')}` : '  ✓ нет исключений на странице');
	const real = p.console.filter((c) => !/status of (409|422)/.test(c));
	console.log(real.length ? `  ✗ console: ${real.join(' | ')}` : '  ✓ нет ошибок консоли');
	if (p.failed.length) console.log(`  · неудачные запросы: ${[...new Set(p.failed)].join(' | ')}`);
} finally {
	await browser.close();
}
