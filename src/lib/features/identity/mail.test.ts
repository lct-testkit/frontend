import { describe, expect, it } from 'vitest';
import { inviteMailStatus, mailLabel, mailText, mailTone } from './mail';

describe('mailText: статус × причина', () => {
	it('отправлено и в очереди — без причины, даже если она пришла', () => {
		expect(mailText('sent')).toBe('Письмо передано почтовому серверу');
		expect(mailText('sent', 'smtp_missing')).toBe('Письмо передано почтовому серверу');
		expect(mailText('queued')).toBe('Письмо в очереди');
	});
	it('не отправлено: каждая известная причина по-русски', () => {
		expect(mailText('not_sent', 'smtp_missing')).toBe('Письмо не отправлено: почта не настроена на сервере');
		expect(mailText('not_sent', 'keycloak_smtp_missing')).toBe('Письмо не отправлено: в Keycloak не настроена почта');
		expect(mailText('not_sent', 'no_address')).toBe('Письмо не отправлено: у получателя не указан адрес');
		expect(mailText('not_sent', 'send_failed')).toBe('Письмо не отправлено: почтовый сервер не принял письмо');
	});
	it('неизвестная причина — как есть, нет причины — только статус', () => {
		expect(mailText('not_sent', 'quota')).toBe('Письмо не отправлено: quota');
		expect(mailText('not_sent')).toBe('Письмо не отправлено');
		expect(mailText('not_sent', null)).toBe('Письмо не отправлено');
	});
});

describe('тон и флаг приглашения', () => {
	it('«не отправлено» — предупреждение, не ошибка', () => {
		expect(mailTone('not_sent')).toBe('warning');
		expect(mailTone('sent')).toBe('success');
		expect(mailLabel('queued')).toBe('Письмо в очереди');
	});
	it('invite_email_sent → статус', () => {
		expect(inviteMailStatus(true)).toBe('sent');
		expect(inviteMailStatus(false)).toBe('not_sent');
		expect(inviteMailStatus(undefined)).toBe('not_sent');
	});
});
