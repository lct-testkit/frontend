// F3-4: единый загрузчик на вкладке «Файлы» сделки.
//   exe отклоняется на клиенте (нет upload-intent), файл 51 МБ — «Файл больше 50 МБ», pdf и json грузятся,
//   при обрыве на commit «Повторить» вызывает только commit (второго upload-intent нет).
//   APP_URL=http://localhost:5275 node tools/scenarios/f-files-upload.mjs [--shots dir]
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, truncateSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { BASE, accessToken } from '../lib.mjs';
import { expect, newBrowser, newPage, step } from './a-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => join(here, '..', 'fixtures', n);
const shotsDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;

const tok = await accessToken('kam');
const deals = await (await fetch(`${BASE}/api/deals?limit=1&is_closed=false`, { headers: { Authorization: `Bearer ${tok}` } })).json();
const deal = deals.items[0];
const browser = await newBrowser();
const page = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
const calls = { intent: 0, commit: 0 };
page.on('request', (r) => {
	if (r.method() !== 'POST') return;
	if (r.url().includes('/api/files/upload-intent')) calls.intent += 1;
	if (/\/api\/files\/[^/]+\/commit/.test(r.url())) calls.commit += 1;
});
try {
	await page.goto(`${BASE}/deals/${deal.id}?tab=files`, { waitUntil: 'load' });
	const input = page.getByTestId('attach-input');
	await input.waitFor({ state: 'attached', timeout: 15000 });

	step('exe отклоняется на клиенте');
	await input.setInputFiles(fixture('virus.exe'));
	await page.getByText('Тип «.exe» не поддерживается').first().waitFor({ timeout: 5000 });
	expect(calls.intent === 0, 'запроса upload-intent не было');
	if (shotsDir) await page.screenshot({ path: join(shotsDir, 'exe-rejected.png') });

	step('файл больше 50 МБ');
	const tmp = mkdtempSync(join(tmpdir(), 'f-files-'));
	const big = join(tmp, 'big.pdf');
	writeFileSync(big, '');
	truncateSync(big, 50 * 1024 * 1024 + 1); // разреженный файл: места на диске почти не занимает
	await input.setInputFiles(big);
	await page.getByText('Файл больше 50 МБ').first().waitFor({ timeout: 8000 });
	expect(calls.intent === 0, 'и для большого файла upload-intent не вызывался');
	rmSync(tmp, { recursive: true, force: true });

	// убираем отклонённые строки, чтобы дальше список очереди отражал только текущую загрузку
	for (let n = await page.getByRole('button', { name: 'Убрать из списка' }).count(); n > 0; n -= 1) await page.getByRole('button', { name: 'Убрать из списка' }).first().click();

	step('json и pdf проходят');
	await input.setInputFiles(fixture('data.json'));
	await page.getByTestId('attach-rows').waitFor({ state: 'detached', timeout: 20000 }); // очередь пройдена и очищена
	await page.getByText('Файл загружен').first().waitFor({ timeout: 5000 });
	expect(calls.intent === 1, 'json ушёл через upload-intent');

	step('сбой commit → «Повторить» вызывает только commit');
	let blocked = false;
	await page.route(/\/api\/files\/[^/]+\/commit/, (route) => {
		if (!blocked) {
			blocked = true;
			return route.abort('failed');
		}
		return route.continue();
	});
	const intentBefore = calls.intent;
	await input.setInputFiles(fixture('contract.pdf'));
	await page.getByRole('button', { name: 'Повторить' }).first().waitFor({ timeout: 15000 });
	if (shotsDir) await page.screenshot({ path: join(shotsDir, 'commit-failed.png') });
	const commitBefore = calls.commit;
	await page.getByRole('button', { name: 'Повторить' }).first().click();
	await page.getByTestId('attach-rows').waitFor({ state: 'detached', timeout: 20000 });
	await page.waitForTimeout(500);
	expect(calls.intent === intentBefore + 1, 'upload-intent за весь цикл вызван один раз');
	expect(calls.commit === commitBefore + 1, 'после «Повторить» ушёл ровно один commit');
	console.log('problems', JSON.stringify(page.__problems));
} catch (e) {
	console.log('FAIL', e.message.slice(0, 500));
	if (shotsDir) await page.screenshot({ path: join(shotsDir, 'fail.png') });
	process.exitCode = 1;
} finally {
	await browser.close();
}
