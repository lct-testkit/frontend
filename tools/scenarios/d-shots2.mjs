// Скриншоты форм-drawer/modal после перевода на rt-ui (агент D): конфликт в правке сделки, ошибка передачи, «Дополнительно», похожие организации.
// node tools/scenarios/d-shots2.mjs [light|dark]
import { BASE, accessToken } from '../lib.mjs';
import { field, newBrowser, newPage, step } from './a-lib.mjs';

const theme = process.argv[2] === 'dark' ? 'rtk_default_dark' : 'rtk_default_light';
const sfx = theme.endsWith('dark') ? '-dark' : '';
const tok = await accessToken('kam');
const api = async (method, path, body, headers = {}) => {
	const r = await fetch(`${BASE}${path}`, { method, headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	return { status: r.status, json: await r.json().catch(() => null) };
};
const org = (await api('GET', '/api/organizations?q=КГТУ&limit=1')).json.items[0];
const created = async () =>
	(await api('POST', '/api/deals', { title: `Снимки D2 ${Date.now().toString().slice(-5)}`, deal_type: 'b2b', organization_id: org.id, amount: '100000', currency: 'RUB', priority: 'normal' }, { 'Idempotency-Key': crypto.randomUUID() })).json;

const browser = await newBrowser();
try {
	for (const [w, h, label] of [[1440, 900, 'desktop'], [360, 640, 'phone-s']]) {
		const page = await newPage(browser, { who: 'kam', width: w, height: h, theme });
		step(`${label}: правка сделки — конфликт`);
		const d = await created();
		await page.goto(`${BASE}/deals/${d.id}`, { waitUntil: 'load' });
		await page.getByTestId('deal-primary-transition').waitFor();
		await api('PATCH', `/api/deals/${d.id}`, { title: 'Изменено в другой вкладке' }, { 'If-Match': `"${d.version}"` });
		if (w < 768) await page.getByTestId('deal-more').click();
		await page.getByTestId('deal-edit').click();
		await field(page, 'Название').fill('Моё название');
		await page.getByTestId('deal-save').click();
		await page.getByText('изменена другим пользователем').first().waitFor({ timeout: 8000 });
		await page.waitForTimeout(400);
		await page.screenshot({ path: `.shots/d/edit-conflict-${label}${sfx}.png` });
		await page.locator('.atmr-drawer, [role=dialog]').getByRole('button', { name: 'Обновить', exact: true }).click();
		await page.waitForTimeout(1000);
		console.log('   после «Обновить» баннер:', await page.getByText('изменена другим пользователем').count());
		await page.keyboard.press('Escape');
		await page.close();

		step(`${label}: новая сделка — «Дополнительно»`);
		const p2 = await newPage(browser, { who: 'kam', width: w, height: h, theme });
		await p2.goto(`${BASE}/deals?new=1`, { waitUntil: 'load' });
		await p2.getByRole('button', { name: 'Дополнительно' }).waitFor();
		await p2.getByRole('button', { name: 'Дополнительно' }).click();
		await p2.waitForTimeout(500);
		await p2.screenshot({ path: `.shots/d/newdeal-more-${label}${sfx}.png` });
		console.log('   aria-expanded:', await p2.getByRole('button', { name: 'Дополнительно' }).getAttribute('aria-expanded'));
		// ошибка: отправка без названия — только подсказки полей; принудительно вызовем 'нет воронки' не можем — пропускаем
		await p2.close();

		step(`${label}: организация — похожие названия`);
		const p3 = await newPage(browser, { who: 'kam', width: w, height: h, theme });
		await p3.goto(`${BASE}/organizations?new=1`, { waitUntil: 'load' });
		await p3.getByRole('button', { name: 'Заполнить вручную' }).click();
		await field(p3, 'Полное название').fill('Казанский технологический институт');
		await p3.waitForTimeout(1500);
		await p3.screenshot({ path: `.shots/d/org-similar-${label}${sfx}.png` });
		await p3.close();

		step(`${label}: HEAD — передача сделки без выбора`);
		const p4 = await newPage(browser, { who: 'head', width: w, height: h, theme });
		await p4.goto(`${BASE}/deals/${d.id}`, { waitUntil: 'load' });
		await p4.getByTestId('deal-primary-transition').waitFor();
		if (w < 768) await p4.getByTestId('deal-more').click();
		await p4.getByTestId('deal-reassign').click();
		await p4.getByRole('button', { name: 'Передать', exact: true }).click();
		await p4.waitForTimeout(600);
		await p4.screenshot({ path: `.shots/d/reassign-error-${label}${sfx}.png` });
		await p4.close();
	}
} catch (e) {
	console.log('FAIL', e.message.slice(0, 400));
	process.exitCode = 1;
} finally {
	await browser.close();
}
