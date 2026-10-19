import { describe, expect, it } from 'vitest';
import { deliveryErrorText, disabledReasonText, eventTitle, outboxEventTitle, parseFilters, pingText, urlLabel, validateSubscription } from './subscriptions';

const base = { name: 'Учётная система', url: 'https://hooks.example.edu/crm', events: ['DEAL_CREATED'], filtersText: '' };

describe('validateSubscription', () => {
	it('валидная форма — без ошибок', () => {
		expect(validateSubscription(base, { prod: true })).toEqual({});
	});
	it('пустое имя, адрес без схемы, пустой список событий', () => {
		expect(validateSubscription({ ...base, name: '  ' }, { prod: false }).name).toBeTruthy();
		expect(validateSubscription({ ...base, url: 'hooks.example.edu' }, { prod: false }).url).toBeTruthy();
		expect(validateSubscription({ ...base, url: '' }, { prod: false }).url).toBeTruthy();
		expect(validateSubscription({ ...base, events: [] }, { prod: false }).events).toBeTruthy();
	});
	it('http: допустим только вне prod', () => {
		const form = { ...base, url: 'http://hooks.example.edu/crm' };
		expect(validateSubscription(form, { prod: false }).url).toBeUndefined();
		expect(validateSubscription(form, { prod: true }).url).toMatch(/https/);
	});
	it('ftp: и javascript: не проходят', () => {
		expect(validateSubscription({ ...base, url: 'ftp://x/y' }, { prod: false }).url).toBeTruthy();
		expect(validateSubscription({ ...base, url: 'javascript:alert(1)' }, { prod: false }).url).toBeTruthy();
	});
	it('кривой JSON фильтров', () => {
		expect(validateSubscription({ ...base, filtersText: '{oops' }, { prod: false }).filters).toBeTruthy();
	});
});

describe('parseFilters', () => {
	it('пусто — пустой объект, объект проходит, массив и скаляр нет, больше 10 ключей нет', () => {
		expect(parseFilters('')).toEqual({ value: {} });
		expect(parseFilters('{"deal_type":"b2c"}')).toEqual({ value: { deal_type: 'b2c' } });
		expect(parseFilters('[1]').error).toBeTruthy();
		expect(parseFilters('5').error).toBeTruthy();
		const many = JSON.stringify(Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`k${i}`, 1])));
		expect(parseFilters(many).error).toBeTruthy();
	});
});

describe('outboxEventTitle — журнал исходящих без сырых кодов', () => {
	it('события подписок и служебные подписаны по-русски, незнакомый код остаётся как есть', () => {
		expect(outboxEventTitle('DEAL_STATUS_CHANGED')).toBe('Статус сделки изменён');
		expect(outboxEventTitle('LEARNING_ENROLLMENT_SENT')).toBe('Зачисление в LMS отправлено');
		expect(outboxEventTitle('ERASURE_REQUESTED')).toBe('Запрошено удаление данных');
		expect(outboxEventTitle('SOMETHING_NEW')).toBe('SOMETHING_NEW');
	});
});

describe('eventTitle / urlLabel', () => {
	it('известный код — по-русски, неизвестный — как есть', () => {
		expect(eventTitle('DOCUMENT_SIGNED')).toBe('Документ подписан');
		expect(eventTitle('SOMETHING_NEW')).toBe('SOMETHING_NEW');
	});
	it('адрес без query, логина и пароля', () => {
		expect(urlLabel('https://user:pass@hooks.example.edu/crm/in?token=abc#x')).toBe('hooks.example.edu/crm/in');
		expect(urlLabel('https://hooks.example.edu/')).toBe('hooks.example.edu');
		expect(urlLabel('не адрес')).toBe('не адрес');
	});
});

describe('тексты ошибок', () => {
	it('last_error доставки', () => {
		expect(deliveryErrorText('http_503')).toBe('Получатель ответил кодом 503');
		expect(deliveryErrorText('request_failed:ConnectTimeout')).toBe('Нет ответа за 10 секунд');
		expect(deliveryErrorText('request_failed:ConnectError')).toMatch(/соединиться/);
		expect(deliveryErrorText('request_failed:ValueError')).toMatch(/безопасности/);
		expect(deliveryErrorText(null)).toBeNull();
	});
	it('причины выключения', () => {
		expect(disabledReasonText('gone_410')).toMatch(/410/);
		expect(disabledReasonText('too_many_failures')).toMatch(/20/);
		expect(disabledReasonText(null)).toBeNull();
	});
	it('результат PING', () => {
		expect(pingText({ status_code: 200, elapsed_ms: 12.4 })).toEqual({ ok: true, text: 'Получатель ответил 200 за 12 мс' });
		expect(pingText({ status_code: 500, elapsed_ms: 40 }).ok).toBe(false);
		expect(pingText({ status_code: null, elapsed_ms: 5, error: 'ConnectError' }).text).toMatch(/соединиться/);
	});
});
