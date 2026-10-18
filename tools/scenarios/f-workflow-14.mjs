// Воронка из 14 шагов на живом бэкенде (F4-10): редактор (17 узлов, слои рёбер, клик по «Отказ»), карточка сделки с пропущенным шагом 5 и
// замороженной сделкой, телефон 390 без горизонтальной прокрутки, нет ошибок консоли. Снимки — в `.shots/f/`. Нужен сид (tools/seed-demo.mjs).
//   APP_URL=http://localhost:5275 node tools/scenarios/f-workflow-14.mjs
import { mkdir } from 'node:fs/promises';
import { BASE, auditLayout, findB2bWorkflow, graphSteps, newBrowser, newPage } from '../lib.mjs';
import { apiAs, dealAlong, deleteDealsByTitle } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (cond, good, bad) => (cond ? ok(good) : fail(bad));
await mkdir('.shots/f', { recursive: true });

const admin = await apiAs('admin');
const api = async (p) => (await admin(p)).body;
const wf = await findB2bWorkflow(api);
const graph = await api(`/api/workflows/${wf.id}`);
const steps = graphSteps(graph);
const skipStep = steps[4];

// сделки сценария: пропуск шага 5 (4 → 6) и заморозка на шаге 3 (сид уже даёт такие, но сценарий не зависит от него)
const skipped = await dealAlong('kam', 'F4 сценарий: пропуск шага 5', [2, 3, 4, 6]);
const frozen = await dealAlong('kam', 'F4 сценарий: заморозка', [2, 3, 'park']);

const browser = await newBrowser();
try {
	// --- редактор
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(`${BASE}/workflows/${wf.id}`);
	await page.waitForSelector('.svelte-flow__node');
	await page.waitForTimeout(1200);
	const nodes = await page.locator('.svelte-flow__node').count();
	check(nodes === 17, `на холсте 17 узлов`, `узлов ${nodes}, ожидалось 17`);
	const optional = graph.transitions.some((t) => t.from_status_id === steps[3].id && t.to_status_id === steps[5].id);
	const edges = () => page.locator('.svelte-flow__edge').count();
	const main = await edges();
	check(main === (optional ? 15 : 14), `по умолчанию рёбер ${main} (основной путь${optional ? ' и переход через шаг' : ''})`, `по умолчанию рёбер ${main}`);
	const total = graph.transitions.length;
	await page.getByTestId('layer-back').click();
	await page.waitForTimeout(400);
	const withBack = await edges();
	check(withBack > main, `«Возвраты» добавляют рёбра: ${main} → ${withBack}`, `«Возвраты» ничего не добавили (${withBack})`);
	await page.getByTestId('layer-exit').click();
	await page.waitForTimeout(400);
	const all = await edges();
	check(all === total, `«Отказ и заморозка» доводят до всех ${total}`, `рёбер ${all}, ожидалось ${total}`);
	await page.screenshot({ path: '.shots/f/workflow-14-all.png' });
	await page.getByTestId('layer-all').click(); // все слои были включены — возвращает слои по умолчанию
	await page.waitForTimeout(400);
	await page.locator('.svelte-flow__node .t-body-m-strong', { hasText: /^Отказ$/ }).click();
	await page.waitForTimeout(500);
	const lostShown = await edges();
	const incoming = graph.transitions.filter((t) => t.to_status_id === graph.statuses.find((s) => s.type === 'lost').id).length;
	check(lostShown === main + incoming, `клик по узлу «Отказ» показывает ${incoming} входящих рёбер (${lostShown})`, `после клика по «Отказ» рёбер ${lostShown}, ожидалось ${main + incoming}`);
	await page.screenshot({ path: '.shots/f/workflow-14-default.png' });

	// --- карточка сделки с пропуском шага 5
	const card = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
	await card.goto(`${BASE}/deals/${skipped.deal.id}`);
	await card.waitForSelector('[aria-label="Этапы воронки"]');
	await card.waitForTimeout(800);
	const caption = await card.locator('[aria-label="Этапы воронки"]').innerText();
	check(/пропущен: 5/.test(caption), 'в ленте «Шаг 6 из 14, пропущен: 5»', `подпись ленты: ${caption.split('\n')[0]}`);
	const skippedStep = await card.locator('[aria-label="Этапы воронки"] li', { hasText: skipStep.name.slice(0, 20) }).first().innerHTML();
	check(/пропущен/.test(skippedStep), 'у шага 5 в разметке «пропущен» (title и текст для читалки)', 'у шага 5 нет «пропущен»');
	await card.screenshot({ path: '.shots/f/workflow-14-deal-skip.png' });

	// --- замороженная
	await card.goto(`${BASE}/deals/${frozen.deal.id}`);
	await card.getByTestId('deal-primary-transition').waitFor();
	const label = await card.getByTestId('deal-primary-transition').innerText();
	check(/^Возобновить: 3\./.test(label.trim()), `у замороженной главная кнопка «${label.trim().slice(0, 40)}…»`, `кнопка: ${label.trim()}`);
	await card.getByTestId('deal-more').click();
	await card.waitForTimeout(300);
	const menu = await card.locator('[role=menu], .atmr-dropdown-menu').first().innerText().catch(() => '');
	check(!/Назад:/.test(menu), 'в меню «Ещё» нет строк «Назад»', 'в меню есть «Назад»');

	// --- телефон: нет горизонтальной прокрутки
	for (const [url, name] of [[`/deals/${skipped.deal.id}`, 'карточка сделки'], [`/workflows/${wf.id}`, 'редактор воронки']]) {
		const phone = await newPage(browser, { who: url.startsWith('/workflows') ? 'admin' : 'kam', width: 390, height: 844 });
		await phone.goto(`${BASE}${url}`);
		await phone.waitForTimeout(1800);
		const audit = await auditLayout(phone);
		check(!audit.hscroll && audit.offenders.length === 0, `390 px: ${name} без горизонтальной прокрутки`, `390 px: ${name} — прокрутка (${audit.offenders.join(', ')})`);
		await phone.screenshot({ path: `.shots/f/workflow-14-${name === 'редактор воронки' ? 'editor' : 'deal'}-phone.png` });
		const problems = phone.__problems.console.filter((m) => !/409|Conflict/.test(m));
		check(problems.length === 0, `390 px: ${name}: нет ошибок консоли`, `консоль: ${problems.join(' | ')}`);
	}
	for (const [p, name] of [[page, 'редактор'], [card, 'карточка']]) {
		const problems = p.__problems.console.filter((m) => !/409|Conflict/.test(m));
		check(problems.length === 0, `${name}: нет ошибок консоли`, `${name}: консоль ${problems.join(' | ')}`);
	}
} finally {
	await browser.close();
	for (const title of ['F4 сценарий: пропуск шага 5', 'F4 сценарий: заморозка']) await deleteDealsByTitle(title);
}
