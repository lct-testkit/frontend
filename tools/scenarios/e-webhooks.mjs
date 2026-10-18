// Исходящие webhook-подписки (F5-5): создание в интерфейсе с показом секрета один раз, тестовое событие PING с проверкой подписи на стороне приёмника,
// настоящая доставка при создании сделки, сбой приёмника → «Ошибка», «Повторить доставку» → «Отправлено», смена секрета, удаление.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-webhooks.mjs
// Бэкенд стенда в Docker: приёмник на хосте доступен ему по имени host.docker.internal (WEBHOOK_HOST — другое имя; WEBHOOK_BIND — адрес прослушивания).
import http from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { BASE, newBrowser, newPage } from '../lib.mjs';
import { apiAs, deleteDealsByTitle } from './f-lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const field = (page, label) => page.locator('.atmr-input', { has: page.locator(`.atmr-input__label :text-is("${label}")`) }).last();

const suffix = Date.now().toString(36);
const NAME = `E2E F9 подписка ${suffix}`;
const DEAL = `E2E F9 сделка вебхука ${suffix}`;

// приёмник: пишет принятые запросы, отвечает кодом из `mode.status`
const received = [];
const mode = { status: 200 };
const server = http.createServer((req, res) => {
	const chunks = [];
	req.on('data', (c) => chunks.push(c));
	req.on('end', () => {
		received.push({ headers: req.headers, body: Buffer.concat(chunks) });
		res.writeHead(mode.status);
		res.end('ok');
	});
});
await new Promise((resolve) => server.listen(0, process.env.WEBHOOK_BIND ?? '0.0.0.0', resolve));
const url = `http://${process.env.WEBHOOK_HOST ?? 'host.docker.internal'}:${server.address().port}/hook`;

/** Подпись как в панели «Как принять»: HMAC-SHA256 строки «метка.тело». */
function signatureValid(secret, req) {
	const expected = 'sha256=' + createHmac('sha256', secret).update(req.headers['x-timestamp'] + '.').update(req.body).digest('hex');
	const a = Buffer.from(expected);
	const b = Buffer.from(String(req.headers['x-signature']));
	return a.length === b.length && timingSafeEqual(a, b);
}

const admin = await apiAs('admin');
let subscriptionId = null;
const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await page.goto(`${BASE}/admin/integrations?tab=subscriptions`);
	await page.getByTestId('sub-create').waitFor({ timeout: 10000 });

	console.log('(a) создание, секрет один раз');
	await page.getByTestId('sub-create').click();
	await field(page, 'Название').locator('input').fill(NAME);
	await field(page, 'Адрес').locator('input').fill(url);
	await page.getByText('Сделка создана').click();
	await page.getByRole('button', { name: 'Создать' }).click();
	await page.getByText('Сохраните сейчас, потом он будет недоступен').waitFor({ timeout: 8000 });
	const secret = await page.locator('input[readonly]').last().inputValue();
	check(/^whsec_/.test(secret), 'секрет показан в окне после создания');
	await page.getByTestId('secret-done').click();
	await page.getByText(NAME).first().waitFor();
	const list = (await admin('/api/admin/integrations/webhooks')).body;
	const created = list.find((s) => s.name === NAME);
	subscriptionId = created?.id ?? null;
	check(!!created && !('secret' in created), 'подписка есть в списке, в ответах API секрета нет');

	console.log('(b) тестовое событие PING, подпись');
	await page.getByText(NAME).first().click();
	await page.getByTestId('sub-ping').click();
	await page.getByTestId('sub-ping-result').getByText('Получатель ответил 200').waitFor({ timeout: 10000 });
	ok('результат PING: «Получатель ответил 200»');
	const ping = received.find((r) => r.headers['x-crm-event'] === 'PING');
	check(!!ping && signatureValid(secret, ping), 'приёмник проверил подпись фрагментом из панели');
	check(!!ping && !signatureValid(secret, { headers: ping.headers, body: Buffer.concat([ping.body, Buffer.from(' ')]) }), 'изменённое тело подпись не проходит');
	await page.keyboard.press('Escape');

	console.log('(c) настоящая доставка при создании сделки');
	const org = (await admin('/api/organizations?limit=1')).body.items[0];
	const dealBody = { title: DEAL, deal_type: 'b2b', organization_id: org.id, amount: '100000', currency: 'RUB', priority: 'normal' };
	mode.status = 500;
	const before = received.length;
	const r1 = await admin('/api/deals', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(dealBody) });
	check(r1.status === 201, `сделка создана (${r1.status})`);
	// доставку разбирает фоновая задача раз в минуту (cron sweep_webhook_deliveries)
	for (let i = 0; i < 130 && received.length === before; i += 1) await sleep(1000);
	check(received.length > before, 'доставка дошла до приёмника (он отвечает 500)');
	await sleep(1500);
	let deliveries = (await admin(`/api/admin/integrations/webhooks/${subscriptionId}/deliveries`)).body;
	check(deliveries.some((d) => d.status === 'failed' && d.last_error === 'http_500'), 'в журнале статус «failed», причина http_500');

	console.log('(d) журнал и «Повторить доставку»');
	mode.status = 200;
	await page.goto(`${BASE}/admin/integrations?tab=subscriptions`);
	await page.getByText(NAME).first().click();
	await page.getByTestId('sub-deliveries').click();
	await page.getByText('Ошибка, будет повтор').first().waitFor({ timeout: 8000 });
	await page.getByText('Получатель ответил кодом 500').first().waitFor();
	ok('журнал: статус «Ошибка, будет повтор» и причина по-русски');
	await page.getByRole('button', { name: 'Повторить доставку' }).first().click();
	for (let i = 0; i < 90; i += 1) {
		deliveries = (await admin(`/api/admin/integrations/webhooks/${subscriptionId}/deliveries`)).body;
		if (deliveries.every((d) => d.status === 'sent')) break;
		await sleep(1500);
	}
	check(deliveries.length > 0 && deliveries.every((d) => d.status === 'sent'), 'после повтора доставка в статусе «sent»');
	const real = received.filter((r) => r.headers['x-crm-event'] === 'DEAL_CREATED').at(-1);
	check(!!real && signatureValid(secret, real), 'подпись настоящего события сходится');
	await page.keyboard.press('Escape');
	await page.keyboard.press('Escape');

	console.log('(e) смена секрета');
	await page.goto(`${BASE}/admin/integrations?tab=subscriptions`);
	await page.getByText(NAME).first().click();
	await page.getByTestId('sub-rotate').click();
	await page.getByRole('button', { name: 'Сменить', exact: true }).click();
	await page.getByText('Сохраните сейчас, потом он будет недоступен').waitFor({ timeout: 8000 });
	const secret2 = await page.locator('input[readonly]').last().inputValue();
	check(/^whsec_/.test(secret2) && secret2 !== secret, 'новый секрет показан один раз и отличается от прежнего');
	await page.getByTestId('secret-done').click();
	await page.getByText(NAME).first().click();
	received.length = 0;
	await page.getByTestId('sub-ping').click();
	await page.getByTestId('sub-ping-result').waitFor({ timeout: 10000 });
	const ping2 = received.at(-1);
	check(!!ping2 && signatureValid(secret2, ping2) && !signatureValid(secret, ping2), 'новый секрет подписывает, прежний — нет');

	console.log('(f) удаление');
	await page.getByTestId('sub-delete').click();
	// кнопка подтверждения стоит в DOM раньше кнопки панели
	await page.getByRole('button', { name: 'Удалить' }).first().click();
	await page.getByText('Подписка удалена').waitFor({ timeout: 8000 });
	const after = (await admin('/api/admin/integrations/webhooks')).body;
	check(!after.some((s) => s.id === subscriptionId), 'подписка удалена');
	subscriptionId = null;
	await page.close();
} finally {
	if (subscriptionId) await admin(`/api/admin/integrations/webhooks/${subscriptionId}`, { method: 'DELETE' });
	await deleteDealsByTitle(DEAL).catch(() => {});
	await browser.close();
	server.close();
}
