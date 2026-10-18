import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error — .mjs без типов
import { buildRoutes, pathRegex } from './stand.mjs';
// @ts-expect-error — .mjs без типов
import { conforms, createSampler, loadSpec, uuidFor } from './sample.mjs';

const spec = loadSpec();
const me = JSON.parse(readFileSync(new URL('./fixtures/me.json', import.meta.url), 'utf8')) as Record<string, Record<string, unknown>>;

describe('фикстуры', () => {
	it('/api/me для четырёх ролей совпадает со схемой MeResponse и не просит согласия', () => {
		const schema = spec.paths['/api/me'].get.responses['200'].content['application/json'].schema;
		for (const role of ['kam', 'head', 'admin', 'auditor']) {
			expect(conforms(spec, schema, me[role]), role).toEqual([]);
			expect(me[role].consent_required, role).toBe(false);
			expect(me[role].role, role).toBe(role.toUpperCase());
		}
	});
	it('у администратора прав больше, чем у аудитора', () => {
		expect((me.admin.scopes as string[]).length).toBeGreaterThan((me.auditor.scopes as string[]).length);
	});
});

describe('пример по схеме', () => {
	const sampler = createSampler(spec);
	it('каждая GET-ручка контракта получает ответ, совпадающий со своей схемой', () => {
		let checked = 0;
		for (const [path, item] of Object.entries<Record<string, { responses: object }>>(spec.paths)) {
			if (!item.get) continue;
			const { schema, type } = sampler.responseOf(item.get);
			if (!schema || !String(type).includes('json')) continue;
			const value = sampler.sample(schema, path);
			expect(conforms(spec, schema, value), path).toEqual([]);
			checked++;
		}
		expect(checked).toBeGreaterThan(50);
	});
	it('конверт списка определяется по полю items', () => {
		const deals = spec.paths['/api/deals'].get.responses['200'].content['application/json'].schema;
		expect(sampler.isList(deals)).toBe(true);
		const me = spec.paths['/api/me'].get.responses['200'].content['application/json'].schema;
		expect(sampler.isList(me)).toBe(false);
	});
	it('uuid стабилен для одного имени и различается между именами', () => {
		expect(uuidFor('id')).toBe(uuidFor('id'));
		expect(uuidFor('id')).not.toBe(uuidFor('deal_id'));
		expect(uuidFor('id')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
	});
});

describe('таблица ручек', () => {
	const routes = buildRoutes(spec);
	it('в таблице все операции спеки', () => {
		const ops = Object.values<Record<string, unknown>>(spec.paths).reduce((n, item) => n + ['get', 'post', 'put', 'patch', 'delete'].filter((m) => item[m]).length, 0);
		expect(routes.length).toBe(ops);
	});
	it('статический путь выбирается раньше параметрического', () => {
		const hit = (method: string, path: string) => routes.find((r: { method: string; re: RegExp }) => r.method === method && r.re.test(path));
		expect(hit('GET', '/api/me').path).toBe('/api/me');
		expect(hit('GET', '/api/deals/01a14ec1-3391-7000-aa66-ae1fa1749e5e').path).toBe('/api/deals/{deal_id}');
	});
	it('путь вне контракта не находится (мок ответит 599)', () => {
		expect(routes.some((r: { re: RegExp }) => r.re.test('/api/no-such-thing'))).toBe(false);
	});
	it('pathRegex экранирует точки и не пропускает вложенные пути', () => {
		const re = pathRegex('/api/files/{id}');
		expect(re.test('/api/files/abc')).toBe(true);
		expect(re.test('/api/files/abc/download')).toBe(false);
	});
});
