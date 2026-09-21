// Блок «Подписание» в карточке сделки: мастер отправки на подпись (сквозной, на живом бэкенде).
//   node tools/scenarios/c-deal-signing.mjs [--size 390x844] [--who kam] [--path /deals] [--theme rtk_default_dark]
import { mkdir } from 'node:fs/promises';
import { BASE, accessToken, newBrowser, newPage, auditLayout } from '../lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const [w, h] = opt('size', '1440x900').split('x').map(Number);
const who = opt('who', 'kam');
const theme = opt('theme', 'rtk_default_light');
const base = opt('path', '/deals');
const out = opt('out', '.shots/c');
await mkdir(out, { recursive: true });

const token = await accessToken('kam');
const deals = (await (await fetch(`${BASE}/api/deals?limit=100`, { headers: { Authorization: `Bearer ${token}` } })).json()).items;
const deal = deals.find((d) => d.contact_id && d.signature_status === 'none') ?? deals[0];
console.log('deal', deal.number, deal.id, deal.signature_status);

const browser = await newBrowser();
const page = await newPage(browser, { who, width: w, height: h, theme });
const shot = async (name) => {
	await page.waitForTimeout(600);
	await page.screenshot({ path: `${out}/deal-${name}-${w}x${h}.png` });
	const a = await auditLayout(page);
	if (a.hscroll || a.offenders.length) console.log(`  ✗ ${name}: hscroll=${a.hscroll} ${a.offenders.join('; ')}`);
};
await page.goto(`${BASE}${base}/${deal.id}?tab=signing`, { waitUntil: 'load' }); // «Подписание» — вкладка карточки сделки
await page.waitForSelector('[data-testid=deal-signatures]');
await page.waitForTimeout(1200);
await shot('1-block');
await page.getByTestId('open-send-wizard').click();
await page.waitForSelector('[data-testid=wizard-next]');
await page.waitForTimeout(900);
await shot('2-wizard-1');
await page.getByTestId('wizard-next').click();
await page.waitForTimeout(700);
await shot('3-wizard-2');
if (deal.contact_id) {
	await page.locator('label', { hasText: 'Контакт сделки' }).first().click();
	await page.getByRole('button', { name: 'Одновременно' }).click();
}
await page.waitForTimeout(400);
await shot('4-wizard-2-filled');
await page.getByTestId('wizard-submit').click();
await page.waitForTimeout(3500);
await shot('5-after-send');
// договор ЭДО оформляет администратор → «Отправить повторно» выдаёт ссылку внешнему подписанту
if (deal.contact_id && (await page.getByTestId('doc-send').first().isVisible().catch(() => false))) {
	const adminToken = await accessToken('admin');
	await fetch(`${BASE}/api/admin/edm-agreements`, { method: 'POST', headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ party_type: 'contact', party_id: deal.contact_id, agreement_number: 'ЭДО-DEMO', conclusion_method: 'offer_acceptance' }) });
	await page.getByTestId('doc-send').first().click();
	await page.waitForTimeout(2500);
	await shot('6-after-resend');
}
const p = page.__problems;
if (p.pageerrors.length || p.console.length || p.failed.length) console.log('problems:', JSON.stringify(p));
await browser.close();
