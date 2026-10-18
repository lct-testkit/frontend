import { describe, expect, it } from 'vitest';
import { maskPhone, otpChannel } from './otpChannel';

describe('maskPhone', () => {
	it('код страны и две последние цифры', () => {
		expect(maskPhone('+7 999 123-45-12')).toBe('+7 *** **12');
		expect(maskPhone('89991234512')).toBe('+8 *** **12');
		expect(maskPhone('9991234512')).toBe('+7 *** **12');
	});
	it('невалидный ввод не падает: короткое и пустое скрываются, не показываются', () => {
		expect(maskPhone('12')).toBe('***');
		expect(maskPhone('')).toBe('***');
		expect(maskPhone(null)).toBe('***');
		expect(maskPhone('abc')).toBe('***');
	});
	it('полный номер в тексте не встречается', () => {
		expect(otpChannel({ phone: '+7 999 123-45-12' }).text).not.toMatch(/999|123-45/);
	});
});

describe('otpChannel: телефон есть/нет × почта работает/неизвестна', () => {
	it('телефон есть: SMS, маска; в демо — пометка про тестовый шлюз', () => {
		const real = otpChannel({ phone: '+7 999 123-45-12', email: 'a@b.ru' });
		expect(real).toMatchObject({ channel: 'sms', tone: 'info' });
		expect(real.text).toBe('Код придёт SMS на +7 *** **12.');
		expect(otpChannel({ phone: '+79991234512', demo: true }).text).toMatch(/тестовый шлюз/);
		expect(otpChannel({ phone: '+79991234512', sms: 'mock' }).text).toMatch(/тестовый шлюз/);
		expect(otpChannel({ phone: '+79991234512', sms: 'real' }).text).not.toMatch(/шлюз/);
	});
	it('телефона нет, почта неизвестна: на почту, без утверждений, что она работает', () => {
		const r = otpChannel({ email: 'ivan@rt.ru' });
		expect(r).toMatchObject({ channel: 'email', tone: 'info' });
		expect(r.text).toContain('ivan@rt.ru');
		expect(r.text).toMatch(/убедитесь, что почта работает/);
	});
	it('телефона нет, почта не настроена — предупреждение', () => {
		expect(otpChannel({ email: 'ivan@rt.ru', smtp: false })).toMatchObject({ channel: 'email', tone: 'warning' });
	});
	it('ни телефона, ни почты — некуда', () => {
		expect(otpChannel({})).toEqual({ channel: 'none', tone: 'warning', text: 'Код отправить некуда: укажите телефон.' });
		expect(otpChannel({ phone: '  ', email: ' ' }).channel).toBe('none');
	});
});
