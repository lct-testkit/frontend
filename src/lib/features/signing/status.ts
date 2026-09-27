import type {
	DocType,
	DocumentStatus,
	EdmConclusionMethod,
	EdmPartyType,
	OtpChannel,
	RequestStatus,
	SignerLike,
	StatusMeta,
	VerifyStatus
} from './types';

const DOC_STATUS: Record<DocumentStatus, StatusMeta & { terminal: boolean }> = {
	draft: { label: 'Черновик', tone: 'neutral', terminal: false },
	pending: { label: 'На подписании', tone: 'info', terminal: false },
	partially_signed: { label: 'Частично подписан', tone: 'info', terminal: false },
	signed: { label: 'Подписан', tone: 'success', terminal: true },
	rejected: { label: 'Отклонён', tone: 'error', terminal: true },
	expired: { label: 'Срок истёк', tone: 'warning', terminal: true },
	void: { label: 'Аннулирован', tone: 'neutral', terminal: true },
	blocked_no_agreement: { label: 'Нет соглашения об ЭДО', tone: 'warning', terminal: false }
};

const REQUEST_STATUS: Record<RequestStatus, StatusMeta & { open: boolean }> = {
	pending: { label: 'Ожидает очереди', tone: 'neutral', open: true },
	sent: { label: 'Отправлено', tone: 'info', open: true },
	viewed: { label: 'Ознакомлен', tone: 'info', open: true },
	signed: { label: 'Подписал', tone: 'success', open: false },
	rejected: { label: 'Отклонил', tone: 'error', open: false },
	expired: { label: 'Срок истёк', tone: 'warning', open: false },
	locked: { label: 'Заблокирован', tone: 'error', open: false },
	void: { label: 'Аннулирован', tone: 'neutral', open: false }
};

const VERIFY_STATUS: Record<VerifyStatus, StatusMeta & { title: string; hint: string }> = {
	valid: {
		label: 'Действительна',
		tone: 'success',
		title: 'Подпись действительна',
		hint: 'Документ подписан простой электронной подписью, запись не изменялась.'
	},
	disputed: {
		label: 'Оспорена',
		tone: 'warning',
		title: 'Подпись оспорена',
		hint: 'Подпись поставлена незадолго до компрометации ключа подписанта и помечена для разбора.'
	},
	void: {
		label: 'Аннулирована',
		tone: 'neutral',
		title: 'Документ аннулирован',
		hint: 'Подпись была поставлена, но документ позже аннулирован инициатором.'
	},
	hash_mismatch: {
		label: 'Не совпадает',
		tone: 'error',
		title: 'Файл не совпадает ни с одной подписью',
		hint: 'Подойдёт как исходный документ, так и штампованная копия («Контейнер подписи») — а вот протокол подписания не годится, его хэш здесь не проверяется.'
	},
	tampered: {
		label: 'Целостность нарушена',
		tone: 'error',
		title: 'Данные подписи не совпадают с записью',
		hint: 'Метка целостности или цепочка подписей не сходится: запись могли изменить. Сообщите администратору.'
	},
	not_found: {
		label: 'Не найдена',
		tone: 'error',
		title: 'Подпись не найдена',
		hint: 'Проверьте идентификатор: подписи с таким номером в системе нет.'
	}
};

const DOC_TYPE: Record<DocType, string> = {
	kp: 'Коммерческое предложение',
	act: 'Акт',
	consent: 'Согласие на обработку ПДн',
	erasure_act: 'Акт об уничтожении ПДн',
	offer: 'Оферта',
	custom: 'Документ'
};

const OTP_CHANNEL: Record<OtpChannel, string> = { sms: 'СМС', email: 'эл. почту', telegram: 'Telegram' };

const EDM_PARTY: Record<EdmPartyType, string> = {
	organization: 'Организация',
	contact: 'Контакт',
	user: 'Сотрудник'
};

const EDM_METHOD: Record<EdmConclusionMethod, string> = {
	paper: 'На бумаге',
	ukep: 'УКЭП',
	offer_acceptance: 'Акцепт оферты',
	employment: 'Трудовые отношения'
};

const UNKNOWN: StatusMeta = { label: '—', tone: 'neutral' };

export function docStatusMeta(status: string): StatusMeta & { terminal: boolean } {
	return DOC_STATUS[status as DocumentStatus] ?? { ...UNKNOWN, label: status, terminal: false };
}

export function requestStatusMeta(status: string): StatusMeta & { open: boolean } {
	return REQUEST_STATUS[status as RequestStatus] ?? { ...UNKNOWN, label: status, open: false };
}

export function verifyStatusMeta(status: string): StatusMeta & { title: string; hint: string } {
	return (
		VERIFY_STATUS[status as VerifyStatus] ?? {
			...UNKNOWN,
			label: status,
			title: 'Статус неизвестен',
			hint: ''
		}
	);
}

export const docTypeLabel = (type: string): string => DOC_TYPE[type as DocType] ?? 'Документ';
export const otpChannelLabel = (channel: string): string =>
	OTP_CHANNEL[channel as OtpChannel] ?? channel;
export const edmPartyLabel = (type: string): string => EDM_PARTY[type as EdmPartyType] ?? type;
export const edmMethodLabel = (method: string): string =>
	EDM_METHOD[method as EdmConclusionMethod] ?? method;

export type EdmState = 'active' | 'upcoming' | 'expired' | 'revoked';

const EDM_STATE: Record<EdmState, StatusMeta> = {
	active: { label: 'Действует', tone: 'success' },
	upcoming: { label: 'Ещё не действует', tone: 'info' },
	expired: { label: 'Срок истёк', tone: 'neutral' },
	revoked: { label: 'Отозвано', tone: 'error' }
};

const localDay = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Состояние соглашения: бэкенд хранит `active|expired|revoked`, а «истекло» и «ещё не действует» вытекают из дат (как в `find_active_for_contact`). */
export function edmState(
	a: { status: string; revoked_at?: string | null; valid_from?: string | null; valid_to?: string | null },
	now: Date = new Date()
): EdmState {
	if (a.status === 'revoked' || a.revoked_at) return 'revoked';
	const today = localDay(now);
	if (a.status === 'expired' || (a.valid_to && a.valid_to.slice(0, 10) < today)) return 'expired';
	if (a.valid_from && a.valid_from.slice(0, 10) > today) return 'upcoming';
	return 'active';
}

export const edmStateMeta = (state: EdmState): StatusMeta => EDM_STATE[state];

export const isRequestOpen = (status: string): boolean => requestStatusMeta(status).open;

export interface SignerProgress {
	total: number;
	signed: number;
	rejected: number;
	/** Чья очередь сейчас (первый по порядку среди sent/viewed), либо null. */
	current: SignerLike | null;
	/** Все терминальны — подписать больше некому. */
	done: boolean;
}

/** Сводка по подписантам для шкалы прогресса и подсказки «ждём …». */
export function signerProgress(signers: readonly SignerLike[]): SignerProgress {
	const sorted = [...signers].sort((a, b) => a.sign_order - b.sign_order);
	const signed = sorted.filter((s) => s.status === 'signed').length;
	const rejected = sorted.filter((s) => s.status === 'rejected').length;
	const current =
		sorted.find((s) => s.status === 'sent' || s.status === 'viewed') ??
		sorted.find((s) => s.status === 'pending') ??
		null;
	const done = sorted.every((s) => !isRequestOpen(s.status));
	return { total: sorted.length, signed, rejected, current, done };
}

export interface DocumentPermissions {
	create: boolean;
	void: boolean;
}

export interface DocumentActions {
	canSend: boolean;
	canVoid: boolean;
	canProtocol: boolean;
	/** Штампованная копия (`signed_file_id`) — единственный файл на этой странице, который
	 * реально проходит «Найти подпись по файлу» (см. `signedContainerLink` в `api.ts`). Без
	 * этой кнопки протокол был единственным видимым download'ом, и пользователь верифицировал
	 * не тот файл — детерминированный `hash_mismatch` на самом обычном сценарии. */
	canSignedContainer: boolean;
	/** Документ завершён неудачно — предложить «отправить заново» (новый документ). */
	canRecreate: boolean;
	needsAgreement: boolean;
}

/** Какие кнопки показывать в карточке документа — по статусу и правам (`signature:create`, `signature:void`). */
export function documentActions(status: string, perms: DocumentPermissions): DocumentActions {
	const s = status as DocumentStatus;
	return {
		canSend: perms.create && (s === 'draft' || s === 'blocked_no_agreement'),
		canVoid: perms.void && (s === 'draft' || s === 'pending' || s === 'partially_signed' || s === 'blocked_no_agreement'),
		canProtocol: s === 'signed',
		canSignedContainer: s === 'signed',
		canRecreate: perms.create && (s === 'rejected' || s === 'expired' || s === 'void'),
		needsAgreement: s === 'blocked_no_agreement'
	};
}

/**
 * Предупреждение мастера: у внешнего подписанта, который не первый в последовательной цепочке,
 * ссылка на подпись сразу никому не отдаётся; получить её можно через «переиздать ссылку» (`POST /signature-requests/{id}/reissue-link`, backend-issues C-7), кнопки в интерфейсе пока нет.
 */
export function externalNotFirstWarning(
	signers: readonly { type: 'internal' | 'external' }[],
	order: 'sequential' | 'parallel'
): boolean {
	if (order !== 'sequential') return false;
	return signers.some((s, index) => index > 0 && s.type === 'external');
}
