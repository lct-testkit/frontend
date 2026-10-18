// Куда вести из строки журнала безопасности: к источнику во «Входящих», к карточке сотрудника или в журнал аудита.

export interface EventLink {
	href: string;
	label: string;
}

export function eventLink(e: { event_type: string; user_id?: string | null; details?: Record<string, unknown> | null }): EventLink | null {
	switch (e.event_type) {
		case 'INTEGRATION_SIGNATURE_INVALID': {
			const source = typeof e.details?.source === 'string' ? e.details.source : null;
			return { href: `/admin/integrations?tab=inbound${source ? `&source=${encodeURIComponent(source)}` : ''}`, label: 'Во «Входящих»' };
		}
		case 'PASSWORD_RESET':
		case 'PERMISSION_DENIED':
			return e.user_id ? { href: `/admin/users/${e.user_id}`, label: 'Карточка сотрудника' } : null;
		case 'MASS_EXPORT':
			return { href: '/admin/audit?action=AUDIT_EXPORTED', label: 'Журнал аудита' };
		default:
			return null;
	}
}
