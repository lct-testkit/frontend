// Самопроверка мок-стенда: каждый экран приложения открывается на моке в режимах ok, empty и error; ответов 599 («нет мока»), ошибок страницы и падений
// отрисовки быть не должно. Не нужен ни бэкенд, ни Keycloak — только собранный (preview) или dev-клиент по APP_URL.
//   APP_URL=http://localhost:4273 node tools/mock/selfcheck.mjs [--role admin] [--modes ok,empty,error] [--only /deals,/contacts]
import { BASE } from '../lib.mjs';
import { routePatterns } from '../routes.mjs';
import { newBrowser, newMockPage } from './page.mjs';
import { uuidFor } from './sample.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const role = opt('role', 'admin');
const modes = opt('modes', 'ok,empty,error').split(',');
const only = opt('only', '')
	.split(',')
	.filter(Boolean);

/** `/deals/[id]` → `/deals/<uuid>`; публичные страницы по токену получают обычную строку. */
const fill = (pattern) => pattern.replace(/\[\.{0,3}([^\]]+)\]/g, (_m, name) => (/token/i.test(name) ? 'mock-token' : uuidFor(name)));

const patterns = (await routePatterns()).filter((p) => only.length === 0 || only.includes(p));
const browser = await newBrowser();
let bad = 0;
try {
	for (const mode of modes) {
		for (const pattern of patterns) {
			const page = await newMockPage(browser, role, { mode });
			const url = fill(pattern);
			try {
				await page.goto(BASE + url, { waitUntil: 'load' });
				await page.waitForLoadState('networkidle').catch(() => {});
				await page.waitForTimeout(400);
			} catch (e) {
				page.__problems.pageerrors.push(`goto: ${String(e).slice(0, 160)}`);
			}
			const unmocked = page.__problems.failed.filter((f) => f.startsWith('599'));
			const errors = page.__problems.pageerrors;
			if (unmocked.length || errors.length) {
				bad++;
				console.log(`✗ [${mode}] ${url}`);
				for (const f of [...new Set(unmocked)]) console.log(`    ${f}`);
				for (const e of errors) console.log(`    pageerror: ${e}`);
			} else console.log(`✓ [${mode}] ${url}`);
			await page.context().close();
		}
	}
} finally {
	await browser.close();
}
console.log(bad ? `\n${bad} экранов с проблемами` : '\nвсе экраны открываются на моке без запросов вне мока');
process.exitCode = bad ? 1 : 0;
