// Справочники (агент B): сквозной сценарий через интерфейс под ADMIN. Создаёт реальные демо-данные (направление + подраздел,
// причины отказа с перестановкой, дата календаря, пользовательское поле, продукт) и проверяет ошибки формы и конфликт версий.
//   node tools/scenarios/b-catalog.mjs [--headed]
import { BASE, newBrowser, newPage, accessToken } from '../lib.mjs';

const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
	console.log(`  ✗ ${msg}`);
	process.exitCode = 1;
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

const field = (page, label) => page.locator('.atmr-input', { has: page.locator(`.atmr-input__label :text-is("${label}")`) }).last();
const fill = async (page, label, value) => {
	await field(page, label).locator('input').fill(value);
};
async function pick(page, label, text) {
	await field(page, label).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: text }).first().click();
}
const drawer = (page) => page.locator('.atmr-drawer');
const save = async (page) => {
	await drawer(page).getByRole('button', { name: 'Сохранить' }).click();
};

async function api(who, method, path, body, headers = {}) {
	const token = await accessToken(who);
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(`${BASE}/catalog/directions`);
	await page.waitForLoadState('networkidle');

	console.log('Направления');
	const existing = (await api('admin', 'GET', '/api/directions?limit=100')).json.items;
	if (!existing.some((d) => d.code === 'programming')) {
		await page.getByRole('button', { name: 'Новое направление' }).first().click();
		await fill(page, 'Код', 'programming');
		await fill(page, 'Название', 'Программирование');
		await save(page);
		await page.getByText('Программирование', { exact: true }).first().waitFor();
		ok('направление создано');
	}
	if (!existing.some((d) => d.code === 'python')) {
		await page.getByLabel('Добавить подраздел').first().click();
		await fill(page, 'Код', 'python');
		await fill(page, 'Название', 'Python');
		await save(page);
		await page.getByText('Python', { exact: true }).first().waitFor();
		ok('подраздел создан (родитель подставлен)');
	}
	// дубль кода → ошибка под полем «Код»
	await page.getByRole('button', { name: 'Новое направление' }).first().click();
	await fill(page, 'Код', 'programming');
	await fill(page, 'Название', 'Дубль');
	await save(page);
	await page.waitForTimeout(800);
	check(await drawer(page).locator('.atmr-input--error').count() > 0, 'дубль кода: ошибка показана в форме');
	await page.keyboard.press('Escape');
	await page.waitForTimeout(500);

	console.log('Причины отказа');
	await page.goto(`${BASE}/catalog/loss-reasons`);
	await page.waitForLoadState('networkidle');
	const reasons = (await api('admin', 'GET', '/api/loss-reasons')).json.items;
	for (const [code, name, category] of [
		['too_expensive', 'Слишком дорого', 'Цена'],
		['competitor', 'Выбрали конкурента', 'Конкурент'],
		['no_budget', 'Нет бюджета', 'Нет бюджета']
	]) {
		if (reasons.some((r) => r.code === code)) continue;
		await page.getByRole('button', { name: 'Новая причина' }).first().click();
		await fill(page, 'Код', code);
		await fill(page, 'Название', name);
		await pick(page, 'Категория', category);
		await save(page);
		await page.getByText(name, { exact: true }).first().waitFor();
		ok(`причина «${name}»`);
	}
	const before = (await api('admin', 'GET', '/api/loss-reasons')).json.items;
	if (before.filter((r) => r.category === 'price').length >= 1) {
		// вторая причина в категории «Цена» — для проверки перестановки
		if (!before.some((r) => r.code === 'discount_needed')) {
			await page.getByRole('button', { name: 'Новая причина' }).first().click();
			await fill(page, 'Код', 'discount_needed');
			await fill(page, 'Название', 'Нужна скидка');
			await pick(page, 'Категория', 'Цена');
			await save(page);
			await page.getByText('Нужна скидка', { exact: true }).first().waitFor();
		}
		const group = page.locator('section', { has: page.getByRole('heading', { name: 'Цена' }) });
		const names = async () => (await group.locator('li .t-body-m-strong').allTextContents()).map((s) => s.trim());
		const first = await names();
		await group.getByLabel('Выше').nth(1).click();
		await page.waitForTimeout(1200);
		const second = await names();
		check(first.length >= 2 && second[0] === first[1], `перестановка стрелкой: ${first.join(' | ')} → ${second.join(' | ')}`);
	}

	console.log('Календарь');
	await page.goto(`${BASE}/catalog/holidays?year=2026`);
	await page.waitForLoadState('networkidle');
	const hol = (await api('admin', 'GET', '/api/holidays?date_from=2026-11-01&date_to=2026-11-30')).json.items;
	if (!hol.some((h) => h.date === '2026-11-04')) {
		await page.getByRole('button', { name: 'Добавить дату' }).first().click();
		await field(page, 'Дата').locator('input').fill('04.11.2026');
		await fill(page, 'Название', 'День народного единства');
		await save(page);
		await page.getByText('День народного единства').first().waitFor();
		ok('дата добавлена вводом дд.мм.гггг');
	}

	console.log('Пользовательские поля');
	await page.goto(`${BASE}/catalog/custom-fields?entity=product`);
	await page.waitForLoadState('networkidle');
	const defs = (await api('admin', 'GET', '/api/custom-field-defs?entity_type=product')).json.items;
	if (!defs.some((d) => d.code === 'license_type')) {
		await page.getByRole('button', { name: 'Новое поле' }).first().click();
		await pick(page, 'Тип', 'Выбор из списка');
		await fill(page, 'Код', 'license_type');
		await fill(page, 'Подпись', 'Тип лицензии');
		await drawer(page).getByText('Добавить вариант').click();
		await page.keyboard.type('Академическая');
		await page.keyboard.press('Enter');
		await drawer(page).getByText('Добавить вариант').click();
		await page.keyboard.type('Коммерческая');
		await page.keyboard.press('Enter');
		await save(page);
		await page.getByText('Тип лицензии', { exact: true }).first().waitFor();
		ok('поле «Тип лицензии» (список из 2 вариантов)');
	}

	console.log('Продукты');
	await page.goto(`${BASE}/catalog/products`);
	await page.waitForLoadState('networkidle');
	await page.getByText('Разработка на Python: базовый курс').first().click();
	await pick(page, 'Направление', 'Python');
	await save(page);
	await page.waitForTimeout(900);
	check((await page.getByText('Программирование › Python').count()) > 0, 'направление продукта показано путём «Программирование › Python»');

	// 409: версия продукта изменилась с другой вкладки
	await page.getByText('Разработка на Python: базовый курс').first().click();
	await page.waitForTimeout(600);
	const prod = (await api('admin', 'GET', '/api/products?code=py-base')).json.items[0];
	await api('admin', 'PATCH', `/api/products/${prod.id}`, { description: 'Изменено в другой вкладке' }, { 'If-Match': `"${prod.version}"` });
	await fill(page, 'Название', 'Разработка на Python: базовый курс (ред.)');
	await save(page);
	await page.waitForTimeout(900);
	check((await drawer(page).getByText('Данные изменил другой пользователь').count()) > 0, '409: плашка «данные изменил другой пользователь»');
	check((await field(page, 'Название').locator('input').inputValue()).endsWith('(ред.)'), '409: введённое осталось в форме');
	await drawer(page).getByRole('button', { name: 'Загрузить актуальные' }).click();
	await page.waitForTimeout(700);
	await fill(page, 'Название', 'Разработка на Python: базовый курс');
	await save(page);
	await page.waitForTimeout(900);
	check((await drawer(page).count()) === 0 || !(await drawer(page).isVisible().catch(() => false)), 'повторное сохранение после «Загрузить актуальные» прошло');

	const p = page.__problems;
	console.log(p.console.length || p.pageerrors.length ? `  ✗ console: ${p.console.join(' | ')} ${p.pageerrors.join(' | ')}` : '  ✓ нет ошибок консоли');
	if (p.failed.length) console.log(`  · неудачные запросы (ожидаемые 409/422 тоже): ${[...new Set(p.failed)].join(' | ')}`);
} finally {
	await browser.close();
}
