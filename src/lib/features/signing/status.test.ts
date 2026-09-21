import { describe, expect, it } from 'vitest';
import {
	docStatusMeta,
	documentActions,
	edmState,
	externalNotFirstWarning,
	requestStatusMeta,
	signerProgress,
	verifyStatusMeta
} from './status';

describe('status meta', () => {
	it('знает все статусы документа и запроса', () => {
		expect(docStatusMeta('signed')).toMatchObject({ label: 'Подписан', tone: 'success', terminal: true });
		expect(docStatusMeta('blocked_no_agreement').terminal).toBe(false);
		expect(requestStatusMeta('viewed').open).toBe(true);
		expect(requestStatusMeta('locked')).toMatchObject({ tone: 'error', open: false });
	});

	it('не падает на неизвестном статусе', () => {
		expect(docStatusMeta('weird')).toMatchObject({ label: 'weird', tone: 'neutral' });
		expect(verifyStatusMeta('nope').title).toBe('Статус неизвестен');
	});
});

describe('signerProgress', () => {
	it('находит текущего подписанта по порядку', () => {
		const p = signerProgress([
			{ sign_order: 2, status: 'sent', name: 'Б' },
			{ sign_order: 1, status: 'signed', name: 'А' },
			{ sign_order: 3, status: 'pending', name: 'В' }
		]);
		expect(p).toMatchObject({ total: 3, signed: 1, rejected: 0, done: false });
		expect(p.current?.name).toBe('Б');
	});

	it('done, когда все терминальны', () => {
		const p = signerProgress([
			{ sign_order: 1, status: 'signed' },
			{ sign_order: 2, status: 'void' }
		]);
		expect(p.done).toBe(true);
		expect(p.current).toBeNull();
	});
});

describe('documentActions', () => {
	const all = { create: true, void: true };
	it('черновик — отправить и аннулировать', () => {
		expect(documentActions('draft', all)).toMatchObject({ canSend: true, canVoid: true, canProtocol: false });
	});
	it('без соглашения — отправить повторно + подсказка', () => {
		expect(documentActions('blocked_no_agreement', all)).toMatchObject({ canSend: true, needsAgreement: true });
	});
	it('KAM не аннулирует, но может пересоздать после отказа', () => {
		const kam = documentActions('rejected', { create: true, void: false });
		expect(kam).toMatchObject({ canVoid: false, canRecreate: true, canSend: false });
	});
	it('подписанный — только протокол', () => {
		expect(documentActions('signed', all)).toMatchObject({ canProtocol: true, canVoid: false, canSend: false });
	});
});

describe('externalNotFirstWarning', () => {
	it('предупреждает, когда внешний не первый в последовательной цепочке', () => {
		expect(externalNotFirstWarning([{ type: 'internal' }, { type: 'external' }], 'sequential')).toBe(true);
		expect(externalNotFirstWarning([{ type: 'external' }, { type: 'internal' }], 'sequential')).toBe(false);
		expect(externalNotFirstWarning([{ type: 'internal' }, { type: 'external' }], 'parallel')).toBe(false);
	});
});

describe('edmState', () => {
	const now = new Date(2026, 8, 20, 12, 0);
	it('отозвано важнее сроков', () => {
		expect(edmState({ status: 'active', revoked_at: '2026-09-01T10:00:00Z', valid_to: '2030-01-01' }, now)).toBe('revoked');
		expect(edmState({ status: 'revoked' }, now)).toBe('revoked');
	});
	it('срок считается по календарным дням, последний день ещё действует', () => {
		expect(edmState({ status: 'active', valid_to: '2026-09-20' }, now)).toBe('active');
		expect(edmState({ status: 'active', valid_to: '2026-09-19' }, now)).toBe('expired');
		expect(edmState({ status: 'expired' }, now)).toBe('expired');
	});
	it('ещё не начало действовать и бессрочное', () => {
		expect(edmState({ status: 'active', valid_from: '2026-09-21' }, now)).toBe('upcoming');
		expect(edmState({ status: 'active' }, now)).toBe('active');
	});
});
