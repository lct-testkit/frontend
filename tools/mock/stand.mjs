// Мок-стенд: ответы бэкенда подменяются в браузере (page.route), живой бэкенд и Keycloak не нужны.
// Ручка, которой нет в docs/openapi.json, отвечает 599 и попадает в page.__problems.failed — недописанный мок красит прогон, а не проходит молча.
//   режимы: ok — как есть; empty — списки пусты; error — списки отдают 500 (problem+json); slow — задержка delayMs на каждый ответ.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSampler, loadSpec, uuidFor } from './sample.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(resolve(here, 'fixtures', name), 'utf8'));

/** Шаблон пути OpenAPI → регулярка: `/api/deals/{deal_id}` → `^/api/deals/[^/]+$`. */
export const pathRegex = (template) => new RegExp(`^${template.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`);

/** Таблица ручек из спеки: статические пути раньше параметрических (`/api/deals/stats` до `/api/deals/{id}`). */
export function buildRoutes(spec = loadSpec()) {
	const sampler = createSampler(spec);
	const routes = [];
	for (const [path, item] of Object.entries(spec.paths)) {
		for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
			const op = item[method];
			if (!op) continue;
			const resp = sampler.responseOf(op);
			const list = sampler.isList(resp.schema);
			routes.push({
				method: method.toUpperCase(),
				path,
				re: pathRegex(path),
				params: (path.match(/\{/g) ?? []).length,
				list,
				status: resp.status,
				type: resp.type,
				reply: () => {
					const body = resp.schema ? sampler.sample(resp.schema, path.split('/').pop() ?? 'value') : null;
					// в конверте списка итог равен числу строк (иначе экран пишет «Найдено: 0» рядом с данными)
					if (list && body && typeof body === 'object' && 'total' in body && Array.isArray(body.items)) body.total = body.items.length;
					return body;
				}
			});
		}
	}
	return routes.sort((a, b) => a.params - b.params || b.path.length - a.path.length);
}

/** Фикстуры, написанные вручную поверх сгенерированных по схеме. Ответ — функция `({ url, role, mode })`. */
export function defaultOverrides() {
	const me = readJson('me.json');
	const spec = loadSpec();
	const sampler = createSampler(spec);
	const dealsSchema = spec.paths['/api/deals'].get.responses['200'].content['application/json'].schema;
	return [
		{ method: 'GET', re: /^\/api\/me$/, reply: ({ role }) => me[role] ?? me.admin },
		// «Требуют внимания» на главной просит сделки по состоянию срока: в ответе оно должно совпасть с запросом (первое значение перечисления было бы «в срок»)
		{
			method: 'GET',
			re: /^\/api\/deals$/,
			list: true,
			reply: ({ url }) => {
				const body = sampler.sample(dealsSchema, 'deals');
				const sla = url.searchParams.get('sla_state');
				if (sla) body.items = body.items.map((d, i) => ({ ...d, id: uuidFor(`deal-${sla}-${i}`), sla_state: sla }));
				body.total = body.items.length;
				return body;
			}
		}
	];
}

const PROBLEM = { type: 'about:blank', title: 'Mock error', status: 500, detail: 'Ошибка мок-стенда', code: 'CRM-9000' };

export async function installMock(page, { mode = 'ok', role = 'admin', delayMs = 0, overrides = [], spec } = {}) {
	const table = [...overrides, ...defaultOverrides(), ...buildRoutes(spec)];
	const calls = (page.__mockCalls = []);
	// только запросы к бэкенду: путь начинается с /api/, /public/ или /health/ (исходники dev-сервера вроде /src/lib/api/… не трогаем)
	await page.route((u) => /^\/(api|public|health)\//.test(u.pathname), async (route) => {
		const req = route.request();
		const url = new URL(req.url());
		const hit = table.find((r) => r.method === req.method() && r.re.test(url.pathname));
		const json = (status, body, type = 'application/json') => route.fulfill({ status, contentType: type, body: body === undefined ? '' : JSON.stringify(body) });
		calls.push(`${req.method()} ${url.pathname}${url.search}`);
		if (!hit) return json(599, { detail: `no mock for ${req.method()} ${url.pathname}` });
		if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
		if (mode === 'error' && hit.list) return json(500, PROBLEM, 'application/problem+json');
		if (mode === 'empty' && hit.list) return json(200, { items: [], next_cursor: null, total: 0 });
		const status = hit.status ?? 200;
		if (status === 204 || (!hit.type && hit.reply === undefined)) return route.fulfill({ status: 204 });
		const body = await hit.reply({ url, role, mode, req });
		if (hit.type && !hit.type.includes('json')) return route.fulfill({ status, contentType: hit.type, body: '' });
		return json(status, body);
	});
}
