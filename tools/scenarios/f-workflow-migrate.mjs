// Мастер «Перенести сделки со старых шагов» на живом бэкенде (F4-7): временная воронка из трёх шагов, две сделки на среднем,
// перенос среднего шага на последний; проверяет таблицу со счётчиком, выполнение, архив шага, сделки на новом шаге и запись переноса в истории.
// Правила по условиям (`mapping_rules`) бэкенд пока не применяет — в сценарии их нет. В конце временная воронка уходит в архив.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-workflow-migrate.mjs
import { BASE, newBrowser, newPage } from '../lib.mjs';
import { apiAs } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const idem = () => ({ 'Idempotency-Key': crypto.randomUUID() });

const admin = await apiAs('admin');
const kam = await apiAs('kam');
const code = `f4_migrate_${Date.now().toString(36)}`;
const created = await admin('/api/workflows', { method: 'POST', headers: idem(), body: JSON.stringify({ code, name: 'F4 перенос (временная)', deal_type: 'b2b', is_default: false }) });
const wfId = created.body.workflow?.id ?? created.body.id;
const version = async () => (await admin(`/api/workflows/${wfId}`)).body.workflow.version;
const step = (c, n, type, order) => ({ code: c, name: n, type, sort_order: order, required_fields: [] });
const tr = (from, to, name) => ({ from_status: from, to_status: to, name, allowed_roles: [], conditions: {}, actions: [], requires_comment: false, sort_order: 10 });
const put = await admin(`/api/workflows/${wfId}/graph`, {
	method: 'PUT',
	headers: { 'If-Match': `"${await version()}"` },
	body: JSON.stringify({
		statuses: [step('s_one', 'Первый шаг', 'initial', 10), step('s_old', 'Старый шаг', 'intermediate', 20), step('s_new', 'Новый шаг', 'intermediate', 30), step('s_won', 'Успех', 'won', 1000)],
		transitions: [tr('s_one', 's_old', 'Дальше'), tr('s_old', 's_new', 'Дальше'), tr('s_new', 's_won', 'Закрыть'), tr('s_old', 's_one', 'Назад')],
		sla_rules: []
	})
});
if (put.status >= 300) throw new Error(`граф: ${put.status} ${JSON.stringify(put.body).slice(0, 300)}`);
const pub = await admin(`/api/workflows/${wfId}/publish`, { method: 'POST', headers: { 'If-Match': `"${await version()}"` } });
if (pub.status >= 300) throw new Error(`публикация: ${pub.status} ${JSON.stringify(pub.body).slice(0, 300)}`);
const graph = (await admin(`/api/workflows/${wfId}`)).body;
const idOf = (c) => graph.statuses.find((s) => s.code === c).id;

const org = (await kam('/api/organizations?limit=1')).body.items[0];
const deals = [];
for (const title of ['F4 перенос А', 'F4 перенос Б']) {
	let deal = (await kam('/api/deals', { method: 'POST', headers: idem(), body: JSON.stringify({ title, deal_type: 'b2b', organization_id: org.id, workflow_id: wfId, amount: '1000', currency: 'RUB', priority: 'normal' }) })).body;
	const res = await kam(`/api/deals/${deal.id}/transition`, { method: 'POST', headers: { 'If-Match': `"${deal.version}"` }, body: JSON.stringify({ to_status_id: idOf('s_old'), fields: {}, attachments: [] }) });
	if (res.status !== 200) throw new Error(`переход: ${res.status} ${JSON.stringify(res.body).slice(0, 300)}`);
	deals.push(res.body.deal);
}
ok(`воронка ${code}: 3 шага, две сделки на «Старый шаг»`);

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(`${BASE}/workflows/${wfId}`);
	await page.waitForSelector('.svelte-flow__node');
	await page.getByRole('button', { name: 'Ещё' }).click();
	await page.getByText('Перенести сделки со старых шагов', { exact: true }).click();
	await page.getByTestId('migration-rows').waitFor();
	await page.waitForTimeout(1500);
	const rowOld = page.getByTestId('migration-rows').locator('li', { hasText: 'Старый шаг' });
	/2\s+сделки/.test(await rowOld.innerText()) ? ok('в таблице у «Старый шаг» счётчик «2 сделки»') : fail(`счётчик: ${(await rowOld.innerText()).replace(/\n/g, ' ')}`);
	(await page.getByTestId('migration-rows').locator('li', { hasText: 'Первый шаг' }).innerText()).includes('шаг 1') ? ok('у начального статуса подсказка «переименуйте в шаг 1»') : fail('нет подсказки про начальный статус');
	await page.screenshot({ path: '.shots/f/migrate-table.png' }).catch(() => {});
	await rowOld.locator('input').first().click();
	await page.getByText('Новый шаг', { exact: true }).last().click();
	await page.getByTestId('migration-next').click();
	await page.getByTestId('migration-plan').waitFor();
	/«Старый шаг» → «Новый шаг»: 2\s+сделки/.test(await page.getByTestId('migration-plan').innerText()) ? ok('проверка: «Старый шаг» → «Новый шаг»: 2 сделки') : fail('текст проверки');
	(await page.getByTestId('migration-next').isDisabled()) ? ok('«Перенести» заблокирована, пока не отмечено «Я проверил таблицу»') : fail('кнопка не заблокирована');
	await page.getByText('Я проверил таблицу').click();
	await page.screenshot({ path: '.shots/f/migrate-check.png' }).catch(() => {});
	await page.getByTestId('migration-next').click();
	await page.getByText('Готово: старые шаги в архиве').waitFor({ timeout: 60000 });
	ok('выполнение завершено');
	const after = (await admin(`/api/workflows/${wfId}`)).body;
	after.statuses.find((s) => s.code === 's_old').is_archived ? ok('«Старый шаг» в архиве') : fail('шаг не в архиве');
	for (const d of deals) {
		const now = (await kam(`/api/deals/${d.id}`)).body.deal;
		const hist = (await kam(`/api/deals/${d.id}/history`)).body;
		const migrated = hist.statuses.some((s) => s.reason === 'workflow_migration') || hist.events.some((e) => e.event_type === 'WORKFLOW_MIGRATION');
		now.status_id === idOf('s_new') && migrated ? ok(`${d.number}: на «Новый шаг», в истории есть перенос`) : fail(`${d.number}: status ${now.status_id === idOf('s_new')}, перенос в истории ${migrated}`);
	}
	console.log(page.__problems.console.length ? `  ✗ console: ${page.__problems.console.join(' | ')}` : '  ✓ нет ошибок консоли');
} finally {
	await browser.close();
	// сделки сценария удаляем (мягко), иначе воронку не архивировать
	for (const d of deals) {
		const cur = (await admin(`/api/deals/${d.id}`)).body.deal;
		await admin(`/api/deals/${d.id}`, { method: 'DELETE', headers: { 'If-Match': `"${cur.version}"` }, body: JSON.stringify({ reason: 'тестовая сделка сценария' }) });
	}
	const arch = await admin(`/api/workflows/${wfId}/archive`, { method: 'POST', headers: { 'If-Match': `"${await version()}"` } });
	console.log(`  временная воронка в архив: ${arch.status}${arch.status >= 300 ? ' ' + JSON.stringify(arch.body).slice(0, 200) : ''}`);
}
