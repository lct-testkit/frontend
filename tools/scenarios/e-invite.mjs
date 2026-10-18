// Страница приглашения (F5-7): администратор заводит сотрудника «E2E F9 Инвайт …», по ссылке сотрудник задаёт пароль (в чистом контексте браузера),
// затем password grant в Keycloak и GET /api/me отвечают 200; повторное открытие ссылки — «Ссылка недействительна».
//   APP_URL=http://localhost:5274 node tools/scenarios/e-invite.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

const suffix = Date.now().toString(36);
const email = `e2e.f9.${suffix}@example.com`;
const PASSWORD = `Vesna-Zasnula-${suffix.slice(-4)}7`;

const admin = await accessToken('admin');
const created = await fetch(`${BASE}/api/admin/users`, {
	method: 'POST',
	headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
	body: JSON.stringify({ email, full_name: `E2E F9 Инвайт ${suffix}`, role: 'AUDITOR' })
});
const body = await created.json();
check(created.status === 201 && !!body.invite_url, `сотрудник заведён, ссылка выдана (${created.status})`);
const path = new URL(body.invite_url).pathname;

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: null, width: 390, height: 844 });
	await page.goto(`${BASE}${path}`);
	await page.getByText('Задайте пароль').first().waitFor({ timeout: 8000 });
	ok('форма «Задайте пароль» открыта');
	const submit = page.getByTestId('invite-submit');
	check(await submit.isDisabled(), 'кнопка выключена, пока пароль не проходит требования');

	await page.locator('input[name="new-password"]').fill('Short1');
	await page.locator('input[name="new-password-repeat"]').fill('Short1');
	check(await submit.isDisabled(), 'короткий пароль не отправляется');

	// отказ сервера (политика Keycloak приходит по-английски): один раз подменяем ответ — причина по-русски под полем, форма остаётся, ссылка не потрачена
	await page.route('**/password', (route) => route.fulfill({ status: 422, contentType: 'application/problem+json', body: JSON.stringify({ title: 'Ошибка валидации запроса', status: 422, code: 'CRM-1001', detail: 'Invalid password: must contain at least 1 upper case characters.', errors: [{ field: 'new_password', reason: 'не соответствует политике' }] }) }), { times: 1 });
	await page.locator('input[name="new-password"]').fill(PASSWORD);
	await page.locator('input[name="new-password-repeat"]').fill(PASSWORD);
	await submit.click();
	await page.getByText('Нужна хотя бы одна заглавная буква').waitFor({ timeout: 8000 });
	ok('422 сервера: причина по-русски под полем, форма осталась');

	await page.locator('input[name="new-password"]').fill(PASSWORD);
	await page.locator('input[name="new-password-repeat"]').fill(PASSWORD);
	await submit.click();
	await page.getByTestId('invite-done').waitFor({ timeout: 8000 });
	ok('«Пароль задан. Теперь войдите» показано');
	check((await page.locator('input[type=password]').count()) === 0, 'поля пароля очищены и убраны');

	await page.goto(`${BASE}${path}`);
	await page.getByText('Ссылка недействительна').waitFor({ timeout: 8000 });
	ok('повторное открытие ссылки: «Ссылка недействительна»');

	const config = await (await fetch(`${BASE}/config.json`)).json();
	const kc = config.keycloak;
	const grant = await fetch(`${BASE}${kc.path}/realms/${kc.realm}/protocol/openid-connect/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'password', client_id: kc.clientId, client_secret: kc.clientSecret ?? '', scope: 'openid', username: email, password: PASSWORD })
	});
	check(grant.status === 200, `password grant в Keycloak: ${grant.status}`);
	if (grant.ok) {
		const token = (await grant.json()).access_token;
		const me = await fetch(`${BASE}/api/me`, { headers: { Authorization: `Bearer ${token}` } });
		check(me.status === 200, `GET /api/me под новым пользователем: ${me.status}`);
	}
	await page.close();
} finally {
	await browser.close();
}
