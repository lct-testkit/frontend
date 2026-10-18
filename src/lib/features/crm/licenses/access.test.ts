import { describe, expect, it } from 'vitest';
import { licenseAccess } from './access';

const asCan = (...granted: string[]) => (permission: string) => granted.includes(permission);

describe('licenseAccess', () => {
	it('КАМ: читает, создаёт, правит, выгружает отчёт; не удаляет и не импортирует', () => {
		const a = licenseAccess(asCan('catalog:read', 'license:write', 'report:create'));
		expect(a).toEqual({ read: true, create: true, edit: true, remove: false, importFile: false, exportReport: true });
	});

	it('Руководитель и Администратор: плюс удаление и импорт', () => {
		const a = licenseAccess(asCan('catalog:read', 'license:write', 'license:delete', 'import:run', 'report:create'));
		expect(Object.values(a).every(Boolean)).toBe(true);
	});

	it('Аудитор (прав нет): всё запрещено', () => {
		expect(Object.values(licenseAccess(asCan())).some(Boolean)).toBe(false);
	});

	it('удаление не следует из права записи', () => {
		expect(licenseAccess(asCan('catalog:read', 'license:write')).remove).toBe(false);
	});

	it('права записи без чтения каталога не открывают экран', () => {
		expect(licenseAccess(asCan('license:write')).read).toBe(false);
	});
});
