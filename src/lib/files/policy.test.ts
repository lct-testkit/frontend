import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_POLICY, acceptAttr, allowedLabel, extensionOf, getPolicy, setPolicy, validateFile } from './policy';

const file = (name: string, size = 1000) => ({ name, size });

afterEach(() => setPolicy(null));

describe('extensionOf', () => {
	it('берёт последнее расширение в нижнем регистре', () => {
		expect(extensionOf('a.PDF')).toBe('pdf');
		expect(extensionOf('archive.tar.gz')).toBe('gz');
		expect(extensionOf('noext')).toBe('');
		expect(extensionOf('trailing.')).toBe('');
	});
});

describe('validateFile', () => {
	it('пропускает файл с расширением в верхнем регистре', () => {
		expect(validateFile(file('a.PDF'))).toEqual({ ok: true });
	});
	it('для a.tar.gz берёт gz', () => {
		expect(validateFile(file('a.tar.gz'))).toEqual({ ok: true });
	});
	it('json разрешён (бэкенд пропускает его по умолчанию)', () => {
		expect(validateFile(file('data.json'))).toEqual({ ok: true });
	});
	it('a.exe — отказ с кодом type и перечнем допустимых форматов', () => {
		const r = validateFile(file('a.exe'));
		expect(r).toMatchObject({ ok: false, code: 'type' });
		if (!r.ok) {
			expect(r.message).toContain('Тип «.exe» не поддерживается');
			expect(r.message).toContain('PDF, PNG, JPEG, Word, Excel, ZIP, GZIP, RAR');
		}
	});
	it('a.svg отклоняется всегда, даже если svg есть в наборе', () => {
		setPolicy({ extensions: ['svg', 'pdf'], maxBytes: 1000 });
		expect(validateFile(file('a.svg', 10))).toMatchObject({ ok: false, code: 'type' });
		expect(acceptAttr()).not.toContain('svg');
	});
	it('файл 0 байт — empty', () => {
		expect(validateFile(file('a.pdf', 0))).toMatchObject({ ok: false, code: 'empty' });
	});
	it('50 МиБ + 1 байт — size с текстом про 50 МБ; ровно 50 МиБ проходит', () => {
		const max = DEFAULT_POLICY.maxBytes;
		const r = validateFile(file('a.pdf', max + 1));
		expect(r).toMatchObject({ ok: false, code: 'size' });
		if (!r.ok) expect(r.message).toBe('Файл больше 50 МБ');
		expect(validateFile(file('a.pdf', max))).toEqual({ ok: true });
	});
	it('имя без расширения — type', () => {
		expect(validateFile(file('contract'))).toMatchObject({ ok: false, code: 'type' });
	});
	it('имя длиннее 255 символов — name', () => {
		expect(validateFile(file(`${'я'.repeat(252)}.pdf`))).toMatchObject({ ok: false, code: 'name' });
	});
});

describe('setPolicy', () => {
	it('точки и регистр в наборе нормализуются, null возвращает значения по умолчанию', () => {
		setPolicy({ extensions: ['.PDF'], maxBytes: 10 });
		expect(getPolicy().extensions.has('pdf')).toBe(true);
		expect(validateFile(file('a.png', 5))).toMatchObject({ ok: false, code: 'type' });
		expect(allowedLabel()).toBe('PDF');
		setPolicy(null);
		expect(getPolicy()).toBe(DEFAULT_POLICY);
	});
});
