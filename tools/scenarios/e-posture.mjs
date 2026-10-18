// Состояние защиты (F9-6): вкладка «Состояние защиты» в «Событиях безопасности» показывает то, что отдаёт GET /api/admin/security/posture, без выдумок.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-posture.mjs      (SHOTS_DIR=… W=390 H=844 THEME=rtk_default_dark — кадры)
import { BASE, newBrowser, newPage } from '../lib.mjs';
import { apiAs } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const SHOTS = process.env.SHOTS_DIR;
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);

const admin = await apiAs('admin');
const posture = (await admin('/api/admin/security/posture')).body;

const browser = await newBrowser();
try {
	console.log('(a) вкладка и данные');
	const page = await newPage(browser, { who: 'admin', width: W, height: H, theme: process.env.THEME ?? 'rtk_default_light' });
	await page.goto(`${BASE}/admin/security`);
	await page.getByRole('tab', { name: 'Состояние защиты' }).or(page.getByText('Состояние защиты', { exact: true })).first().click();
	await page.getByTestId('posture-summary').waitFor({ timeout: 15000 });
	check(page.url().includes('view=posture'), 'вкладка «Состояние защиты» выбрана и записана в адрес');
	const cards = await page.locator('[data-testid^="posture-"][data-status]').count();
	check(cards === (posture.realm ? 9 : 6), `мер на экране: ${cards}`);
	const totpLabel = await page.getByTestId('posture-totp').innerText();
	const n = posture.admins_without_totp.length;
	check(n === 0 ? /У всех включён/.test(totpLabel) : totpLabel.includes(`Без второго фактора: ${n}`), `второй фактор: «${n === 0 ? 'у всех включён' : `без второго фактора: ${n}`}» совпадает с API`);
	check((await page.getByTestId('posture-encryption').getAttribute('data-status')) === (posture.field_encryption_enabled ? 'ok' : 'warn'), 'шифрование полей: статус по API');
	check((await page.getByTestId('posture-audit').getAttribute('data-status')) === (posture.audit_hmac_key_set ? 'ok' : 'warn'), 'ключ журнала аудита: статус по API');
	if (n > 0) check((await page.getByTestId('posture-totp').locator('a', { hasText: 'Открыть' }).count()) === n, 'у каждого администратора без аутентификатора есть «Открыть» в карточку');
	if (SHOTS) {
		await page.waitForTimeout(600);
		await page.screenshot({ path: `${SHOTS}/posture.png`, fullPage: true });
	}
	await page.getByText('События', { exact: true }).first().click();
	await page.getByText('Критичных за 24 часа').waitFor({ timeout: 10000 });
	check(!page.url().includes('view=posture'), 'вкладка «События» возвращает журнал');
	await page.close();

	console.log('(b) роли');
	const aud = await newPage(browser, { who: 'auditor', width: 1440, height: 900 });
	await aud.goto(`${BASE}/admin/security?view=posture`);
	await aud.getByTestId('posture-summary').waitFor({ timeout: 15000 });
	ok('аудитор видит панель');
	await aud.close();
	const kam = await newPage(browser, { who: 'kam', width: 1440, height: 900 });
	await kam.goto(`${BASE}/admin/security?view=posture`);
	await kam.getByText('Нет доступа').first().waitFor({ timeout: 8000 });
	ok('КАМ видит «Нет доступа»');
	await kam.close();
} finally {
	await browser.close();
}
