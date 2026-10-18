// Инциденты ПДн (F9-5): заведение, подтверждение, уведомления РКН 24 и 72 часа (текст, PDF, отметка подачи), уведомление субъектам, закрытие; права ролей.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-incidents.mjs      (SHOTS_DIR=… W=390 H=844 THEME=rtk_default_dark — кадры шагов)
// Создаёт инцидент «E2E F9 инцидент …» и доводит его до «Закрыт» (удалить инцидент нельзя).
import { BASE, newBrowser, newPage } from '../lib.mjs';
import { apiAs } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const SHOTS = process.env.SHOTS_DIR;
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
// кадр — после анимации окна и первой отрисовки списка
const shot = async (page, name) => {
	if (!SHOTS) return;
	await page.waitForTimeout(700);
	await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const field = (page, label) => page.locator('.atmr-input', { has: page.locator(`.atmr-input__label :text-is("${label}")`) }).last();
const TITLE = `E2E F9 инцидент ${Date.now().toString(36)}`;
const CONTACT = `E2E F9 контакт ${Date.now().toString(36)}, +7 900 000-00-00`;

const browser = await newBrowser();
try {
	console.log('(a) права ролей');
	for (const who of ['kam', 'head']) {
		const p = await newPage(browser, { who, width: 1440, height: 900 });
		await p.goto(`${BASE}/admin/incidents`);
		await p.getByText('Нет доступа').first().waitFor({ timeout: 8000 });
		check((await p.locator('[data-nav="incidents"]').count()) === 0, `${who}: пункта меню нет, по адресу «Нет доступа»`);
		await p.close();
	}
	const aud = await newPage(browser, { who: 'auditor', width: 1440, height: 900 });
	await aud.goto(`${BASE}/admin/incidents`);
	await aud.getByRole('tab', { name: /Все/ }).first().waitFor({ timeout: 8000 }).catch(() => {});
	await aud.waitForTimeout(1200);
	check((await aud.getByTestId('incident-new').count()) === 0 && (await aud.locator('[data-nav="incidents"]').count()) > 0, 'аудитор: пункт меню виден, кнопки «Завести инцидент» нет');
	await aud.close();

	console.log('(b) заведение и подтверждение');
	const page = await newPage(browser, { who: 'admin', width: W, height: H, theme: process.env.THEME ?? 'rtk_default_light' });
	await page.goto(`${BASE}/admin/incidents`);
	await page.getByTestId('incident-new').waitFor({ timeout: 15000 });
	await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
	await shot(page, 'list');
	await page.getByTestId('incident-new').click();
	await field(page, 'Что случилось').locator('input').fill(TITLE);
	await shot(page, 'create');
	await page.getByRole('button', { name: 'Завести', exact: true }).click();
	await page.getByText('Это кандидат').waitFor({ timeout: 10000 });
	ok('инцидент заведён: кандидат, срок не идёт');
	await shot(page, 'card-candidate');
	const id = page.url().split('/').pop();

	await page.getByTestId('incident-confirm').click();
	await page.getByText('После подтверждения начинается отсчёт').waitFor();
	await shot(page, 'confirm');
	await page.getByTestId('incident-confirm-submit').click();
	await page.getByTestId('incident-deadline').waitFor({ timeout: 10000 });
	check(/осталось 23.ч/i.test(await page.getByTestId('incident-deadline').innerText()), 'после подтверждения идёт срок РКН 24 часа (осталось 23 ч …)');
	await shot(page, 'card-open');

	console.log('(c) уведомление РКН 24 часа');
	await page.getByTestId('incident-generate').click();
	await page.getByText('Суть инцидента').waitFor({ timeout: 15000 });
	await page.getByText('Шаблон текста — проект').waitFor();
	ok('текст уведомления: поля формы РКН и пометка «шаблон — проект»');
	await shot(page, 'notice');
	// контакта для РКН нет: поле в окне, после сохранения текст формируется заново с ним
	await field(page, 'Контакт для РКН').locator('input').fill(CONTACT);
	await page.getByTestId('notice-contact-save').click();
	await page.getByText(CONTACT).first().waitFor({ timeout: 15000 });
	check((await page.getByTestId('notice-contact-save').count()) === 0, 'контакт сохранён в настройках, текст сформирован заново с ним, поле ушло');
	await shot(page, 'notice-contact');
	const [link] = await Promise.all([page.waitForResponse((r) => /\/download-url/.test(r.url()), { timeout: 15000 }), page.getByTestId('notice-download').click()]);
	const { download_url: pdfUrl } = await link.json();
	const bytes = Buffer.from(await (await fetch(pdfUrl)).arrayBuffer());
	check(link.status() === 200 && bytes.subarray(0, 4).toString() === '%PDF', `«Скачать PDF»: ссылка выдана, файл — PDF (${bytes.length} байт)`);
	await page.getByTestId('notice-mark').click();
	await field(page, 'Номер или ссылка подачи').locator('input').fill('E2E-F9-24');
	await shot(page, 'mark-sent');
	await page.getByTestId('mark-sent-submit').click();
	await page.getByText('РКН: 24 ч подано').first().waitFor({ timeout: 10000 });
	check(/Уведомление РКН · 72 часа/.test(await page.getByTestId('incident-deadline').innerText()), 'после отметки подачи идёт срок 72 часа');
	await shot(page, 'card-24-sent');

	console.log('(d) субъекты, 72 часа, закрытие');
	await page.getByTestId('incident-subjects').click();
	await page.getByRole('button', { name: 'Сформировать', exact: true }).click();
	await page.getByText('Сформировано').first().waitFor({ timeout: 15000 });
	ok('уведомление субъектам сформировано, дата в карточке');
	await page.getByTestId('incident-generate').click();
	await page.getByText('Итоги расследования').first().waitFor({ timeout: 15000 });
	await page.getByTestId('notice-mark').click();
	await field(page, 'Номер или ссылка подачи').locator('input').fill('E2E-F9-72');
	await page.getByTestId('mark-sent-submit').click();
	await page.getByText('РКН: 72 ч подано').first().waitFor({ timeout: 10000 });
	await page.getByTestId('incident-close').click();
	await page.getByTestId('reason-confirm').click();
	await page.getByText('Закрытый инцидент').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
	await page.getByText('Закрыт', { exact: true }).first().waitFor({ timeout: 10000 });
	ok('инцидент закрыт, действий больше нет');
	check((await page.getByTestId('incident-edit').count()) === 0, 'у закрытого инцидента нет кнопки «Редактировать»');
	await shot(page, 'card-closed');

	const admin = await apiAs('admin');
	const inc = (await admin(`/api/admin/incidents/${id}`)).body;
	check(inc.status === 'closed' && inc.rkn_24_reference === 'E2E-F9-24' && inc.rkn_72_reference === 'E2E-F9-72' && !!inc.subjects_notified_at, 'на сервере: closed, номера подач и дата уведомления субъектов записаны');
	await page.close();
} finally {
	// настройка pdn.rkn_contact общая для стенда: возвращаем пустое значение
	await (await apiAs('admin'))('/api/admin/system-settings/pdn.rkn_contact', { method: 'PUT', body: JSON.stringify({ value: '' }) }).catch(() => {});
	await browser.close();
}
