// F3-8, остальное: передача ответственного ВМЕСТЕ с открытыми сделками и конфликт версий (два окна браузера).
// Создаёт свою организацию «F3-8 тест» и две сделки на ней, в конце удаляет их (организация и сделки — мягким удалением под admin).
//   APP_URL=http://localhost:5275 node tools/scenarios/f-org-owner-carry.mjs [--shots dir]
import { join } from 'node:path';
import { BASE } from '../lib.mjs';
import { choose, expect, field, newBrowser, newPage, step } from './a-lib.mjs';
import { apiAs, deleteDealsByTitle } from './f-lib.mjs';

const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const ORG = 'F3-8 тест';
const DEAL = 'F3-8 тест сделка';
const head = await apiAs('head');
const admin = await apiAs('admin');
const kam = await apiAs('kam');
const headMe = (await head('/api/me')).body;
const kamMe = (await kam('/api/me')).body;

const org = (await head('/api/organizations', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ name: ORG, org_type: 'company' }) })).body;
if (!org.id) throw new Error('организация не создана: ' + JSON.stringify(org).slice(0, 200));
const orgOwner = async () => (await head(`/api/organizations/${org.id}`)).body;
if ((await orgOwner()).owner_id !== headMe.id) await head(`/api/organizations/${org.id}/owner`, { method: 'PUT', headers: { 'If-Match': `"${(await orgOwner()).version}"` }, body: JSON.stringify({ owner_id: headMe.id, reason: 'подготовка сценария' }) });
const wf = (await head('/api/workflows?state=published&limit=20')).body.items.find((w) => w.deal_type === 'b2b' && w.is_default);
const dealIds = [];
for (const n of [1, 2]) {
	const d = (await head('/api/deals', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ title: `${DEAL} ${n}`, deal_type: 'b2b', organization_id: org.id, workflow_id: wf.id, amount: '1000', currency: 'RUB' }) })).body;
	dealIds.push(d.id);
}

let second;
const browser = await newBrowser();
const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
const shot = async (p, name) => shots && (await p.waitForTimeout(700), await p.screenshot({ path: join(shots, `${name}.png`) }));
try {
	step('передача вместе с открытыми сделками');
	await page.goto(`${BASE}/organizations/${org.id}`, { waitUntil: 'load' });
	await page.getByTestId('org-owner-change').click();
	await field(page, 'Причина').waitFor();
	await choose(page, 'Кому передать', kamMe.full_name, { type: kamMe.full_name.split(' ')[0] });
	await field(page, 'Причина').fill('Передача вуза вместе со сделками');
	const carry = page.getByText(/Передать также 2 открытые сделки этого вуза/);
	await carry.waitFor({ timeout: 8000 });
	expect(true, 'в окне подпись «Передать также 2 открытые сделки этого вуза»');
	await carry.click();
	await shot(page, '5-carry-modal');
	await page.getByRole('button', { name: 'Сменить', exact: true }).last().click();
	await page.getByTestId('org-owner').getByText(kamMe.full_name).waitFor({ timeout: 10000 });
	expect((await orgOwner()).owner_id === kamMe.id, 'ответственный за вуз сменён');
	const owners = await Promise.all(dealIds.map(async (id) => (await head(`/api/deals/${id}`)).body.deal?.owner_id));
	expect(owners.every((o) => o === kamMe.id), `ответственный обеих сделок сменился на ${kamMe.full_name}`);
	await page.goto(`${BASE}/deals?organization=${org.id}`, { waitUntil: 'load' });
	await page.getByText('Найдено: 2').waitFor({ timeout: 10000 });
	await shot(page, '6-deals-after-carry');

	step('конфликт версий: два окна открыли карточку, первое меняет, второе пытается');
	second = await newPage(browser, { who: 'head', width: 1440, height: 900 });
	await page.goto(`${BASE}/organizations/${org.id}`, { waitUntil: 'load' });
	await second.goto(`${BASE}/organizations/${org.id}`, { waitUntil: 'load' });
	await page.getByTestId('org-owner-change').waitFor();
	await second.getByTestId('org-owner-change').waitFor();
	// второе окно открывает форму раньше, чем первое сохранит
	await second.getByTestId('org-owner-change').click();
	await field(second, 'Причина').waitFor();
	await choose(second, 'Кому передать', headMe.full_name, { type: headMe.full_name.split(' ')[0] });
	await field(second, 'Причина').fill('Вторая попытка с устаревшей версией');
	// первое окно успевает сохранить (снимает ответственного: сервер сначала проверяет нового ответственного, а не версию, поэтому в первом окне — снятие)
	await page.getByTestId('org-owner-remove').click();
	await field(page, 'Причина').waitFor();
	await field(page, 'Причина').fill('Первое окно сохранило раньше');
	await page.getByRole('button', { name: 'Снять', exact: true }).last().click();
	await page.getByTestId('org-owner').getByText('Не назначен').waitFor({ timeout: 10000 });
	// второе окно отправляет с устаревшей версией
	await second.getByRole('button', { name: 'Сменить', exact: true }).last().click();
	await second.getByText(/изменена другим пользователем/).first().waitFor({ timeout: 10000 });
	expect(true, 'во втором окне баннер конфликта версий');
	expect((await field(second, 'Причина').inputValue()) === 'Вторая попытка с устаревшей версией', 'введённая причина не затёрта');
	await shot(second, '7-conflict');
	expect((await orgOwner()).owner_id === null, 'данные первого окна на сервере не затёрты (вуз остался без ответственного)');
	await second.getByRole('button', { name: 'Обновить' }).last().click();
	await second.waitForTimeout(1200);
	expect((await field(second, 'Причина').inputValue()) === 'Вторая попытка с устаревшей версией', 'после «Обновить» причина по-прежнему на месте');
	await shot(second, '8-conflict-after-refresh');
	console.log('problems', JSON.stringify(page.__problems.pageerrors));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 600));
	if (shots) await (second ?? page).screenshot({ path: join(shots, 'carry-fail.png') });
	process.exitCode = 1;
} finally {
	await browser.close();
	let removed = 0;
	for (const n of [1, 2]) removed += await deleteDealsByTitle(`${DEAL} ${n}`);
	const cur = (await admin(`/api/organizations/${org.id}`)).body;
	const del = await admin(`/api/organizations/${org.id}`, { method: 'DELETE', headers: { 'If-Match': `"${cur.version}"` }, body: JSON.stringify({ reason: 'тестовая организация сценария' }) });
	console.log(`удалено сделок ${removed}, организация: ${del.status}`);
}
