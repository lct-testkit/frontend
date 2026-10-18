// «Четыре глаза» (F5-12): назначение администратора через заявку. Нужны два администратора (admin.crm и admin.volkov).
// Заводится одноразовый сотрудник `E2E F5 …`; в конце роль возвращается в KAM и сотрудник блокируется (удалить пользователя нельзя).
//   APP_URL=http://localhost:5274 node tools/scenarios/e-approvals.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const api = async (who, method, path, body, headers = {}) => {
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${await accessToken(who)}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
};

const stamp = Date.now().toString(36);
const created = await api('admin', 'POST', '/api/admin/users', { full_name: `E2E F5 ${stamp}`, email: `e2e-f5-${stamp}@example.com`, role: 'KAM' }, { 'Idempotency-Key': `e2e-f5-${stamp}` });
if (created.status >= 300) {
	console.log('не удалось завести сотрудника', created.status, JSON.stringify(created.json));
	process.exit(1);
}
const userId = created.json.user?.id ?? created.json.id;
const browser = await newBrowser();
try {
	await (await newPage(browser, { who: 'admin2', width: 1440, height: 900 })).close(); // вход второго администратора принимает политику ПДн, без этого его API-вызовы дают 403
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });

	console.log('(a) смена роли на «Администратор»: окно ожидания, а не красная ошибка');
	await page.goto(`${BASE}/admin/users/${userId}`);
	await page.getByRole('button', { name: /Изменить/ }).first().click();
	const drawer = page.locator('.atmr-drawer');
	await drawer.getByText('Изменить данные').waitFor();
	await drawer.locator('.atmr-input', { has: page.locator('.atmr-input__label :text-is("Роль")') }).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: 'Администратор' }).first().click();
	check(await drawer.getByText('нужно подтверждение второго администратора', { exact: false }).count() > 0, 'у поля роли подсказка про второго администратора');
	await drawer.getByTestId('user-save').click();
	const confirmDialog = page.locator('[role="dialog"], .atmr-modal').filter({ hasText: 'Сменить роль' });
	await confirmDialog.waitFor();
	check((await confirmDialog.innerText()).includes('Нужно подтверждение второго администратора'), 'текст подтверждения предупреждает о втором администраторе');
	await confirmDialog.getByRole('button', { name: 'Сменить' }).click();
	await page.getByText('Нужно второе подтверждение').waitFor({ timeout: 8000 });
	check((await page.locator('body').innerText()).includes('Назначение администратора'), 'окно «Нужно второе подтверждение» называет операцию');
	await page.locator('button').filter({ hasText: 'Закрыть' }).last().click();

	console.log('(b) «Согласования»: название, срок, «Отозвать», пояснение');
	await page.goto(`${BASE}/admin/approvals`);
	await page.getByText('действует ещё').first().waitFor({ timeout: 8000 });
	const body = await page.locator('body').innerText();
	check(body.includes('действует ещё'), 'под чипом «действует ещё N ч»');
	check(body.includes('Заявка действует 24 часа'), 'сверху пояснение про подтверждение вторым администратором');
	check((await page.getByRole('button', { name: 'Отозвать' }).count()) > 0, 'у своей ожидающей заявки «Отозвать», а не «Отклонить»');
	await page.screenshot({ path: process.env.SHOT_DIR ? `${process.env.SHOT_DIR}/approvals-desktop.png` : undefined });

	console.log('(c) второй администратор подтверждает, инициатор нажимает «Выполнить»');
	const list = (await api('admin2', 'GET', '/api/admin/approvals?status=pending&limit=50')).json.items;
	const mine = list.find((a) => a.operation === 'user.promote_admin' && a.payload?.user_id === userId);
	check(Boolean(mine), 'заявка user.promote_admin видна второму администратору');
	const ap = await api('admin2', 'POST', `/api/admin/approvals/${mine.id}/approve`);
	check(ap.status === 200, `подтверждение вторым администратором (${ap.status})`);
	await page.goto(`${BASE}/admin/approvals?status=approved`);
	await page.getByRole('button', { name: 'Выполнить' }).first().click();
	await page.waitForURL(new RegExp(`/admin/users/${userId}\\?approval_id=`));
	await drawer.getByText('Подтверждение второго администратора получено').waitFor({ timeout: 8000 });
	ok('«Выполнить» открывает карточку с предзаполненной ролью и пометкой о подтверждении');
	await drawer.getByTestId('user-save').click();
	const c2 = page.locator('[role="dialog"], .atmr-modal').filter({ hasText: 'Сменить роль' });
	await c2.waitFor();
	await c2.getByRole('button', { name: 'Сменить' }).click();
	await page.waitForSelector('text=Сохранено', { timeout: 8000 });
	const now = (await api('admin', 'GET', `/api/admin/users/${userId}`)).json;
	check(now.role === 'ADMIN', `роль после «Выполнить»: ${now.role}`);
	const done = (await api('admin', 'GET', '/api/admin/approvals?status=consumed&limit=50')).json.items.find((a) => a.id === mine.id);
	check(done?.status === 'consumed', `заявка переходит в «Выполнена» (${done?.status})`);
} finally {
	for (const a of (await api('admin', 'GET', '/api/admin/approvals?status=pending&limit=50')).json?.items ?? []) {
		if (a.operation === 'user.promote_admin' && a.payload?.user_id === userId) await api('admin', 'POST', `/api/admin/approvals/${a.id}/reject`, { reason: 'Проверка F5-12 завершена' });
	}
	const u = (await api('admin', 'GET', `/api/admin/users/${userId}`)).json;
	if (u?.role === 'ADMIN') await api('admin', 'PATCH', `/api/admin/users/${userId}`, { role: 'KAM' }, { 'If-Match': `"${u.version}"` });
	await api('admin', 'POST', `/api/admin/users/${userId}/block`, { reason: 'Проверка F5-12 завершена' });
	await browser.close();
}
