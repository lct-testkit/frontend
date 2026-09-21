// Сохранение графа опубликованной воронки со сделками и историей (агент B): B2B (17 статусов, 55 переходов) — правка названия и возврат.
//   node tools/scenarios/b-workflow-published.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
async function api(path) {
	const token = await accessToken('admin');
	return (await (await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })).json());
}
const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) }).last();

const list = await api('/api/workflows?limit=50');
const wf = list.items.find((w) => w.code === 'b2b_university_v1');
const before = await api(`/api/workflows/${wf.id}`);
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const panel = page.locator('aside[aria-label="Свойства"]');
	await page.goto(`${BASE}/workflows/${wf.id}`);
	await page.waitForSelector('.svelte-flow__node');
	await page.waitForTimeout(800);
	const node = page.locator('.svelte-flow__node', { hasText: 'Идентификация вуза' }).first();
	await node.click();
	const nameInput = field(panel, 'Название').locator('input');
	await nameInput.fill('Идентификация вуза (тест)');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1800);
	const mid = await api(`/api/workflows/${wf.id}`);
	if (mid.statuses.some((s) => s.name === 'Идентификация вуза (тест)') && mid.transitions.length === before.transitions.length) ok(`сохранение опубликованной воронки: ${mid.transitions.length} переходов на месте, версия ${before.workflow.version} → ${mid.workflow.version}`);
	else fail('граф не сохранился или потерял переходы');
	// возвращаем название
	await page.locator('.svelte-flow__node', { hasText: 'Идентификация вуза (тест)' }).first().click();
	await field(panel, 'Название').locator('input').fill('Идентификация вуза');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1800);
	const end = await api(`/api/workflows/${wf.id}`);
	if (end.statuses.some((s) => s.name === 'Идентификация вуза') && end.transitions.length === before.transitions.length) ok('название возвращено, граф прежний');
	else fail('не удалось вернуть название');
	console.log(page.__problems.console.length ? `  ✗ console: ${page.__problems.console.join(' | ')}` : '  ✓ нет ошибок консоли');
} finally {
	await browser.close();
}
