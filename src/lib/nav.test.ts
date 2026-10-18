import { describe, expect, it } from 'vitest';
import { NAV, isActive, isVisible, landingFor } from './nav';

const items = NAV.flatMap((s) => s.items);
const licenses = items.find((i) => i.id === 'licenses')!;
const asCan = (...granted: string[]) => (permission: string) => granted.includes(permission);

describe('меню', () => {
	it('пункт «Лицензии» виден при чтении каталога и скрыт без него', () => {
		expect(isVisible(licenses, asCan('catalog:read'))).toBe(true);
		expect(isVisible(licenses, asCan('audit:read'))).toBe(false);
	});

	it('«События безопасности» видны только с правом security_event:read (администратор, аудитор), не руководителю', () => {
		const security = items.find((i) => i.id === 'security')!;
		expect(security.href).toBe('/admin/security');
		expect(isVisible(security, asCan('security_event:read'))).toBe(true);
		expect(isVisible(security, asCan('audit:read', 'user:read'))).toBe(false);
	});

	it('пункт стоит сразу после «Организаций»', () => {
		const work = NAV.find((s) => s.id === 'work')!.items.map((i) => i.id);
		expect(work.indexOf('licenses')).toBe(work.indexOf('orgs') + 1);
	});

	it('подсвечивается на /licenses и /licenses/abc, но не на соседних адресах', () => {
		expect(isActive(licenses, '/licenses')).toBe(true);
		expect(isActive(licenses, '/licenses/abc')).toBe(true);
		expect(isActive(licenses, '/organizations')).toBe(false);
	});

	it('куда попадает КАМ после входа, не изменилось', () => {
		expect(landingFor(asCan('deal:read', 'report:read', 'catalog:read', 'organization:read'))).toBe('/');
	});

	it('адреса пунктов уникальны', () => {
		const hrefs = items.map((i) => i.href);
		expect(new Set(hrefs).size).toBe(hrefs.length);
	});
});
