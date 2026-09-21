// Каталог кодов событий уведомлений для страницы настроек (`PUT /api/me/notification-prefs`).
// Бэкенд не отдаёт список кодов не-администратору (шаблоны — только `/admin/notification-templates`), поэтому
// список зеркалит backend/app/modules/notification/seed.py и коды, которые вызываются из crm/catalog/registry/signing.
// Неизвестный код из уже сохранённых настроек показывается как есть (группа «Прочее»).

export type EventGroup = 'deals' | 'organizations' | 'signing' | 'account' | 'other';

export interface EventCodeInfo {
	code: string;
	label: string;
	group: EventGroup;
	/** Уведомление системное — отключать нельзя (о безопасности учётной записи). */
	locked?: boolean;
}

export const EVENT_GROUP_LABELS: Record<EventGroup, string> = {
	deals: 'Сделки',
	organizations: 'Организации',
	signing: 'Подписание',
	account: 'Учётная запись',
	other: 'Прочее'
};

export const EVENT_CODES: EventCodeInfo[] = [
	{ code: 'DEAL_REASSIGNED', label: 'Мне назначена сделка', group: 'deals' },
	{ code: 'DEAL_SLA_WARNING', label: 'Истекает срок статуса (SLA)', group: 'deals' },
	{ code: 'DEAL_SLA_BREACHED', label: 'Нарушен срок статуса (SLA)', group: 'deals' },
	{ code: 'DEAL_EVENT', label: 'События по сделке из воронки', group: 'deals' },
	{ code: 'USER_OFFBOARD_SUCCESSOR', label: 'Переданы сделки уволенного сотрудника', group: 'deals' },
	{ code: 'ORG_REQUISITES_DRIFT_DETECTED', label: 'Изменились реквизиты организации', group: 'organizations' },
	{ code: 'ORG_DRIFT_APPLIED', label: 'Реквизиты обновлены из ЕГРЮЛ', group: 'organizations' },
	{ code: 'ORG_LIQUIDATION_DETECTED', label: 'Контрагент ликвидируется', group: 'organizations' },
	{ code: 'SIGNATURE_REQUESTED', label: 'Документ направлен на подпись', group: 'signing' },
	{ code: 'SIGNATURE_DOCUMENT_SIGNED', label: 'Документ подписан', group: 'signing' },
	{ code: 'SIGNATURE_DOCUMENT_REJECTED', label: 'Подписание отклонено', group: 'signing' },
	{ code: 'SIGNATURE_DOCUMENT_EXPIRED', label: 'Истёк срок подписания', group: 'signing' },
	{ code: 'SIGNATURE_OTP_LOCKED', label: 'Запрос на подпись заблокирован (неверный код)', group: 'signing' },
	{ code: 'EDM_AGREEMENT_MISSING', label: 'Нет соглашения об ЭДО', group: 'signing' },
	{ code: 'USER_PASSWORD_CHANGED', label: 'Пароль изменён', group: 'account', locked: true },
	{ code: 'USER_PASSWORD_RESET', label: 'Пароль сброшен администратором', group: 'account', locked: true },
	{ code: 'USER_ACCOUNT_BLOCKED', label: 'Учётная запись заблокирована', group: 'account', locked: true },
	{ code: 'USER_ACCOUNT_UNBLOCKED', label: 'Учётная запись разблокирована', group: 'account', locked: true },
	{ code: 'USER_ROLE_CHANGED', label: 'Изменена роль', group: 'account', locked: true },
	{ code: 'ERASURE_REQUEST_BLOCKED', label: 'Запрос на удаление данных заблокирован', group: 'account' },
	{ code: 'ERASURE_COMPLETED', label: 'Запрос на удаление данных исполнен', group: 'account' }
];

const BY_CODE = new Map(EVENT_CODES.map((e) => [e.code, e]));

export function eventCodeInfo(code: string): EventCodeInfo {
	return BY_CODE.get(code) ?? { code, label: code, group: 'other' };
}

/** Куда вести из уведомления (`entity_type` → маршрут). Подпись — маршруты агента C: запрос `/signing/requests/{id}`, документ `/signing/{id}`. */
export function entityHref(entityType: string | null | undefined, entityId: string | null | undefined): string | null {
	if (!entityType || !entityId) return null;
	switch (entityType) {
		case 'deal':
			return `/deals/${entityId}`;
		case 'organization':
			return `/organizations/${entityId}`;
		case 'contact':
			return `/contacts/${entityId}`;
		case 'task':
			return `/tasks?task=${entityId}`;
		case 'signature_request':
			return `/signing/requests/${entityId}`;
		case 'signature_document':
			return `/signing/${entityId}`;
		default:
			return null;
	}
}
