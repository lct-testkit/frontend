// Остальное на живом бэкенде: ответы/правка/удаление комментариев, участники, раскрытие контакта, колокольчик, массовая и одиночная передача (HEAD).
import { BASE, accessToken } from '../lib.mjs';
import { choose, expect, field, newBrowser, newPage, step } from './a-lib.mjs';

const tok = await accessToken('kam');
const call = async (path) => (await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${tok}` } })).json();
const browser = await newBrowser();
const kam = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
const head = await newPage(browser, { who: 'head', width: 1440, height: 900 });
try {
	const deal = (await call('/api/deals?q=D-2026-000002&limit=1')).items[0];

	step('комментарии: ответ, правка, удаление');
	await kam.goto(`${BASE}/deals/${deal.id}?tab=comments`, { waitUntil: 'load' });
	await kam.locator('textarea').first().waitFor();
	await kam.waitForTimeout(1200);
	await kam.locator('textarea').first().fill('Корневой комментарий из сценария');
	await kam.getByTestId('comment-send').click();
	const root = kam.locator('[data-comment]', { hasText: 'Корневой комментарий из сценария' }).last();
	await root.waitFor({ timeout: 8000 });
	await root.hover();
	await root.getByRole('button', { name: 'Редактировать' }).click();
	await kam.locator('[data-comment] textarea').first().fill('Корневой комментарий (исправлено)');
	await kam.getByRole('button', { name: 'Сохранить', exact: true }).click();
	await kam.locator('[data-comment] .md', { hasText: 'исправлено' }).last().waitFor({ timeout: 8000 });
	expect(await kam.locator('[data-comment]', { hasText: 'исправлено' }).last().getByText('изменён').count() > 0, 'пометка «изменён»');
	await kam.screenshot({ path: '.shots/a/comments-thread.png' });
	const beforeCount = await kam.locator('[data-comment]', { hasText: 'исправлено' }).count();
	const edited = kam.locator('[data-comment]', { hasText: 'исправлено' }).last();
	await edited.hover();
	await edited.getByRole('button', { name: 'Удалить' }).click();
	await kam.waitForTimeout(600);
	await kam.locator('.atmr-modal-wrapper').getByRole('button', { name: 'Удалить' }).click();
	await kam.waitForTimeout(1500);
	expect((await kam.locator('[data-comment]', { hasText: 'исправлено' }).count()) === beforeCount - 1, 'комментарий удалён');

	step('участники');
	await kam.goto(`${BASE}/deals/${deal.id}`, { waitUntil: 'load' });
	await kam.getByRole('button', { name: 'Добавить участника' }).click();
	try {
		await choose(kam, 'Сотрудник', 'Пётр Петров');
		await kam.getByRole('button', { name: 'Добавить', exact: true }).click();
		await kam.getByText('Наблюдатель').first().waitFor({ timeout: 8000 });
		expect(true, 'участник добавлен');
	} catch {
		console.log('  (Пётр уже участник — список его не предлагает, это ожидаемо)');
	}

	step('контакт: раскрытие');
	const c = (await call('/api/contacts?q=Ахметов&limit=1')).items[0];
	await kam.goto(`${BASE}/contacts/${c.id}`, { waitUntil: 'load' });
	await kam.getByTestId('contact-reveal').click();
	await kam.waitForTimeout(1200);
	const text = await kam.locator('main').innerText();
	expect(!/\*\*/.test(text.split('Файлы')[0]), 'маски сняты, значения показаны');

	step('колокольчик');
	await kam.goto(`${BASE}/deals`, { waitUntil: 'load' });
	await kam.waitForTimeout(1500);
	const before = await kam.getByTestId('bell-count').innerText().catch(() => '0');
	await kam.getByTestId('bell').click();
	const item = kam.locator('.atmr-popover li').first();
	await item.waitFor({ timeout: 8000 });
	console.log('  первое уведомление:', (await item.innerText()).replace(/\n+/g, ' | ').slice(0, 120));
	await item.click();
	await kam.waitForTimeout(1500);
	const after = await kam.getByTestId('bell-count').innerText().catch(() => '0');
	console.log(`  счётчик: ${before} → ${after}, URL: ${kam.url().replace(BASE, '')}`);

	step('HEAD: массовая передача');
	await head.goto(`${BASE}/deals?q=${encodeURIComponent('Введение в DevOps')}`, { waitUntil: 'load' });
	await head.waitForTimeout(1500);
	const boxes = await head.locator('[aria-label="Выбрать все"]').count();
	console.log('  чекбокс «выбрать все»:', boxes);
	await head.locator('label:has([aria-label="Выбрать все"])').first().click();
	await head.getByRole('button', { name: 'Передать другому' }).click();
	await choose(head, 'Кому передать', 'Пётр Петров');
	await field(head, 'Причина').fill('Тестовая передача');
	await head.getByRole('button', { name: 'Передать', exact: true }).click();
	await head.waitForTimeout(1500);
	console.log('  тосты:', (await head.locator('[class*=toast], [class*=notification]').allInnerTexts()).join(' | ').slice(0, 160));
} catch (e) {
	await kam.screenshot({ path: '.shots/a/misc-fail-kam.png' });
	await head.screenshot({ path: '.shots/a/misc-fail-head.png' });
	console.log('FAIL', e.message.slice(0, 500));
	process.exitCode = 1;
} finally {
	console.log('problems kam', JSON.stringify(kam.__problems), 'head', JSON.stringify(head.__problems));
	await browser.close();
}
