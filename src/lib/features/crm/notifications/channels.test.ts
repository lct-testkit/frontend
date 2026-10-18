import { describe, expect, it } from 'vitest';
import { CHANNELS, canToggle, channelState, visibleChannels, type Capabilities } from './channels';

const CAPS: Record<string, Capabilities | null> = { 'smtp: true': { smtp: true }, 'smtp: false': { smtp: false }, 'неизвестно': null };

describe('channelState: три канала × три состояния возможностей', () => {
	it('в приложении доступен всегда', () => {
		for (const caps of Object.values(CAPS)) expect(channelState('in_app', caps)).toMatchObject({ available: true, note: null });
	});
	it('Telegram недоступен при любых возможностях без явного telegram: true', () => {
		for (const caps of Object.values(CAPS)) {
			const s = channelState('telegram', caps);
			expect(s.available).toBe(false);
			expect(s.label).toBe('Telegram (не подключён)');
		}
		expect(channelState('telegram', { telegram: true })).toMatchObject({ available: true, label: 'Telegram' });
		expect(channelState('telegram', { telegram: false }).available).toBe(false);
	});
	it('почта: работает, не настроена, неизвестно', () => {
		expect(channelState('email', CAPS['smtp: true'])).toMatchObject({ available: true, label: 'E-mail', note: null });
		expect(channelState('email', CAPS['smtp: false'])).toMatchObject({ available: false, label: 'E-mail (почта не настроена)' });
		const unknown = channelState('email', null);
		expect(unknown.available).toBe('unknown');
		expect(unknown.label).toBe('E-mail');
		expect(unknown.note).not.toMatch(/не настроен/);
	});
});

describe('canToggle', () => {
	it('Telegram нельзя включить, но сохранённый можно выключить; почта выбирается всегда', () => {
		expect(canToggle('telegram', false, null)).toBe(false);
		expect(canToggle('telegram', true, null)).toBe(true);
		expect(canToggle('telegram', false, { telegram: true })).toBe(true);
		expect(canToggle('email', false, { smtp: false })).toBe(true);
		expect(canToggle('in_app', false, null)).toBe(true);
	});
});

describe('visibleChannels', () => {
	it('сохранённый Telegram остаётся в строке и уходит на сервер как есть', () => {
		const row = { channels: ['in_app', 'telegram'] };
		expect(visibleChannels(row)).toEqual(['in_app', 'telegram']);
		expect(CHANNELS).toContain('telegram');
	});
});
