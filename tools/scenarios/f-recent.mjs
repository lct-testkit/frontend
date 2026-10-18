// F3-10: «Недавние» организации и контакты без названий в localStorage; два экрана; выход стирает историю.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-recent.mjs [--out .shots/f]
import { mkdir } from 'node:fs/promises';
import { BASE, accessToken } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : '.shots/f';
await mkdir(out, { recursive: true });
const tok = await accessToken('kam');
const call = async (path) => (await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
const second = await page.context().newPage();
try {
	const org = (await call('/api/organizations?limit=1')).items[0];
	const contact = (await call('/api/contacts?limit=1')).items[0];
	const fio = [contact.last_name, contact.first_name].filter(Boolean).join(' ');

	step('открыть организацию и контакт');
	await page.goto(`${BASE}/organizations/${org.id}`, { waitUntil: 'load' });
	await page.waitForTimeout(1500);
	await page.goto(`${BASE}/contacts/${contact.id}`, { waitUntil: 'load' });
	await page.waitForTimeout(1500);

	step('в localStorage только вид, id и время');
	const raw = await page.evaluate(() => ({ v2: localStorage.getItem('rtk.crm.recent.v2'), v1: localStorage.getItem('rtk.crm.recent') }));
	expect(raw.v1 === null, 'старого ключа нет');
	expect(!!raw.v2 && raw.v2.includes(org.id) && raw.v2.includes(contact.id), 'v2 содержит id организации и контакта');
	expect(!raw.v2.includes(contact.last_name) && !raw.v2.includes(org.name) && !raw.v2.includes('title'), 'в v2 нет ни ФИО, ни названия вуза');

	step('«Недавние» на /deals');
	await page.goto(`${BASE}/deals`, { waitUntil: 'load' });
	await page.waitForTimeout(2000);
	await page.locator('button[aria-label="Недавние"]').click();
	await page.waitForTimeout(1500);
	const popText = await page.locator('[aria-label="Недавно открытые"]').innerText();
	expect(popText.includes(contact.last_name), `в «Недавних» контакт «${fio}»`);
	expect(popText.includes(org.short_name || org.name), 'в «Недавних» организация');
	await page.waitForTimeout(3500);
	await page.screenshot({ path: `${out}/recent-deals.png` });

	step('главная');
	await page.goto(`${BASE}/`, { waitUntil: 'load' });
	await page.waitForTimeout(1500);
	expect((await page.locator('[aria-label="Недавно открытые"]').innerText()).includes(contact.last_name), 'на главной есть контакт');

	step('удалённая организация пропадает из списка без ошибок');
	await page.evaluate(() => {
		const all = JSON.parse(localStorage.getItem('rtk.crm.recent.v2') ?? '{}');
		const id = Object.keys(all)[0];
		all[id].unshift({ type: 'organization', id: '00000000-0000-4000-8000-000000000001', opened_at: new Date(Date.now() + 1000).toISOString() });
		localStorage.setItem('rtk.crm.recent.v2', JSON.stringify(all));
	});
	await page.reload({ waitUntil: 'load' });
	await page.waitForTimeout(1500);
	const text = await page.locator('[aria-label="Недавно открытые"]').innerText();
	expect(!text.includes('…') && !text.includes('недоступ'), 'выдуманная организация скрыта');

	step('две вкладки: запись из второй появляется в первой');
	await second.goto(`${BASE}/organizations/${(await call('/api/organizations?limit=3')).items[2].id}`, { waitUntil: 'load' });
	await second.waitForTimeout(1500);
	const third = (await call('/api/organizations?limit=3')).items[2];
	await page.waitForTimeout(800);
	expect((await page.locator('[aria-label="Недавно открытые"]').innerText()).includes(third.short_name || third.name), 'первая вкладка обновилась по событию storage');

	step('выход стирает историю');
	await page.getByText('Менеджер по вузам').click();
	await page.getByText('Выйти', { exact: true }).click();
	await page.waitForURL('**/login', { timeout: 8000 });
	const keys = await page.evaluate(() => Object.keys(localStorage));
	expect(!keys.some((k) => k.startsWith('rtk.crm.recent')), `localStorage после выхода: [${keys.join(', ')}]`);
} finally {
	await browser.close();
}
