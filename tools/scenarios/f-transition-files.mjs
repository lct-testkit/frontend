// F3-5 / F3-6: файлы в диалоге перехода (шаг «Обмен пакетом документов» воронки из 14 шагов, условие step_attachments.contract).
//   1) «Перейти» неактивна, пока нет файла; PDF грузится прямо в диалоге, комментарий не теряется, «Перейти» активна;
//   2) отмена с подтверждением удаляет приложенное (в сделке не остаётся «сирот»);
//   3) переход с файлом: вложение привязано к записи истории (status_history_id), вкладка «История» показывает файл, «Скачать» открывает ссылку;
//   4) уход по подсказке («К подписанию») не стирает комментарий: вернувшись, он на месте.
//   APP_URL=http://localhost:5275 node tools/scenarios/f-transition-files.mjs [--shots dir]
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE } from '../lib.mjs';
import { expect, field, newBrowser, newPage, step } from './a-lib.mjs';
import { deleteDealsByTitle, walkDeal } from './f-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const pdf = join(here, '..', 'fixtures', 'contract.pdf');
const shots = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const T4 = 'F3-5 сценарий: шаг 4';
const T6 = 'F3-5 сценарий: шаг 6';

const browser = await newBrowser();
const page = await newPage(browser, { who: 'head', width: 1440, height: 900 });
const shot = (name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });
const next = () => page.locator('button', { hasText: /Далее:/ }).first();
const submit = () => page.getByTestId('transition-submit');
try {
	step('сделки для сценария (шаг 4 и шаг 6)');
	const { deal, j } = await walkDeal('head', 'Обмен необходимым', T4);
	const six = await walkDeal('head', 'Подписание документов', T6);
	const attachments = async () => (await j(`/api/attachments?entity_type=deal&entity_id=${deal.id}&limit=100`)).body.items;

	step('диалог перехода: без файла «Перейти» неактивна');
	await page.goto(`${BASE}/deals/${deal.id}`, { waitUntil: 'load' });
	await next().click();
	await submit().waitFor({ timeout: 10000 });
	expect(await submit().isDisabled(), '«Перейти» неактивна без файла');
	expect(!(await page.locator('body').innerText()).includes('сервер пока'), 'в чек-листе нет фразы «сервер пока не проверяет вложения»');
	const comment = field(page, 'Комментарий');
	await comment.fill('Договор согласован с проректором');
	await shot('1-no-file');

	step('PDF грузится в диалоге, комментарий на месте');
	await page.getByTestId('tr-files-contract-drop-input').setInputFiles(pdf);
	await page.getByTestId('tr-files-contract-list').waitFor({ timeout: 20000 });
	await page.waitForFunction(() => !document.querySelector('[data-testid=transition-submit]')?.disabled, null, { timeout: 5000 });
	expect(await comment.inputValue() === 'Договор согласован с проректором', 'комментарий не потерян');
	expect((await attachments()).length === 1, 'вложение создано в сделке');
	await shot('2-file-attached');

	step('отмена с подтверждением не оставляет файлов в сделке');
	await page.getByRole('button', { name: 'Отмена' }).click();
	await page.getByRole('button', { name: 'Закрыть', exact: true }).last().click();
	await submit().waitFor({ state: 'detached', timeout: 5000 });
	await page.waitForTimeout(1200);
	expect((await attachments()).length === 0, 'приложенный в диалоге файл удалён');

	step('переход с файлом');
	await next().click();
	await submit().waitFor();
	expect(await field(page, 'Комментарий').inputValue() === '', 'после подтверждённой отмены черновик стёрт');
	await page.getByTestId('tr-files-contract-drop-input').setInputFiles(pdf);
	await page.getByTestId('tr-files-contract-list').waitFor({ timeout: 20000 });
	await submit().click();
	await submit().waitFor({ state: 'detached', timeout: 10000 });
	const bound = (await attachments())[0];
	expect(!!bound?.status_history_id && !!bound?.status_id, `вложение привязано к записи истории (${bound?.status_history_id?.slice(0, 8)}), статус ${bound?.status_id?.slice(0, 8)}`);

	step('вкладка «История»: файл под записью статуса, без дубля в событиях, «Скачать» открывает ссылку');
	await page.goto(`${BASE}/deals/${deal.id}?tab=history`, { waitUntil: 'load' });
	const files = page.getByTestId('history-files');
	await files.waitFor({ timeout: 15000 });
	const text = (await files.innerText()).replace(/\s+/g, ' ');
	expect(text.includes('contract.pdf') && text.includes('Договор') && /590/.test(text), `под записью статуса: ${text}`);
	const eventsText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
	await shot('4-history-files');
	const added = (eventsText.match(/Добавлен файл/g) ?? []).length;
	expect(added === 1, `«Добавлен файл» в событиях: ${added} (только отменённый в диалоге файл; приложенный к переходу скрыт)`);
	await page.evaluate(() => {
		window.__opened = [];
		window.open = (url) => (window.__opened.push(String(url)), null);
	});
	await files.getByRole('button', { name: 'Скачать' }).first().click();
	await page.waitForFunction(() => window.__opened.length > 0, null, { timeout: 8000 });
	const opened = await page.evaluate(() => window.__opened[0]);
	expect(/^https?:\/\//.test(opened), `«Скачать» открывает ссылку: ${opened.slice(0, 60)}…`);
	await shot('4-history-files');

	step('уход по подсказке «К подписанию» сохраняет комментарий');
	await page.goto(`${BASE}/deals/${six.deal.id}`, { waitUntil: 'load' });
	await next().click();
	await submit().waitFor();
	await field(page, 'Комментарий').fill('Скан подписан у ректора');
	await page.getByRole('button', { name: 'К подписанию' }).first().click();
	await page.waitForURL(/tab=signing/, { timeout: 5000 });
	await next().click();
	await submit().waitFor();
	expect((await field(page, 'Комментарий').inputValue()) === 'Скан подписан у ректора', 'комментарий восстановлен из черновика');
	await shot('3-draft-restored');
	console.log('problems', JSON.stringify(page.__problems));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 600));
	if (shots) await page.screenshot({ path: join(shots, 'fail.png') });
	process.exitCode = 1;
} finally {
	await browser.close();
	for (const t of [T4, T6]) console.log('удалено сделок', t, await deleteDealsByTitle(t));
}
