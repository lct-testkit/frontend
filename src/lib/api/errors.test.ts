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

describe('errorMessage — экран ошибки без внутренностей бэкенда (QA2 Н9)', () => {
	it('«не найден» согласуется по роду и не показывает идентификатор', () => {
		const id = '00000000-0000-7000-8000-000000000000';
		expect(errorMessage(api(404, 'CRM-9004', `Сделка не найден: ${id}`))).toMatch(/^Сделка не найдена\. /);
		expect(errorMessage(api(404, 'CRM-9004', `Контакт не найден: ${id}`))).toMatch(/^Контакт не найден\. /);
		expect(errorMessage(api(404, 'CRM-9004', `Лицензия не найден: ${id}`))).toMatch(/^Лицензия не найдена\. /);
		expect(errorMessage(api(404, 'CRM-9004', `Сделка не найден: ${id}`))).not.toMatch(/0000/);
		expect(errorMessage(new ApiError({ status: 404, detail: 'Not Found' }))).toBe('Страница или запись не найдена. Проверьте адрес.');
	});
	it('английская проверка полей бэкенда — по-русски, имя поля из схемы скрыто', () => {
		const e = new ApiError({ status: 422, errors: [{ field: 'organization_id', reason: 'Input should be a valid UUID, invalid character: found `n` at 1' }] });
		expect(errorMessage(e)).toBe('Неверная ссылка: идентификатор записи указан с ошибкой.');
		expect(errorMessage(new ApiError({ status: 422, errors: [{ field: 'q', reason: 'String should have at least 3 characters' }] }))).toBe('Слишком коротко: не меньше 3 символов.');
		expect(errorMessage(new ApiError({ status: 422, errors: [{ field: 'q', reason: 'Что-то непонятное' }] }))).toBe('Что-то непонятное');
		expect(errorMessage(new ApiError({ status: 422, errors: [{ field: 'x', reason: 'weird english' }] }))).toBe('Недопустимое значение.');
	});
});

describe('ApiError.fieldErrors — английские тексты бэкенда переводятся', () => {
	it('«value is not a valid email address» → русская подсказка, русский текст бэкенда без изменений', () => {
		const e = new ApiError({
			status: 422,
			errors: [
				{ field: 'email', reason: 'value is not a valid email address: An email address must have an @-sign.' },
				{ field: 'name', reason: 'Укажите ФИО' }
			]
		});
		expect(e.fieldErrors()).toEqual({ email: 'Некорректный адрес почты.', name: 'Укажите ФИО' });
		expect(e.fieldError('email')).toBe('Некорректный адрес почты.');
	});
});
