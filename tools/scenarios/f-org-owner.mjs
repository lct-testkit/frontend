// F3-8: ответственный за вуз: Руководитель меняет, снимает и назначает (карточка и список), видит историю смен; у КАМ ввода нет и прямой запрос даёт 403.
// Вузы берутся из стенда и в конце возвращаются прежнему ответственному.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-org-owner.mjs [--shots dir]
import { join } from 'node:path';
import { BASE } from '../lib.mjs';
import { choose, expect, field, newBrowser, newPage, step } from './a-lib.mjs';
import { apiAs } from './f-lib.mjs';

const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const head = await apiAs('head');
const kam = await apiAs('kam');
const me = (await head('/api/me')).body;
const kamMe = (await kam('/api/me')).body;
const orgs = (await head(`/api/organizations?owner_id=${kamMe.id}&limit=5`)).body.items;
if (orgs.length < 3) throw new Error('нужно три вуза менеджера Иван Тесткитович');
const [a, b, c] = orgs;
const restore = async () => {
	for (const o of [a, b, c]) {
		const cur = (await head(`/api/organizations/${o.id}`)).body;
		if (cur.owner_id !== kamMe.id) await head(`/api/organizations/${o.id}/owner`, { method: 'PUT', headers: { 'If-Match': `"${cur.version}"` }, body: JSON.stringify({ owner_id: kamMe.id, reason: 'возврат после сценария' }) });
	}
};

const browser = await newBrowser();
const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
const shot = async (name) => shots && (await page.waitForTimeout(700), await page.screenshot({ path: join(shots, `${name}.png`) })); // пауза: окна и подписи полей всплывают с анимацией
try {
	step('карточка: Руководитель меняет ответственного с причиной');
	await page.goto(`${BASE}/organizations/${a.id}`, { waitUntil: 'load' });
	await page.getByTestId('org-owner-change').click();
	await field(page, 'Причина').waitFor();
	await shot('1-owner-modal');
	await choose(page, 'Кому передать', me.full_name, { type: me.full_name.split(' ')[0] });
	await field(page, 'Причина').fill('Уход в отпуск');
	await page.getByRole('button', { name: 'Сменить', exact: true }).last().click();
	await page.getByTestId('org-owner').getByText(me.full_name).waitFor({ timeout: 8000 });
	expect(true, 'новый ответственный виден в карточке без перезагрузки');
	expect(((await head(`/api/organizations/${a.id}`)).body.owner_id) === me.id, 'на сервере ответственный сменён');
	await page.getByTestId('owner-log').waitFor({ timeout: 8000 });
	const log = (await page.getByTestId('owner-log').innerText()).replace(/\s+/g, ' ');
	expect(log.includes('Уход в отпуск') && log.includes(kamMe.full_name), `блок «Смены ответственного»: ${log.slice(0, 120)}`);
	await shot('2-card-after');

	step('карточка: снять ответственного');
	await page.getByTestId('org-owner-remove').click();
	await field(page, 'Причина').fill('Реорганизация отдела');
	await page.getByRole('button', { name: 'Снять', exact: true }).last().click();
	await page.getByText('Не назначен').first().waitFor({ timeout: 8000 });
	expect(((await head(`/api/organizations/${a.id}`)).body.owner_id) === null, 'ответственный снят');

	step('список: выбрать два вуза и снять ответственного, отчёт');
	await page.goto(`${BASE}/organizations`, { waitUntil: 'load' });
	await page.getByText(b.short_name || b.name).first().waitFor({ timeout: 10000 });
	for (const o of [b, c]) await page.locator('[role=row], tr, .atmr-tablegrid__row', { hasText: o.short_name || o.name }).first().locator('.atmr-checkbox').first().click();
	await page.getByText('Выбрано: 2').waitFor({ timeout: 5000 });
	await shot('3-selected');
	await page.getByTestId('orgs-bulk-remove').click();
	await field(page, 'Причина').fill('Реорганизация отдела');
	await page.getByRole('button', { name: 'Снять', exact: true }).last().click();
	await page.getByTestId('bulk-owner-report').waitFor({ timeout: 10000 });
	const report = (await page.getByTestId('bulk-owner-report').innerText()).replace(/\s+/g, ' ');
	expect(/Снято: 2\. Пропущено: 0/.test(report), `отчёт: ${report}`);
	await shot('4-report');
	for (const o of [b, c]) expect(((await head(`/api/organizations/${o.id}`)).body.owner_id) === null, `вуз «${o.short_name || o.name}» без ответственного`);

	step('КАМ: нет кнопок и чекбоксов, прямой запрос — 403');
	const kamPage = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
	await kamPage.goto(`${BASE}/organizations/${a.id}`, { waitUntil: 'load' });
	await kamPage.waitForTimeout(1500);
	expect((await kamPage.getByTestId('org-owner-change').count()) === 0, 'у КАМ нет кнопки «Сменить/Назначить»');
	await kamPage.goto(`${BASE}/organizations`, { waitUntil: 'load' });
	await kamPage.waitForTimeout(1500);
	expect((await kamPage.locator('input[type=checkbox], [role=checkbox]').count()) === 0, 'у КАМ нет чекбоксов в списке');
	const direct = await kam(`/api/organizations/${a.id}/owner`, { method: 'PUT', headers: { 'If-Match': '"1"' }, body: JSON.stringify({ owner_id: kamMe.id, reason: 'пробую напрямую' }) });
	expect(direct.status === 403, `прямой PUT от КАМ → ${direct.status}`);
	const patch = await kam(`/api/organizations/${a.id}`, { method: 'PATCH', headers: { 'If-Match': `"${(await head(`/api/organizations/${a.id}`)).body.version}"` }, body: JSON.stringify({ owner_id: kamMe.id }) });
	console.log(`  (справочно) прямой PATCH owner_id от КАМ → ${patch.status}`);
	console.log('problems', JSON.stringify(page.__problems));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 600));
	if (shots) await page.screenshot({ path: join(shots, 'fail.png') });
	process.exitCode = 1;
} finally {
	await browser.close();
	await restore();
	console.log('вузы возвращены прежнему ответственному');
}
