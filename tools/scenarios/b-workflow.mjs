// Редактор воронки (агент B): сквозной сценарий под ADMIN на живом бэкенде.
// Создаёт воронку «B2C: короткая воронка» (типовая заготовка) → правит статус, SLA, условия и действия перехода → сохраняет → 409 → публикует → архивирует статус.
//   node tools/scenarios/b-workflow.mjs
import { BASE, accessToken, newBrowser, newPage } from '../lib.mjs';

const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
	console.log(`  ✗ ${m}`);
	process.exitCode = 1;
};
const check = (c, m) => (c ? ok(m) : fail(m));

async function api(who, method, path, body, headers = {}) {
	const token = await accessToken(who);
	const res = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
	const text = await res.text();
	return { status: res.status, json: text ? JSON.parse(text) : null };
}

const field = (scope, label) => scope.locator('.atmr-input', { has: scope.page().locator(`.atmr-input__label :text-is("${label}")`) }).last();
const pickIn = async (page, scope, label, text) => {
	await field(scope, label).click();
	await page.locator('[data-testid="ddm"][data-show="true"] [data-testid="ddm__item"]', { hasText: text }).first().click();
	await page.waitForTimeout(150);
};
const node = (page, name) => page.locator('.svelte-flow__node', { hasText: name }).first();

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who: 'admin', width: 1440, height: 900 });
	const panel = page.locator('aside[aria-label="Свойства"]');
	const problems = () => page.__problems;

	console.log('Создание воронки');
	const before = (await api('admin', 'GET', '/api/workflows?limit=100')).json.items;
	let wf = before.find((w) => w.code === 'b2c_short_v1');
	if (!wf) {
		await page.goto(`${BASE}/workflows`);
		await page.getByRole('button', { name: 'Создать воронку' }).first().click();
		const drawer = page.locator('.atmr-drawer');
		await field(drawer, 'Название').locator('input').fill('B2C: короткая воронка');
		await field(drawer, 'Код').locator('input').fill('b2c_short_v1');
		await pickIn(page, drawer, 'Тип сделки', 'B2C');
		await drawer.getByRole('button', { name: 'Создать' }).click();
		await page.waitForURL(/\/workflows\/[0-9a-f-]{36}$/);
		ok('воронка создана, открыт редактор');
		wf = (await api('admin', 'GET', '/api/workflows?limit=100')).json.items.find((w) => w.code === 'b2c_short_v1');
	}
	await page.goto(`${BASE}/workflows/${wf.id}`);
	await page.waitForSelector('text=Воронка', { timeout: 15000 });

	const graph0 = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
	if (graph0.statuses.length === 0) {
		console.log('Типовая заготовка и правки');
		await page.getByRole('button', { name: 'Типовая заготовка' }).click();
		await page.waitForTimeout(600);
		check((await page.locator('.svelte-flow__node').count()) === 4, 'заготовка: 4 статуса на холсте');
		// проблемы: советы про причину отказа и сумму
		check((await page.getByRole('button', { name: 'Проблемы воронки' }).count()) > 0, 'сводка проблем (советы) показана');

		await node(page, 'В работе').click();
		await field(panel, 'Название').locator('input').fill('Обучение');
		await page.waitForTimeout(200);
		check((await node(page, 'Обучение').count()) === 1, 'переименование статуса видно на холсте сразу');
		// SLA
		await panel.getByText('Срок (SLA)').click();
		await panel.getByText('Контролировать срок в статусе').click();
		await field(panel, 'Срок').locator('input').fill('5');
		await pickIn(page, panel, 'Единица', 'Дней');
		await page.waitForTimeout(200);
		check((await node(page, 'Обучение').innerText()).includes('5'), 'SLA «5 дн.» на узле');

		// переход «Закрыть успешно»: условие + действие
		await page.locator('.svelte-flow__edge-label', { hasText: 'Закрыть успешно' }).first().click();
		await page.waitForTimeout(300);
		await panel.getByRole('button', { name: 'Условие', exact: true }).click();
		await page.waitForTimeout(200);
		check((await panel.getByText('Сумма').count()) > 0, 'условие добавлено (по умолчанию «Сумма»)');
		await pickIn(page, panel, 'Добавить действие', 'Создать задачу');
		await field(panel, 'Заголовок задачи').locator('input').fill('Выставить счёт');
		await page.waitForTimeout(200);

		// пустое название статуса → ошибка и блок публикации
		await node(page, 'Отказ').click();
		await field(panel, 'Название').locator('input').fill('');
		await page.waitForTimeout(250);
		check((await page.getByText('У статуса нет названия').count()) > 0, 'пустое название: ошибка в панели');
		check(await page.getByRole('button', { name: 'Опубликовать' }).isDisabled(), 'публикация заблокирована при ошибке');
		await field(panel, 'Название').locator('input').fill('Отказ');
		await page.waitForTimeout(200);

		await page.getByRole('button', { name: 'Сохранить' }).click();
		await page.waitForTimeout(1500);
		const saved = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
		check(saved.statuses.length === 4 && saved.transitions.length === 4, 'черновик сохранён на сервере');
		const tr = saved.transitions.find((t) => t.name === 'Закрыть успешно');
		check(tr && tr.conditions.all?.[0]?.field === 'amount' && tr.actions[0]?.title === 'Выставить счёт', 'условие и действие сохранены в графе');
		check(saved.sla_rules.some((r) => r.max_duration_hours === 120), 'SLA сохранён (120 ч)');
	} else {
		ok('воронка уже заполнена — правки пропущены');
	}

	console.log('Перезагрузка и позиции');
	const posKey = `rtk.wf.pos.${wf.id}`;
	const stored = await page.evaluate((k) => localStorage.getItem(k), posKey);
	check(Boolean(stored), 'позиции узлов запомнены в localStorage');
	await page.reload();
	await page.waitForSelector('.svelte-flow__node');
	check((await page.locator('.svelte-flow__node').count()) >= 4, 'после перезагрузки граф на месте');

	console.log('Конфликт версий (409)');
	const cur = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
	await node(page, 'Обучение').click();
	await field(panel, 'Название').locator('input').fill('Обучение (ред.)');
	// другая вкладка сохраняет тот же граф — версия воронки растёт
	const body = {
		statuses: cur.statuses.map((s) => ({ id: s.id, code: s.code, name: s.name, type: s.type, color: s.color, sort_order: s.sort_order, required_fields: s.required_fields, is_archived: false })),
		transitions: cur.transitions.map((t) => ({ from_status: t.from_status_id, to_status: t.to_status_id, name: t.name, allowed_roles: t.allowed_roles, conditions: t.conditions, actions: t.actions, requires_comment: t.requires_comment, sort_order: t.sort_order })),
		sla_rules: cur.sla_rules.map((r) => ({ status: r.status_id, max_duration_hours: r.max_duration_hours, warn_threshold_pct: r.warn_threshold_pct, escalate_to_role: r.escalate_to_role, escalate_to_user_id: r.escalate_to_user_id, channels: r.channels, count_business_days: r.count_business_days, is_active: r.is_active }))
	};
	const put = await api('admin', 'PUT', `/api/workflows/${wf.id}/graph`, body, { 'If-Match': `"${cur.workflow.version}"` });
	check(put.status === 200, 'параллельное сохранение другим пользователем прошло');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(900);
	check((await page.getByText('Воронку изменил другой пользователь').count()) > 0, '409: плашка «изменил другой пользователь»');
	await page.getByRole('button', { name: 'Оставить мои правки' }).click();
	await page.waitForTimeout(700);
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1200);
	const after = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
	check(after.statuses.some((s) => s.name === 'Обучение (ред.)'), 'после «Оставить мои правки» правка сохранена');
	await node(page, 'Обучение (ред.)').click();
	await field(panel, 'Название').locator('input').fill('Обучение');
	await page.getByRole('button', { name: 'Сохранить' }).click();
	await page.waitForTimeout(1000);

	console.log('Публикация');
	if (after.workflow.state !== 'published') {
		await page.getByRole('button', { name: 'Опубликовать' }).click();
		await page.waitForSelector('text=Опубликовать «');
		check((await page.locator('.atmr-modal, [role=dialog]').getByText('Советы').count()) > 0, 'диалог публикации показывает советы');
		await page.locator('.atmr-modal, [role=dialog]').getByRole('button', { name: 'Опубликовать' }).click();
		await page.waitForTimeout(1500);
		const pub = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
		check(pub.workflow.state === 'published' && pub.workflow.graph_hash, 'воронка опубликована, есть graph_hash');
	} else ok('воронка уже опубликована');

	console.log('Мастер архивации');
	const live = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
	if (!live.statuses.some((s) => s.is_archived)) {
		// добавляем статус, сохраняем и архивируем через мастер (сделок в нём нет)
		await page.getByLabel('Добавить статус').click();
		await field(panel, 'Название').locator('input').fill('Пауза');
		await page.getByRole('button', { name: 'Сохранить' }).click();
		await page.waitForTimeout(1200);
		await node(page, 'Пауза').click();
		await page.getByRole('button', { name: 'Архивировать…' }).click();
		await page.waitForSelector('text=Архивация статуса');
		await page.waitForTimeout(900);
		const modal = page.locator('.atmr-modal, [role=dialog]').last();
		check((await modal.getByText('Сделок в статусе нет').count()) > 0, 'шаг 1: «Сделок в статусе нет»');
		await modal.getByRole('button', { name: 'Далее' }).click();
		await modal.getByRole('button', { name: 'Далее' }).click();
		await modal.getByRole('button', { name: 'Архивировать' }).click();
		await page.waitForSelector('text=Статус в архиве', { timeout: 15000 }).catch(() => {});
		await page.waitForTimeout(1000);
		const arch = (await api('admin', 'GET', `/api/workflows/${wf.id}`)).json;
		check(arch.statuses.find((s) => s.name === 'Пауза')?.is_archived === true, 'статус «Пауза» в архиве');
		await modal.getByRole('button', { name: 'Готово' }).click().catch(() => {});
	} else ok('архивный статус уже есть');

	const p = problems();
	console.log(p.pageerrors.length ? `  ✗ page errors: ${p.pageerrors.join(' | ')}` : '  ✓ нет исключений на странице');
	const real = p.console.filter((c) => !/status of (409|422)/.test(c));
	console.log(real.length ? `  ✗ console: ${real.join(' | ')}` : '  ✓ нет ошибок консоли (кроме ожидаемых 409/422)');
} finally {
	await browser.close();
}
