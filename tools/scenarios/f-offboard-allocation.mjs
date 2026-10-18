// F3-9: мастер передачи дел с распределением на реальных данных стенда (под ADMIN, менеджер со многими сделками и вузами).
// Проходит мастер: полный список вузов и сделок (не первые 20), распределение «поровну», раскрытие вуза и выбор для отдельной сделки, сводка по людям,
// «Понимаю, что действие необратимо». Запрос «Подтвердить» ПОДМЕНЁН ответом-заглушкой: увольнение необратимо, стенд общий, а тестового сотрудника с делами
// не завести (назначить сделки и вузы можно только активному сотруднику, активным он становится после первого входа). Тело запроса сверяется с выбором.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-offboard-allocation.mjs [--user <id менеджера>] [--shots dir] [--size 390x844] [--theme rtk_default_dark]
import { join } from 'node:path';
import { BASE } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';
import { apiAs } from './f-lib.mjs';

const arg = (name) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : null);
const shots = arg('--shots');
const admin = await apiAs('admin');
const head = (await (await apiAs('head'))('/api/me')).body;
const kam = (await (await apiAs('kam'))('/api/me')).body;
const target = arg('--user') ?? kam.id;
const defaultSucc = target === head.id ? kam : head;
// на стенде всего два менеджера, а для распределения нужен третий: поиск сотрудников дополняется вымышленным преемником (запрос «Подтвердить» подменён)
const fake = { id: crypto.randomUUID(), full_name: 'Тестовый Преемник', display_name: null, role: 'KAM', team_id: null, status: 'active' };
const other = fake;

const itemsApi = async (kind) => {
	const out = [];
	let cursor = '';
	for (let i = 0; i < 100; i += 1) {
		const r = (await admin(`/api/admin/users/${target}/offboard/items?kind=${kind}&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`)).body;
		out.push(...r.items);
		if (!r.next_cursor) break;
		cursor = r.next_cursor;
	}
	return out;
};
const allDeals = await itemsApi('deals');
const allOrgs = await itemsApi('organizations');
console.log(`у сотрудника сделок ${allDeals.length}, вузов ${allOrgs.length}`);

const browser = await newBrowser();
const [vw, vh] = (arg('--size') ?? '1440x900').split('x').map(Number);
const page = await newPage(browser, { who: 'admin', width: vw, height: vh, theme: arg('--theme') ?? 'rtk_default_light' });
const shot = async (name) => shots && (await page.waitForTimeout(700), await page.screenshot({ path: join(shots, `${name}${arg('--suffix') ? `-${arg('--suffix')}` : ''}.png`) }));
const option = (text) => page.locator('.atmr-dropdown-menu__item, [class*=dropdown-menu] [role=option]').filter({ hasText: text }).first();
const pickIn = async (row, text) => {
	await row.locator('input').first().click();
	await option(text).click();
};
const choosePerson = async (label, person) => {
	const input = page.locator(`.atmr-input:has(.atmr-input__label span:text-is("${label}")) input`).first();
	await input.click();
	await input.fill(person.full_name.split(' ')[0]);
	await option(person.full_name).click();
};
let captured = null;
try {
	await page.route('**/api/users/directory*', async (route) => {
		const url = new URL(route.request().url());
		if (url.searchParams.get('ids')) return route.continue();
		const res = await route.fetch();
		const data = await res.json();
		return route.fulfill({ response: res, json: { ...data, items: [...(data.items ?? []), fake] } });
	});
	await page.route(/\/api\/admin\/users\/[^/]+\/offboard$/, async (route) => {
		const body = route.request().postDataJSON();
		if (body.mode !== 'confirm') return route.continue();
		captured = body;
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'confirm', user_id: target, workload: [], reassigned_deals: Object.keys(body.deal_successors ?? {}).slice(0, 3), reassigned_organizations: [], signature_requests_reassigned: 0, sessions_terminated: 0, status: 'terminated', warnings: [], distribution: [] }) });
	});

	step('шаг «Дела»: счётчики сделок и вузов, полный список — на следующем шаге');
	await page.goto(`${BASE}/admin/users/${target}/offboard`, { waitUntil: 'load' });
	await page.getByText('Вузы', { exact: true }).first().waitFor({ timeout: 15000 });
	await shot('1-step-deals');
	await page.getByTestId('offboard-next').click();

	step('шаг «Преемник и распределение»: полный список, поровну, отдельная сделка');
	await page.locator('textarea').first().fill('Проверка распределения (подтверждение подменено)');
	await choosePerson('Преемник по умолчанию', defaultSucc);
	await page.locator('.atmr-switch').filter({ hasText: 'Распределить по вузам' }).first().click();
	await page.getByTestId('allocation').waitFor({ timeout: 20000 });
	const orgsShown = await page.getByTestId('alloc-org').count();
	expect(orgsShown === allOrgs.length, `в блоке «Вузы сотрудника» ${orgsShown} из ${allOrgs.length} (полный список, а не первые 20)`);
	await choosePerson('Добавить сотрудника для распределения', other);
	await page.getByTestId('alloc-spread').click();
	// раскрыть первую группу и выбрать отдельной сделке «Как у всех»
	const firstGroup = page.locator('[data-testid=allocation] > div').first();
	await firstGroup.getByRole('button', { name: 'Показать сделки' }).click();
	await page.getByTestId('alloc-deal').first().waitFor();
	const dealsShown = await page.getByTestId('alloc-deal').count();
	console.log(`  раскрыта первая группа: ${dealsShown} сделок`);
	await shot('2-allocation');
	await pickIn(page.getByTestId('alloc-org').first(), other.full_name);
	await page.getByTestId('offboard-next').click();

	step('шаг «Подтверждение»: сводка по людям');
	const sum = (await page.getByTestId('allocation-summary').innerText()).replace(/\s+/g, ' ');
	console.log('  сводка:', sum.slice(0, 260));
	expect(/сдел/.test(sum), 'сводка называет сделки по преемникам');
	await shot('3-summary');
	await page.getByText('Понимаю, что действие необратимо').click();
	await page.getByTestId('offboard-confirm').click();
	await page.getByTestId('offboard-done').waitFor({ timeout: 15000 });
	await shot('4-done');

	step('тело запроса');
	expect(!!captured, 'запрос «Подтвердить» ушёл (перехвачен)');
	const ds = captured.deal_successors ?? {};
	const dealIdSet = new Set(allDeals.map((d) => d.id));
	expect(Object.keys(ds).length > 0, 'deal_successors не пуст после «Разложить поровну»');
	expect(Object.keys(ds).every((id) => dealIdSet.has(id)) && Object.values(ds).every((v) => v !== captured.successor_id), `deal_successors: ${Object.keys(ds).length} из ${allDeals.length} сделок, у всех преемник не по умолчанию, все принадлежат сотруднику`);
	expect(Object.keys(ds).length < allDeals.length, 'в теле только отличия от умолчания, а не все сделки');
	const os = captured.organization_successors ?? {};
	expect(Object.values(os).every((v) => v !== captured.successor_id), `organization_successors: ${Object.keys(os).length} вуз(ов), преемник не по умолчанию`);
	console.log(`  тело запроса ${Math.round(JSON.stringify(captured).length / 1024)} КБ`);
	console.log('problems', JSON.stringify(page.__problems.pageerrors));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 700));
	if (shots) await page.screenshot({ path: join(shots, 'fail.png') });
	process.exitCode = 1;
} finally {
	await browser.close();
}
