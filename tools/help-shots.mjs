// Картинки встроенной справки (static/help/*.png, ширина 900 px) с работающего клиента на демо-данных.
// Единственный источник правды — список SHOTS ниже (он же манифест): имя, глава, роль, адрес, область снимка, подготовка, режим.
//   node tools/help-shots.mjs --list [--json]                 таблица кадров (или JSON для проверки), браузер не запускается
//   node tools/help-shots.mjs                                 все кадры режима auto
//   node tools/help-shots.mjs --only teams,admin-audit        только кадры, в имени которых есть одно из слов
//   node tools/help-shots.mjs --out .shots/help-try           пробный прогон в другую папку (манифест ляжет туда же)
//   node tools/help-shots.mjs --only login-prod --prod-url http://localhost:18080
//   KC_ADMIN_PASSWORD=… node tools/help-shots.mjs --keycloak --only admin-keycloak
// После прогона пишется манифест (имя, глава, роль, адрес, ширина, высота, sha256, режим): по умолчанию tools/help-shots.manifest.json,
// при другом --out — manifest.json в этой папке. Его читает проверка актуальности справки.
// Кадры режима manual нужны живого состояния (письмо с кодом, доставленные события, приглашение): howto описывает, как их снять руками.
// Сценарии берут не «первую попавшуюся» сделку, а подходящую: воронка B2B по умолчанию (14 шагов), шаг из середины воронки, организация, сумма, позиции.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE, accessToken, findB2bWorkflow, graphSteps, newBrowser, newPage } from './lib.mjs';

const WIDTH = 900;
const PAD = 12;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- данные стенда
const tokens = {};
async function api(who, path) {
	tokens[who] ??= await accessToken(who);
	const res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${tokens[who]}` } });
	if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
	return res.json();
}
const items = (j) => (Array.isArray(j) ? j : (j.items ?? []));

const memo = new Map();
const once = (key, make) => (memo.has(key) ? memo.get(key) : (memo.set(key, make()), memo.get(key)));

/** Воронка B2B по умолчанию и её шаги по порядку (14 шагов): карточка сделки и график снимаются с неё, а не с B2C. */
const b2b = () =>
	once('b2b', async () => {
		const workflow = await findB2bWorkflow((path) => api('admin', path));
		if (!workflow) throw new Error('нет опубликованной воронки B2B');
		const graph = await api('admin', `/api/workflows/${workflow.id}`);
		return { workflow, steps: graphSteps(graph.graph ?? graph) };
	});

/**
 * Подходящая демо-сделка роли: воронка B2B, шаг из середины (по умолчанию 5–10 из 14), есть организация, сумма и контакт; побеждает та,
 * у которой есть позиции и шаг ближе к седьмому. `withFiles` — только сделки, у которых уже есть вложение.
 */
async function pickDeal(who, { withFiles = false } = {}) {
	const { workflow, steps } = await b2b();
	const order = new Map(steps.map((s, i) => [s.id, i + 1]));
	const deals = items(await api(who, '/api/deals?limit=100')).filter((d) => d.workflow_id === workflow.id && order.has(d.status_id) && d.organization_id && d.amount && d.contact_id);
	const scored = deals
		.map((d) => ({ d, step: order.get(d.status_id) }))
		.filter(({ step }) => step >= 5 && step <= 10)
		.map(({ d, step }) => ({ d, score: (d.products?.length ? 20 : 0) + (d.owner_id ? 5 : 0) - Math.abs(step - 7) }))
		.sort((a, b) => b.score - a.score || a.d.number.localeCompare(b.d.number));
	for (const { d } of scored) {
		if (!withFiles) return d;
		const files = items(await api(who, `/api/attachments?entity_type=deal&entity_id=${d.id}`));
		if (files.length) return d;
	}
	throw new Error(`нет подходящей сделки для роли ${who}${withFiles ? ' с файлом' : ''}`);
}

/** Организация с лицензиями (из импорта типа license или сида): для вкладки «Лицензии». */
const orgWithLicenses = () =>
	once('org-lic', async () => {
		const lic = items(await api('kam', '/api/organization-licenses?limit=50'));
		if (!lic.length) throw new Error('нет лицензий в демо-данных');
		const counts = new Map();
		for (const l of lic) counts.set(l.organization_id, (counts.get(l.organization_id) ?? 0) + 1);
		return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
	});

const dashboardOverview = () =>
	once('dash', async () => {
		const list = items(await api('admin', '/api/dashboards?limit=100'));
		return list.find((d) => d.name === 'Обзор воронки') ?? list[0] ?? null;
	});

// ---------------------------------------------------------------- подготовка страниц
const click = (finder) => async (page) => {
	await finder(page).first().click();
	await wait(700);
};

// ---------------------------------------------------------------- манифест кадров
/**
 * name — имя файла без .png; chapter — глава справки, где картинка нужна; who — роль (kam|head|admin|auditor) или null; url — адрес или функция(ctx);
 * viewport — [ширина, высота], по умолчанию 1440×900; selector — строка или список строк: кадр режется по объединению их рамок с полем 12 px
 * (полос пустого места не бывает); clip — {x,y,width,height} в экране, если без selector; before(page) — подготовка; mode: auto | manual | flag.
 */
export const SHOTS = [
	{ name: 'login', chapter: '01-start', who: null, url: '/login', clip: { x: 0, y: 0, width: 1440, height: 900 } },
	{
		name: 'home',
		chapter: '01-start',
		who: 'kam',
		url: '/',
		clip: { x: 270, y: 70, width: 1140, height: 640 },
		before: async (p) => {
			await p.waitForLoadState('networkidle').catch(() => {});
			await wait(1500);
		}
	},
	{
		name: 'deal-card',
		chapter: '02-deals',
		who: 'kam',
		url: async () => `/deals/${(await pickDeal('kam')).id}`,
		// от ссылки «Сделки» до полосы вкладок включительно; карточки обзора ниже не режутся пополам
		clip: { x: 270, y: 70, width: 1140, height: 520 }
	},
	{
		name: 'deal-files',
		chapter: 'файлы в статусе (F6-6)',
		who: 'kam',
		url: async () => `/deals/${(await pickDeal('kam', { withFiles: true })).id}?tab=files`,
		// вкладки, зона загрузки и первые файлы
		clip: { x: 270, y: 535, width: 1140, height: 365 }
	},
	{
		name: 'org-lookup',
		chapter: '03-organizations',
		who: 'kam',
		url: '/organizations',
		clip: { x: 865, y: 0, width: 560, height: 251 },
		before: async (p) => {
			await p.getByTestId('new-org').first().click();
			await p.getByPlaceholder(/Например/).fill('7729012342');
			await wait(1800);
		}
	},
	{
		name: 'org-card',
		chapter: '03-organizations',
		who: 'kam',
		url: async () => `/organizations/${await orgWithLicenses()}`,
		clip: { x: 270, y: 70, width: 1140, height: 620 }
	},
	{
		name: 'org-licenses',
		chapter: 'лицензии (F6-6)',
		who: 'kam',
		url: async () => `/organizations/${await orgWithLicenses()}?tab=licenses`,
		clip: { x: 270, y: 70, width: 1140, height: 520 }
	},
	{ name: 'import-wizard', chapter: '05-import-reports', who: 'admin', url: '/imports/new', clip: { x: 270, y: 70, width: 870, height: 546 } },
	{
		name: 'reports',
		chapter: '05-import-reports',
		who: 'head',
		url: '/reports',
		viewport: [1440, 780],
		selector: '[role=dialog]',
		before: click((p) => p.getByRole('button', { name: /Сделки по вузам/ }))
	},
	{ name: 'reports-history', chapter: '05-import-reports', who: 'admin', url: '/reports/history', clip: { x: 270, y: 70, width: 1140, height: 560 } },
	{
		name: 'dashboards',
		chapter: 'отчёты (F6-6)',
		who: 'head',
		url: async () => {
			const d = await dashboardOverview();
			return d ? `/reports/dashboards/${d.id}` : '/reports/dashboards';
		},
		clip: { x: 270, y: 70, width: 1140, height: 640 },
		before: async (p) => {
			const refresh = p.getByRole('button', { name: 'Обновить данные' });
			if (await refresh.count()) {
				await refresh.click();
				await p
					.waitForFunction(() => ![...document.querySelectorAll('button')].some((b) => b.textContent?.includes('Обновить данные') && b.disabled), null, { timeout: 150000 })
					.catch(() => {});
				await wait(1500);
				await p.getByLabel('Скачать').nth(2).click().catch(() => {});
			}
		}
	},
	{ name: 'tasks', chapter: '09-tasks', who: 'kam', url: '/tasks', clip: { x: 270, y: 70, width: 1140, height: 560 } },
	{
		name: 'notifications',
		chapter: '09-tasks',
		who: 'kam',
		url: '/',
		// панель уведомлений, открытая колокольчиком
		selector: '.atmr-popover',
		before: async (p) => {
			await p.getByTestId('bell').click();
			await p.locator('.atmr-popover').first().waitFor({ timeout: 10000 });
			await wait(900);
		}
	},
	{ name: 'admin-users-list', chapter: 'admin/06', who: 'admin', url: '/admin/users', clip: { x: 270, y: 70, width: 1140, height: 520 } },
	{
		name: 'admin-user-card',
		chapter: 'admin/06',
		who: 'admin',
		// карточка руководителя отдела (Пётр Петров), а не случайной тестовой учётки
		url: async () => {
			const users = items(await api('admin', '/api/admin/users?limit=100'));
			const user = users.find((u) => u.full_name === 'Пётр Петров') ?? users[0];
			return `/admin/users/${user.id}`;
		},
		clip: { x: 270, y: 70, width: 1140, height: 620 }
	},
	{
		name: 'teams',
		chapter: '06-admin',
		who: 'admin',
		url: '/admin/teams',
		// поиск и таблица вместе: клип по их рамкам, без пустого места под таблицей
		selector: ['input[placeholder^="Название"]', 'table, [role=table], [role=grid]'],
		before: async (p) => {
			await p.getByText('Региональный отдел').first().waitFor({ timeout: 15000 });
			await wait(600);
		}
	},
	{ name: 'admin-audit', chapter: '06-admin', who: 'admin', url: '/admin/audit', clip: { x: 270, y: 70, width: 1140, height: 620 } },
	{
		name: 'admin-audit-chain',
		chapter: 'admin/12',
		who: 'admin',
		url: '/admin/audit',
		selector: '[role=dialog]',
		before: async (p) => {
			await p.getByTestId('audit-chain').click();
			await p.getByTestId('chain-result').waitFor({ timeout: 60000 });
			await wait(500);
		}
	},
	{ name: 'integrations-sources', chapter: '10-integrations', who: 'admin', url: '/admin/integrations', clip: { x: 270, y: 70, width: 1140, height: 340 } },
	{
		name: 'admin-health',
		chapter: 'admin/01',
		who: 'admin',
		url: '/admin/integrations',
		selector: '[aria-label="Состояние системы"]',
		before: async (p) => {
			await p.locator('[aria-label="Состояние системы"]').getByText(/источник|Работают/i).first().waitFor({ timeout: 15000 });
			await wait(500);
		}
	},
	{ name: 'integration-source', chapter: '10-integrations', who: 'admin', url: '/admin/integrations', clip: { x: 270, y: 70, width: 1140, height: 620 } },
	{ name: 'admin-settings', chapter: '06-admin', who: 'admin', url: '/admin/settings', clip: { x: 270, y: 70, width: 1140, height: 640 } },
	{ name: 'approvals', chapter: '06-admin', who: 'admin', url: '/admin/approvals', clip: { x: 270, y: 70, width: 1140, height: 420 } },
	{ name: 'erasure', chapter: '06-admin', who: 'admin', url: '/admin/erasure', clip: { x: 270, y: 70, width: 1140, height: 520 } },
	{
		name: 'global-search',
		chapter: '12-shortcuts',
		who: 'kam',
		url: '/deals',
		clip: { x: 270, y: 0, width: 1140, height: 520 },
		before: async (p) => {
			await p.keyboard.press('Control+KeyK');
			await p.keyboard.type('Казан', { delay: 40 });
			await wait(1500);
		}
	},
	{ name: 'phone-deals', chapter: '12-shortcuts', who: 'kam', url: '/deals', viewport: [390, 844], clip: { x: 0, y: 0, width: 390, height: 844 } },
	{ name: 'security', chapter: '08-security', who: 'kam', url: '/profile', clip: { x: 270, y: 70, width: 830, height: 599 }, before: click((p) => p.getByText('Безопасность', { exact: true })) },
	{
		name: 'workflow-graph',
		chapter: '07-workflows',
		who: 'admin',
		// воронка B2B по умолчанию (14 шагов), а не B2C
		url: async () => `/workflows/${(await b2b()).workflow.id}`,
		clip: { x: 270, y: 70, width: 1140, height: 712 },
		before: async (p) => {
			await wait(1200);
			await p.locator('.svelte-flow__controls-fitview').first().click();
		}
	},
	{ name: 'design-system', chapter: '11-design-system', who: 'kam', url: '/help?s=design-system', clip: { x: 270, y: 70, width: 1140, height: 640 } },
	{ name: 'swagger', chapter: '13-about', who: 'admin', url: '/api/docs', clip: { x: 0, y: 0, width: 1440, height: 800 }, mode: 'demo-only' },
	{ name: 'login-prod', chapter: 'admin/02, admin/03', who: null, url: '/login', clip: { x: 0, y: 0, width: 1440, height: 900 }, mode: 'prod-url' },
	{ name: 'admin-keycloak-users', chapter: 'admin/06, admin/07', who: null, url: '', mode: 'keycloak', howto: 'Консоль Keycloak, realm crm, раздел Users; флаг --keycloak и пароль в KC_ADMIN_PASSWORD.' },
	{ name: 'admin-keycloak-email', chapter: 'admin/06, admin/07', who: null, url: '', mode: 'keycloak', howto: 'Консоль Keycloak, realm crm, Realm settings → Email; флаг --keycloak и пароль в KC_ADMIN_PASSWORD.' },
	{
		name: 'signing-otp',
		chapter: '04-signing',
		who: null,
		url: '',
		mode: 'manual',
		howto: 'Создать запрос подписи по сделке, открыть публичную ссылку из письма (в демо — из журнала писем), дойти до окна ввода кода. Реальные телефон и ФИО замазать.'
	},
	{
		name: 'integrations-outbox',
		chapter: '10-integrations',
		who: 'admin',
		url: '/admin/integrations',
		mode: 'manual',
		howto: 'Вкладка «Исходящие» после доставки хотя бы одного события во внешнюю систему; нужны доставленные события.'
	},
	{ name: 'admin-invite-link', chapter: 'admin/07', who: 'admin', url: '/admin/users', mode: 'manual', howto: 'Пригласить тестового пользователя и снять окно со ссылкой-приглашением (после F5-8).' },
	{ name: 'grafana-api', chapter: 'admin/10', who: 'admin', url: '/grafana', mode: 'manual', howto: 'Стенд с профилем monitoring, дашборд «API» в Grafana.' }
];

// ---------------------------------------------------------------- запуск
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const out = opt('out', 'static/help');
const only = opt('only', '')
	.split(',')
	.filter(Boolean);
const prodUrl = opt('prod-url', '');
const keycloak = flag('keycloak');
const want = (s) => !only.length || only.some((o) => s.name.includes(o));

function runnable(s) {
	if (s.mode === 'manual') return 'вручную';
	if (s.mode === 'prod-url') return prodUrl ? null : 'нужен --prod-url';
	if (s.mode === 'keycloak') return keycloak ? (process.env.KC_ADMIN_PASSWORD ? null : 'нужен KC_ADMIN_PASSWORD') : 'нужен --keycloak';
	return null;
}

if (flag('list') && flag('json')) {
	console.log(JSON.stringify(SHOTS.map((s) => ({ name: s.name, chapter: s.chapter, who: s.who ?? null, mode: s.mode ?? 'auto', hasUrl: s.url !== '' && s.url != null, hasArea: Boolean(s.selector || s.clip), howto: s.howto ?? null }))));
	process.exit(0);
}
if (flag('list')) {
	const rows = SHOTS.map((s) => ({ имя: s.name, глава: s.chapter, роль: s.who ?? 'аноним', режим: s.mode ?? 'auto', адрес: typeof s.url === 'function' ? '(по данным стенда)' : s.url, область: s.selector ? 'selector' : s.clip ? `${s.clip.width}×${s.clip.height}` : '—' }));
	console.table(rows);
	const auto = SHOTS.filter((s) => !s.mode || s.mode === 'demo-only').length;
	console.log(`всего ${SHOTS.length}: auto ${auto}, manual ${SHOTS.filter((s) => s.mode === 'manual').length}, с флагом ${SHOTS.filter((s) => s.mode === 'prod-url' || s.mode === 'keycloak').length}`);
	process.exit(0);
}

/** ширина, высота PNG из заголовка IHDR (байты 16–23) */
const pngSize = (buf) => ({ width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) });

async function shoot(browser, s) {
	const [vw, vh] = s.viewport ?? [1440, 900];
	let url = typeof s.url === 'function' ? await s.url() : s.url;
	let base = BASE;
	if (s.mode === 'prod-url') base = prodUrl.replace(/\/$/, '');
	// скрин-кадр в масштабе, дающем ровно 900 px по ширине вырезки; для selector ширина неизвестна заранее — сначала меряем, потом снимаем заново
	const open = async (dpr) => {
		const page = await newPage(browser, { who: s.who, width: vw, height: vh, theme: 'rtk_default_light', dpr });
		await page.goto(base + url, { waitUntil: 'load' });
		await page.waitForLoadState('networkidle').catch(() => {});
		await wait(600);
		if (s.before) await s.before(page);
		await wait(900);
		return page;
	};
	const boxOf = async (page) => {
		const boxes = [];
		for (const sel of [].concat(s.selector)) {
			const b = await page.locator(sel).first().boundingBox();
			if (!b) throw new Error(`не найден ${sel}`);
			boxes.push(b);
		}
		const x0 = Math.min(...boxes.map((b) => b.x));
		const y0 = Math.min(...boxes.map((b) => b.y));
		const x1 = Math.max(...boxes.map((b) => b.x + b.width));
		const y1 = Math.max(...boxes.map((b) => b.y + b.height));
		const x = Math.max(0, x0 - PAD);
		const y = Math.max(0, y0 - PAD);
		// целые пиксели: иначе при масштабе 900 / ширина файл выходит 898–899 px
		const left = Math.floor(x);
		const top = Math.floor(y);
		return { x: left, y: top, width: Math.ceil(Math.min(vw, x1 + PAD) - left), height: Math.ceil(y1 + PAD - top) };
	};
	let clip = s.clip;
	let page;
	if (s.selector) {
		page = await open(1);
		clip = await boxOf(page);
		await page.context().close();
	}
	page = await open(WIDTH / clip.width);
	const file = `${out}/${s.name}.png`;
	await page.screenshot({ path: file, clip });
	await page.context().close();
	const buf = await readFile(file);
	return { buf, ...pngSize(buf) };
}

await mkdir(out, { recursive: true });
const browser = await newBrowser();
const manifest = [];
let failed = 0;
for (const s of SHOTS) {
	if (!want(s)) continue;
	const why = runnable(s);
	if (why) {
		console.log('–', s.name, `(${why})`);
		manifest.push({ name: s.name, chapter: s.chapter, who: s.who ?? 'anon', url: typeof s.url === 'function' ? null : s.url, width: null, height: null, sha256: null, mode: s.mode, ...(s.howto ? { howto: s.howto } : {}) });
		continue;
	}
	try {
		const r = await shoot(browser, s);
		const url = typeof s.url === 'function' ? await s.url() : s.url;
		manifest.push({ name: s.name, chapter: s.chapter, who: s.who ?? 'anon', url, width: r.width, height: r.height, sha256: createHash('sha256').update(r.buf).digest('hex'), mode: s.mode ?? 'auto' });
		console.log('✓', `${out}/${s.name}.png`, `${r.width}×${r.height}`);
	} catch (e) {
		failed += 1;
		console.log('✗', s.name, String(e.message ?? e).split('\n')[0]);
	}
}
await browser.close();

const manifestPath = out === 'static/help' ? resolve(fileURLToPath(import.meta.url), '..', 'help-shots.manifest.json') : `${out}/manifest.json`;
// при выборочном прогоне записи остальных кадров сохраняются
let previous = [];
try {
	previous = JSON.parse(await readFile(manifestPath, 'utf8'));
} catch {
	// первого манифеста ещё нет
}
const byName = new Map(previous.map((m) => [m.name, m]));
for (const m of manifest) byName.set(m.name, m);
const ordered = SHOTS.map((s) => byName.get(s.name)).filter(Boolean);
await writeFile(manifestPath, `${JSON.stringify(ordered, null, 2)}\n`);
console.log(`манифест: ${manifestPath} (${ordered.length} записей), ошибок: ${failed}`);
process.exit(failed ? 1 : 0);
