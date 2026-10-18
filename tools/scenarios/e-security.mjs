// События безопасности (F5-6): доступ по ролям, журнал, фильтры в адресе, подробности, выгрузка NDJSON и запись MASS_EXPORT.
//   APP_URL=http://localhost:5274 node tools/scenarios/e-security.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));
const api = async (who, path) => {
	const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${await accessToken(who)}` } });
	return { status: res.status, json: await res.json().catch(() => null) };
};

const browser = await newBrowser();
try {
	console.log('(a) доступ');
	for (const who of ['kam', 'head']) {
		const page = await newPage(browser, { who, width: 1440, height: 900 });
		await page.goto(`${BASE}/admin/security`);
		await page.getByText('Нет доступа').first().waitFor({ timeout: 8000 });
		check((await page.locator('[data-nav="security"]').count()) === 0, `${who}: пункта меню нет, по адресу «Нет доступа»`);
		await page.close();
	}
	for (const who of ['admin', 'auditor']) {
		const page = await newPage(browser, { who, width: 1440, height: 900 });
		await page.goto(`${BASE}/admin/security`);
		await page.getByText('Критичных за 24 часа').waitFor({ timeout: 8000 });
		check((await page.locator('[data-nav="security"]').count()) > 0, `${who}: пункт меню виден, страница открыта`);
		await page.close();
	}

	console.log('(b) журнал, фильтры в адресе, подробности');
	const admin = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	await admin.goto(`${BASE}/admin/security`);
	await admin.getByText('Массовая выгрузка').first().waitFor({ timeout: 8000 });
	ok('в журнале есть строки с подписями по-русски');
	await admin.goto(`${BASE}/admin/security?type=MASS_EXPORT&severity=warning`);
	await admin.getByText('Массовая выгрузка').first().waitFor();
	await admin.reload();
	await admin.getByText('Массовая выгрузка').first().waitFor();
	check(admin.url().includes('type=MASS_EXPORT') && admin.url().includes('severity=warning'), 'фильтры в адресе переживают перезагрузку');
	await admin.goto(`${BASE}/admin/security?type=BRUTE_FORCE_LOCK`);
	await admin.getByText('Событий по этим условиям нет').waitFor({ timeout: 8000 });
	ok('пусто при фильтре без событий: «Событий по этим условиям нет»');
	await admin.goto(`${BASE}/admin/security`);
	await admin.getByText('Массовая выгрузка').first().click();
	await admin.locator('.atmr-drawer').getByText('Устройство').waitFor();
	check(await admin.locator('.atmr-drawer a[href="/admin/audit?action=AUDIT_EXPORTED"]').isVisible(), 'подробности: ссылка «Журнал аудита» у массовой выгрузки');
	await admin.keyboard.press('Escape');

	console.log('(c) выгрузка NDJSON: подтверждение называет фильтры, пишется ещё одна запись MASS_EXPORT');
	const before = (await api('admin', '/api/admin/security-events/summary?hours=1')).json.by_type.filter((t) => t.event_type === 'MASS_EXPORT').reduce((n, t) => n + t.count, 0);
	await admin.goto(`${BASE}/admin/security?severity=warning`);
	await admin.getByText('Массовая выгрузка').first().waitFor();
	await admin.getByTestId('security-export').click();
	const dialog = admin.locator('[role="dialog"], .atmr-modal').filter({ hasText: 'Выгрузить события безопасности' });
	await dialog.waitFor();
	check((await dialog.innerText()).includes('не ниже «Предупреждение»'), 'в подтверждении названа серьёзность');
	const download = admin.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Выгрузить' }).click();
	const file = await download;
	check(/^security-events-\d{4}-\d\d-\d\d\.ndjson$/.test(file.suggestedFilename()), `файл ${file.suggestedFilename()}`);
	await admin.waitForTimeout(800);
	const after = (await api('admin', '/api/admin/security-events/summary?hours=1')).json.by_type.filter((t) => t.event_type === 'MASS_EXPORT').reduce((n, t) => n + t.count, 0);
	check(after === before + 1, `MASS_EXPORT за час: ${before} → ${after}`);

	console.log('(d) выгрузка аудита: фильтр «Сотрудник» в файл не войдёт');
	await admin.goto(`${BASE}/admin/audit?actor_id=0192a000-0000-7000-8000-000000000001`);
	await admin.getByTestId('audit-export').waitFor();
	await admin.getByTestId('audit-export').click();
	const d2 = admin.locator('[role="dialog"], .atmr-modal').filter({ hasText: 'Выгрузить журнал' });
	await d2.waitFor();
	check((await d2.innerText()).includes('В файл не войдут фильтры: сотрудник'), 'подтверждение предупреждает про фильтр «Сотрудник»');
	await d2.getByRole('button', { name: 'Отмена' }).click();
} finally {
	await browser.close();
}
