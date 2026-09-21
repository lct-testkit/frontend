// Сквозной сценарий подписи внешним подписантом на живом бэкенде (агент C).
//   node tools/scenarios/c-sign.mjs [--size 360x640] [--flow sign|reject|wrong|internal] [--theme rtk_default_dark] [--out .shots/c]
// Каждый запуск создаёт НОВЫЙ документ (ссылка одноразовая): договор ЭДО → документ по сделке КАМа → отправка → страница /sign/<токен>.
import { mkdir } from 'node:fs/promises';
import { BASE, accessToken, newBrowser, newPage, auditLayout } from '../lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const [w, h] = opt('size', '390x844').split('x').map(Number);
const flow = opt('flow', 'sign');
const theme = opt('theme', 'rtk_default_light');
const out = opt('out', '.shots/c');
await mkdir(out, { recursive: true });

async function api(who, method, path, body, extra = {}) {
	const token = await accessToken(who);
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra },
		body: body === undefined ? undefined : JSON.stringify(body)
	});
	const text = await res.text();
	return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function freshDocument() {
	const deals = (await api('kam', 'GET', '/api/deals?limit=100')).data.items;
	const deal = deals.find((d) => d.contact_id && ['none', 'rejected', 'expired', 'void'].includes(d.signature_status)) ?? deals.find((d) => d.contact_id);
	await api('admin', 'POST', '/api/admin/edm-agreements', { party_type: 'contact', party_id: deal.contact_id, agreement_number: 'ЭДО-DEMO', conclusion_method: 'offer_acceptance' });
	const signers = flow === 'internal' ? [{ role: 'HEAD' }] : [{ contact_id: deal.contact_id }];
	const created = await api('kam', 'POST', '/api/signature-documents', { doc_type: 'kp', title: `КП по сделке ${deal.number}`, entity_type: 'deal', entity_id: deal.id, template_code: 'kp_approval', signers, signing_order: 'parallel' }, { 'Idempotency-Key': crypto.randomUUID() });
	if (created.status >= 300) throw new Error(`create: ${JSON.stringify(created.data)}`);
	const sent = await api('kam', 'POST', `/api/signature-documents/${created.data.id}/send`);
	if (sent.status >= 300) throw new Error(`send: ${JSON.stringify(sent.data)}`);
	const request = sent.data.requests[0];
	return { doc: sent.data, request, token: request.sign_url?.split('/').pop() };
}

const { doc, request, token } = await freshDocument();
console.log(`document ${doc.id}, request ${request.id}${token ? `, token ${token.slice(0, 6)}…` : ''}`);

const browser = await newBrowser();
const page = await newPage(browser, { who: flow === 'internal' ? 'head' : null, width: w, height: h, theme });
const shot = async (name) => {
	await page.waitForTimeout(500);
	await page.screenshot({ path: `${out}/sign-${flow}-${name}-${w}x${h}.png` });
	const audit = await auditLayout(page);
	if (audit.hscroll || audit.offenders.length) console.log(`  ✗ ${name}: hscroll=${audit.hscroll} ${audit.offenders.join('; ')}`);
};

await page.goto(BASE + (flow === 'internal' ? `/signing/requests/${request.id}` : `/sign/${token}`), { waitUntil: 'load' });
await page.waitForSelector('[data-testid=sign-flow]', { timeout: 20000 });
await page.waitForTimeout(1500);
await shot('1-ready');

if (flow === 'reject') {
	await page.getByRole('button', { name: 'Отклонить' }).first().click();
	await page.waitForTimeout(400);
	await shot('2-reject-modal');
	await page.locator('.atmr-modal textarea').first().fill('Не согласны со сроками'); // подпись поля у DS — не <label for>
	await page.getByTestId('reject-confirm').click();
	await page.waitForSelector('[data-outcome=rejected]');
	await shot('3-rejected');
} else {
	await page.getByTestId('sign-start').click();
	await page.waitForSelector('[data-testid=otp-panel]');
	await page.waitForSelector('[data-testid=demo-hint]', { timeout: 8000 }).catch(() => console.log('  ! no demo hint (debug_code absent)'));
	await shot('2-otp');
	if (flow === 'wrong') {
		for (let i = 0; i < 3; i += 1) {
			await page.getByTestId('otp-input').fill('000000');
			await page.waitForSelector('[data-testid=otp-error]');
			await shot(`3-wrong-${i + 1}`);
			await page.waitForTimeout(700);
		}
		await page.waitForSelector('[data-outcome]', { timeout: 8000 }).catch(() => {});
		await shot('4-after');
	} else {
		await page.getByRole('button', { name: 'Подставить' }).click();
		await page.waitForSelector('[data-outcome=signed]', { timeout: 15000 });
		await shot('3-signed');
	}
}
const p = page.__problems;
if (p.pageerrors.length || p.console.length || p.failed.length) console.log('problems:', JSON.stringify(p));
await browser.close();
