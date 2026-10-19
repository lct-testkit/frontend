import { describe, expect, it } from 'vitest';
import { errorBackLink } from './error-back';

describe('errorBackLink', () => {
	it('карточка → список своего раздела, самый длинный префикс побеждает', () => {
		expect(errorBackLink('/deals/0000')).toEqual({ label: 'К списку сделок', href: '/deals' });
		expect(errorBackLink('/reports/dashboards/abc')).toEqual({ label: 'К дашбордам', href: '/reports/dashboards' });
		expect(errorBackLink('/admin/users/1')).toEqual({ label: 'К списку пользователей', href: '/admin/users' });
	});
	it('сам список и неизвестные адреса → на главную', () => {
		expect(errorBackLink('/deals')).toEqual({ label: 'На главную', href: '/' });
		expect(errorBackLink('/admin/settings')).toEqual({ label: 'На главную', href: '/' });
	});
});
