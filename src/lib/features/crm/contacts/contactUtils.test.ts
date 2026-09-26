import { describe, expect, it } from 'vitest';
import { ApiError } from '$lib/api';
import type { Contact } from '../types';
import { duplicateCandidates, emptyContactForm, formFromContact, isMasked, toCreateBody, toPatchBody, validateContact } from './contactUtils';

const contact = {
	id: '1',
	first_name: 'Ринат',
	last_name: 'Ахметов',
	middle_name: null,
	position: 'Проректор',
	email: 'r***@kgtu.ru',
	phone: '+7 (9**) ***-**-67',
	is_decision_maker: true,
	is_anonymized: false,
	organization_id: 'o1',
	external_ids: {},
	version: 1,
	created_at: '',
	updated_at: ''
} as Contact;

describe('контакты: маски', () => {
	it('распознаёт маску', () => {
		expect(isMasked('+7 (9**) ***-**-67')).toBe(true);
		expect(isMasked('a@b.ru')).toBe(false);
	});
	it('маскированные e-mail и телефон никогда не уходят в PATCH', () => {
		const base = formFromContact(contact);
		expect(toPatchBody(base, { ...base, position: 'Ректор' })).toEqual({ position: 'Ректор' });
		expect(toPatchBody(base, { ...base, email: 'x***@y.ru' })).toEqual({});
		expect(toPatchBody(base, { ...base, phone: '+79990000000' })).toEqual({ phone: '+79990000000' });
	});
});

describe('контакты: создание и проверка', () => {
	it('в тело попадают только заполненные каналы', () => {
		const body = toCreateBody({
			...emptyContactForm('o1'),
			last_name: ' Иванов ',
			first_name: 'Иван',
			channels: [
				{ type: 'telegram', value: '@ivan', is_primary: true },
				{ type: 'whatsapp', value: '  ', is_primary: false }
			]
		});
		expect(body.last_name).toBe('Иванов');
		expect(body.organization_id).toBe('o1');
		expect(body.channels).toEqual([{ type: 'telegram', value: '@ivan', is_primary: true }]);
	});
	it('обязательны фамилия и имя, почта и телефон проверяются мягко', () => {
		expect(validateContact(emptyContactForm())).toEqual({ last_name: 'Введите фамилию', first_name: 'Введите имя' });
		const bad = validateContact({ ...emptyContactForm(), last_name: 'А', first_name: 'Б', email: 'нет', phone: '123' });
		expect(Object.keys(bad).sort()).toEqual(['email', 'phone']);
		expect(validateContact({ ...emptyContactForm(), last_name: 'А', first_name: 'Б', email: 'i***@a.ru', phone: '+7 (9**) ***-**-67' })).toEqual({});
	});
});

describe('duplicateCandidates (409 CRM-1301)', () => {
	const conflict = (candidates: unknown) => new ApiError({ status: 409, code: 'CRM-1301', extra: { candidates } });

	it('доступный дубль — с id, чужой — без него', () => {
		const found = duplicateCandidates(conflict([{ id: 'a1', match: 'email', accessible: true }, { id: null, match: 'phone', accessible: false }]));
		expect(found).toEqual([
			{ id: 'a1', name: undefined, accessible: true },
			{ id: null, name: undefined, accessible: false }
		]);
	});

	it('id без признака доступа не считается доступным', () => {
		expect(duplicateCandidates(conflict([{ id: 'a1', accessible: false }]))?.[0].accessible).toBe(false);
	});

	it('дубль без описания кандидатов — пустой список, а не «не дубль»', () => {
		expect(duplicateCandidates(new ApiError({ status: 409, code: 'CRM-1301' }))).toEqual([]);
	});

	it('другие ошибки — не дубль', () => {
		expect(duplicateCandidates(new ApiError({ status: 409, code: 'CRM-1002' }))).toBeNull();
		expect(duplicateCandidates(new Error('x'))).toBeNull();
	});
});
