import { describe, expect, it } from 'vitest';
import { isPolicyVersion, isSecretPlaceholder, parseSettingValue, policyPayload, settingKind, stringifySettingValue } from './settings';

describe('parseSettingValue / stringifySettingValue', () => {
	it('JSON, скаляры и строки без кавычек', () => {
		expect(parseSettingValue('{"a": 1}')).toEqual({ ok: true, value: { a: 1 } });
		expect(parseSettingValue('true')).toEqual({ ok: true, value: true });
		expect(parseSettingValue('42')).toEqual({ ok: true, value: 42 });
		expect(parseSettingValue('http://sms:8090')).toEqual({ ok: true, value: 'http://sms:8090' });
		expect(parseSettingValue('  ')).toEqual({ ok: true, value: '' });
	});
	it('обратное преобразование', () => {
		expect(stringifySettingValue('abc')).toBe('abc');
		expect(stringifySettingValue({ a: 1 })).toBe('{\n  "a": 1\n}');
		expect(stringifySettingValue(null)).toBe('');
	});
	it('вид настройки и плейсхолдер секрета', () => {
		expect(settingKind(true, false)).toBe('boolean');
		expect(settingKind('x', true)).toBe('secret');
		expect(settingKind({ a: 1 }, false)).toBe('json');
		expect(isSecretPlaceholder('********')).toBe(true);
	});
});

describe('policyPayload', () => {
	it('считает sha256 текста', async () => {
		const payload = await policyPayload(' 2.0 ', 'abc');
		expect(payload).toEqual({ version: '2.0', text_hash: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' });
		expect(isPolicyVersion('2.0')).toBe(true);
		expect(isPolicyVersion('bad version!')).toBe(false);
	});
});
