// Русские подписи и группы кодов событий уведомлений. Какие коды вообще настраиваемы (у каких есть активный шаблон) —
// с 25.09 отдаёт `GET /api/notifications/event-codes` (backend-issues A-24; страница настроек, `NotificationSettingsPage.svelte`,
// строит список строк по нему). Тексты для показа бэкенд не отдаёт — только код, поэтому подписи и группировка остаются здесь;
// это же справочник использует `notificationTitle()` для заголовка уведомления по `template_code`, в том числе для уже
// пришедших уведомлений, чей код мог с тех пор перестать быть «активным». Неизвестный код (в том числе только что заведённый на
// бэкенде, но ещё не описанный тут) показывается как есть, группа «Прочее».

export type EventGroup = 'deals' | 'organizations' | 'signing' | 'account' | 'other';

export interface EventCodeInfo {
	code: string;
	label: string;
	group: EventGroup;
	/** Уведомление системное — отключать нельзя (о безопасности учётной записи). */
	locked?: boolean;
	/** Право, без которого событие роли не приходит: строки настроек для остальных не показываются (коды с бэкенда общие для всех ролей). */
	needs?: string;
}

export const EVENT_GROUP_LABELS: Record<EventGroup, string> = {
	deals: 'Сделки',
	organizations: 'Организации',
	signing: 'Подписание',
	account: 'Учётная запись',
	other: 'Прочее'
};

/** Справочник подписей — не список настраиваемых кодов (тот теперь только с бэкенда, см. заголовок файла). */
const EVENT_CODE_LABELS: EventCodeInfo[] = [
	{ code: 'DEAL_REASSIGNED', label: 'Мне назначена сделка', group: 'deals' },
	{ code: 'DEAL_SLA_WARNING', label: 'Истекает срок статуса (SLA)', group: 'deals' },
	{ code: 'DEAL_SLA_BREACHED', label: 'Нарушен срок статуса (SLA)', group: 'deals' },
	{ code: 'DEAL_MENTION', label: 'Меня упомянули в комментарии', group: 'deals' },
	{ code: 'DEAL_EVENT', label: 'События по сделке из воронки', group: 'deals' },
	{ code: 'DEAL_DELETED', label: 'Моя сделка удалена', group: 'deals' },
	{ code: 'USER_OFFBOARD_SUCCESSOR', label: 'Переданы сделки уволенного сотрудника', group: 'deals' },
	{ code: 'ORG_OWNER_ASSIGNED', label: 'Меня назначили ответственным за вуз', group: 'organizations' },
	{ code: 'ORG_OWNER_REMOVED', label: 'Меня сняли с ответственных за вуз', group: 'organizations' },
	{ code: 'ORG_REQUISITES_DRIFT_DETECTED', label: 'Изменились реквизиты организации', group: 'organizations' },
	{ code: 'ORG_DRIFT_APPLIED', label: 'Реквизиты обновлены из ЕГРЮЛ', group: 'organizations' },
	{ code: 'ORG_LIQUIDATION_DETECTED', label: 'Контрагент ликвидируется', group: 'organizations' },
	{ code: 'ACCESS_REQUEST_CREATED', label: 'Запросили доступ к моему вузу', group: 'organizations' },
	{ code: 'ACCESS_REQUEST_APPROVED', label: 'Мой запрос доступа к вузу одобрен', group: 'organizations' },
	{ code: 'ACCESS_REQUEST_REJECTED', label: 'Мой запрос доступа к вузу отклонён', group: 'organizations' },
	{ code: 'SIGNATURE_REQUESTED', label: 'Документ направлен на подпись', group: 'signing' },
	{ code: 'SIGNATURE_DOCUMENT_SIGNED', label: 'Документ подписан', group: 'signing' },
	{ code: 'SIGNATURE_DOCUMENT_REJECTED', label: 'Подписание отклонено', group: 'signing' },
	{ code: 'SIGNATURE_DOCUMENT_EXPIRED', label: 'Истёк срок подписания', group: 'signing' },
	{ code: 'SIGNATURE_AUTO_ADVANCED', label: 'Сделка переведена после подписания', group: 'signing' },
	{ code: 'SIGNATURE_DEADLINE_REMINDER', label: 'Скоро истекает срок подписания', group: 'signing' },
	{ code: 'SIGNATURE_REMINDER_MANUAL', label: 'Напоминание о подписании', group: 'signing' },
	{ code: 'SIGNATURE_OTP_LOCKED', label: 'Запрос на подпись заблокирован (неверный код)', group: 'signing' },
	{ code: 'EDM_AGREEMENT_MISSING', label: 'Нет соглашения об ЭДО', group: 'signing' },
	{ code: 'SECURITY_INCIDENT_CANDIDATE', label: 'Новый кандидат в инциденты безопасности', group: 'account', needs: 'incident:manage' },
	{ code: 'SECURITY_INCIDENT_DEADLINE', label: 'Срок уведомления об инциденте истекает', group: 'account', needs: 'incident:manage' },
	{ code: 'USER_PASSWORD_CHANGED', label: 'Пароль изменён', group: 'account', locked: true },
	{ code: 'USER_PASSWORD_RESET', label: 'Пароль сброшен администратором', group: 'account', locked: true },
	{ code: 'USER_ACCOUNT_BLOCKED', label: 'Учётная запись заблокирована', group: 'account', locked: true },
	{ code: 'USER_ACCOUNT_UNBLOCKED', label: 'Учётная запись разблокирована', group: 'account', locked: true },
	{ code: 'USER_ROLE_CHANGED', label: 'Изменена роль', group: 'account', locked: true },
	{ code: 'USER_INVITE_EXPIRED', label: 'Приглашение не принято за 30 дней', group: 'account' },
	{ code: 'ERASURE_REQUEST_BLOCKED', label: 'Запрос на удаление данных заблокирован', group: 'account' },
	{ code: 'ERASURE_ACT_NO_SIGNER', label: 'Для акта удаления данных нет подписанта', group: 'account' },
	{ code: 'ERASURE_COMPLETED', label: 'Запрос на удаление данных исполнен', group: 'account' }
];

const BY_CODE = new Map(EVENT_CODE_LABELS.map((e) => [e.code, e]));

export function eventCodeInfo(code: string): EventCodeInfo {
	return BY_CODE.get(code) ?? { code, label: code, group: 'other' };
}

/** Куда вести по типу объекта уведомления. Подпись — маршруты агента C: запрос `/signing/requests/{id}`, документ `/signing/{id}`. */
export function entityHref(entityType: string | null | undefined, entityId: string | null | undefined): string | null {
	if (!entityType || !entityId) return null;
	switch (entityType) {
		case 'deal':
			return `/deals/${entityId}`;
		case 'organization':
			return `/organizations/${entityId}`;
		case 'contact':
			return `/contacts/${entityId}`;
		case 'access_request':
			return '/access-requests';
		case 'task':
			return `/tasks?task=${entityId}`;
		case 'signature_request':
			return `/signing/requests/${entityId}`;
		case 'signature_document':
			return `/signing/${entityId}`;
		case 'security_incident':
			return `/admin/incidents/${entityId}`;
		case 'data_erasure_request':
			return `/admin/erasure/${entityId}`;
		default:
			return null;
	}
}

/** Во «Входящие» / «Мои запросы» со строкой этой заявки: id — `payload.access_request_id`; у старых уведомлений его нет — тот же список без подсветки. */
function accessRequestHref(box: 'inbox' | 'mine', n: { payload?: Record<string, unknown> | null }): string {
	const id = n.payload?.access_request_id;
	return typeof id === 'string' && id ? `/access-requests?box=${box}&highlight=${encodeURIComponent(id)}` : `/access-requests?box=${box}`;
}

export interface NotificationLinkSource {
	template_code: string;
	entity_type: string | null;
	entity_id: string | null;
	payload?: Record<string, unknown> | null;
}

export interface NotificationLinkContext {
	/** кто смотрит: уведомление про собственную учётную запись ведёт в профиль */
	meId?: string | null;
	can?: (permission: string) => boolean;
}

/**
 * Куда вести из уведомления. Решает код события, а не только тип объекта: у одного и того же `organization` запрос доступа ведёт во «Входящие»
 * (решение принимается там, не в карточке вуза), а у `signature_request` напоминание инициатору — не на экран подписи чужого запроса.
 * Не нашлось, куда вести, — `null` (строка только отмечается прочитанной).
 */
export function notificationHref(n: NotificationLinkSource, ctx: NotificationLinkContext = {}): string | null {
	switch (n.template_code) {
		// решение принимает владелец вуза/руководитель — во входящих запросах, а не в карточке вуза
		case 'ACCESS_REQUEST_CREATED':
			return accessRequestHref('inbox', n);
		case 'ACCESS_REQUEST_APPROVED':
		case 'ACCESS_REQUEST_REJECTED':
			return accessRequestHref('mine', n);
		// кандидатов может быть несколько — открываем список кандидатов; по сроку — карточку инцидента
		case 'SECURITY_INCIDENT_CANDIDATE':
			return '/admin/incidents?status=candidate';
		// эти уведомления получает инициатор, а `entity_id` — запрос подписанта: «Подписать» ему не открыть (404), ведём к документам
		case 'SIGNATURE_OTP_LOCKED':
		case 'SIGNATURE_REMINDER_MANUAL':
			return '/signing?tab=docs';
		case 'EDM_AGREEMENT_MISSING': {
			const doc = n.payload?.document_id;
			return n.entity_id ? entityHref(n.entity_type, n.entity_id) : typeof doc === 'string' ? `/signing/${doc}` : '/signing?tab=docs';
		}
		// массовая передача: объекта нет, но есть список «моих»
		case 'USER_OFFBOARD_SUCCESSOR':
			return '/deals';
	}
	if (n.entity_type === 'user' && n.entity_id) {
		if (n.entity_id === ctx.meId) return '/profile';
		return ctx.can?.('user:read') ? `/admin/users/${n.entity_id}` : null;
	}
	if (!n.entity_id && n.template_code === 'ORG_OWNER_ASSIGNED') return '/organizations';
	return entityHref(n.entity_type, n.entity_id);
}
