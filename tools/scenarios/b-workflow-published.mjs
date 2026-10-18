// Сохранение графа опубликованной воронки со сделками и историей (агент B): воронка B2B по умолчанию (14 шагов, 3 завершающих статуса,
// число переходов читается из графа) — правка названия первого шага и возврат.
//   node tools/scenarios/b-workflow-published.mjs
import { BASE, accessToken, findB2bWorkflow, newBrowser, newPage } from '../lib.mjs';

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

const wf = await findB2bWorkflow(api);
const before = await api(`/api/workflows/${wf.id}`);
// первый шаг воронки: его название читаем из графа, а не из кода или текста (набор воронок меняется между версиями)
const first = before.statuses.filter((s) => s.type === 'initial' && !s.is_archived)[0].name;
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const panel = page.locator('aside[aria-label="Свойства"]');
	await page.goto(`${BASE}/workflows/${wf.id}`);
	await page.waitForSelector('.svelte-flow__node');
	await page.waitForTimeout(800);
	const node = page.locator('.svelte-flow__node', { hasText: first }).first();
	await node.click();
	const nameInput = field(panel, 'Название').locator('input');
	await nameInput.fill(`${first} (тест)`);
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1800);
	const mid = await api(`/api/workflows/${wf.id}`);
	if (mid.statuses.some((s) => s.name === `${first} (тест)`) && mid.transitions.length === before.transitions.length) ok(`сохранение опубликованной воронки: ${mid.transitions.length} переходов на месте, версия ${before.workflow.version} → ${mid.workflow.version}`);
	else fail('граф не сохранился или потерял переходы');
	// возвращаем название
	await page.locator('.svelte-flow__node', { hasText: `${first} (тест)` }).first().click();
	await field(panel, 'Название').locator('input').fill(first);
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1800);
	const end = await api(`/api/workflows/${wf.id}`);
	if (end.statuses.some((s) => s.name === first) && end.transitions.length === before.transitions.length) ok('название возвращено, граф прежний');
	else fail('не удалось вернуть название');

	// Руководитель: пункт «Воронки» в меню, поле «Название» шага активно, остальные выключены; сохранение одной ручкой и возврат имени
	const firstId = before.statuses.find((s) => s.type === 'initial' && !s.is_archived).id;
	const headPage = await newPage(browser, { who: 'head', width: 1440, height: 900 });
	await headPage.goto(`${BASE}/workflows/${wf.id}?status=${firstId}`);
	await headPage.waitForSelector('.svelte-flow__node');
	const headPanel = headPage.locator('aside[aria-label="Свойства"]');
	await headPanel.getByTestId('status-rename-save').waitFor();
	(await headPage.locator('[class*=side-menu]').getByText('Воронки', { exact: true }).count()) > 0 ? ok('Руководитель: пункт «Воронки» в меню') : fail('нет пункта «Воронки» у Руководителя');
	(await field(headPanel, 'Название').locator('input').isEnabled()) ? ok('поле «Название» активно') : fail('поле «Название» выключено');
	(await field(headPanel, 'Код').locator('input').isEditable()) ? fail('поле «Код» доступно') : ok('остальные поля выключены (код только для чтения)');
	await field(headPanel, 'Название').locator('input').fill(`${first} (тест HEAD)`);
	await headPanel.getByTestId('status-rename-save').click();
	await headPage.locator('.atmr-modal-wrapper').getByRole('button', { name: 'Сохранить', exact: true }).click();
	await headPage.waitForTimeout(1800);
	const renamed = await api(`/api/workflows/${wf.id}`);
	renamed.statuses.some((s) => s.name === `${first} (тест HEAD)`) && renamed.transitions.length === before.transitions.length ? ok(`переименование Руководителем: имя сменилось, ${renamed.transitions.length} переходов на месте, версия ${end.workflow.version} → ${renamed.workflow.version}`) : fail('имя не сменилось');
	await field(headPanel, 'Название').locator('input').fill(first);
	await headPanel.getByTestId('status-rename-save').click();
	await headPage.locator('.atmr-modal-wrapper').getByRole('button', { name: 'Сохранить', exact: true }).click();
	await headPage.waitForTimeout(1800);
	(await api(`/api/workflows/${wf.id}`)).statuses.some((s) => s.name === first) ? ok('название возвращено') : fail('не удалось вернуть название Руководителя');
	// Менеджер: пункта нет, по прямой ссылке — граф без правки
	const kamPage = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
	await kamPage.goto(`${BASE}/workflows/${wf.id}?status=${firstId}`);
	await kamPage.waitForSelector('.svelte-flow__node');
	(await kamPage.locator('[class*=side-menu]').getByText('Воронки', { exact: true }).count()) === 0 ? ok('Менеджер: пункта «Воронки» нет') : fail('у Менеджера есть пункт «Воронки»');
	(await kamPage.getByTestId('status-rename-save').count()) === 0 ? ok('Менеджер: кнопки переименования нет, граф только для чтения') : fail('у Менеджера есть кнопка переименования');
	console.log(page.__problems.console.length ? `  ✗ console: ${page.__problems.console.join(' | ')}` : '  ✓ нет ошибок консоли');
} finally {
	await browser.close();
}
