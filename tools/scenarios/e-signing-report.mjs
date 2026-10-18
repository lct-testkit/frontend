// Отчёт «Подписание по периодам» (F9-7): карточка в реестре, форма параметров, запуск, проверка тела запроса и колонок результата.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-signing-report.mjs      (SHOTS_DIR=… W=390 H=844 THEME=rtk_default_dark — кадры)
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
const shot = async (page, name) => {
	if (!SHOTS) return;
	await page.waitForTimeout(600);
	await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const ITEM = '[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]';

const head = await apiAs('head');
const drawer = (page) => page.locator('.atmr-drawer');

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'head', width: W, height: H, theme: process.env.THEME ?? 'rtk_default_light' });
	await page.goto(`${BASE}/reports`);
	const card = page.getByRole('button', { name: /Подписание по периодам/ }).first();
	await card.waitFor({ timeout: 15000 });
	check(!/signature_documents/.test(await card.innerText()), 'карточка в реестре: описание без технических слов (signature_documents)');
	await shot(page, 'gallery');

	console.log('(a) форма параметров');
	await card.click();
	await drawer(page).getByText('Месяцев').first().waitFor({ timeout: 8000 });
	const labels = (await drawer(page).locator('.atmr-input__label').allInnerTexts()).map((t) => t.replace(/\s*\*$/, '').trim());
	check(['Месяцев', 'Тип документа'].every((l) => labels.includes(l)) && labels.some((l) => l.startsWith('Период')), `поля: ${labels.join(', ')}`);
	check(!labels.some((l) => /Вуз|Направлени|Продукт|Ответственн/.test(l)), 'нет фильтров по вузам, направлениям, продуктам и ответственным (сервер их не принимает)');
	await shot(page, 'drawer');

	console.log('(b) запуск с типом документа');
	await drawer(page).locator('.atmr-input', { has: page.locator('.atmr-input__label :text-is("Тип документа")') }).last().click();
	await page.locator(ITEM, { hasText: 'Акт' }).first().click();
	await drawer(page).getByRole('button', { name: 'Запустить' }).click();
	await page.waitForSelector('text=Отчёт готов', { timeout: 60000 });
	await shot(page, 'done');
	const last = (await head('/api/reports?limit=1')).body.items[0];
	const job = (await head(`/api/reports/${last.id}`)).body;
	check(job.template_code === 'signing_periods' && job.status === 'completed', 'отчёт «Подписание по периодам» готов');
	check(job.params?.months === 12 && job.params?.doc_type === 'act' && !('date_from' in job.params), `тело запроса: ${JSON.stringify(job.params)}`);
	const data = (await head(`/api/reports/${last.id}/data`)).body;
	check(Array.isArray(data.columns) && data.columns[0] === 'Месяц' && data.columns.includes('Доля подписанных, %') && data.rows.length === 12, `в отчёте ${data.rows?.length} месяцев, колонки: ${data.columns?.join(' | ')}`);
	await page.close();
} finally {
	await browser.close();
}
