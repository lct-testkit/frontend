import { describe, expect, it } from 'vitest';
import { ApiError, errorCode, errorHelpHref, errorMessage, errorTextWithCode } from './errors';

const api = (status: number, code: string, detail = 'Подробность от сервера') => new ApiError({ status, code, detail });

describe('errorCode', () => {
	it('отдаёт код из каталога', () => {
		expect(errorCode(api(422, 'CRM-1201'))).toBe('CRM-1201');
		expect(errorCode(api(403, 'CRM-1102'))).toBe('CRM-1102');
	});

	it('для сети, чужой ошибки и строки — null', () => {
		expect(errorCode(ApiError.network())).toBeNull();
		expect(errorCode(new Error('x'))).toBeNull();
		expect(errorCode('CRM-1201')).toBeNull();
		expect(errorCode(null)).toBeNull();
	});

	it('для валидации поля и ухода на вход — null: у них свой текст', () => {
		expect(errorCode(api(422, 'CRM-1001'))).toBeNull();
		expect(errorCode(api(401, 'CRM-1101'))).toBeNull();
	});

	it('код не по формату не показываем', () => {
		expect(errorCode(api(500, 'INTERNAL'))).toBeNull();
	});
});

describe('errorHelpHref', () => {
	it('ведёт на запись справочника', () => {
		expect(errorHelpHref('CRM-1201')).toBe('/help?s=errors#h-crm-1201');
	});
});

describe('errorTextWithCode', () => {
	it('дописывает код в конец текста', () => {
		expect(errorTextWithCode(api(422, 'CRM-1201', 'Не хватает полей'))).toBe('Не хватает полей (CRM-1201)');
	});
	it('без кода — как errorMessage', () => {
		const e = api(422, 'CRM-1001', 'Поле пустое');
		expect(errorTextWithCode(e)).toBe(errorMessage(e));
	});
});

describe('errorMessage', () => {
	it('человеческие тексты известных кодов не изменились', () => {
		expect(errorMessage(api(409, 'CRM-1002'))).toBe('Данные изменил другой пользователь. Обновите страницу и повторите.');
		expect(errorMessage(api(403, 'CRM-1102'))).toBe('Недостаточно прав для этого действия.');
		expect(errorMessage(api(500, 'CRM-9000'))).toBe('Внутренняя ошибка сервера. Попробуйте позже.');
		expect(errorMessage(api(503, 'CRM-9503'))).toBe('Сервис временно недоступен. Попробуйте позже.');
	});
});
