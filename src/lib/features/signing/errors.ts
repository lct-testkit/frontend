// Человеческие тексты для ошибок ПЭП по каталогу core/errors.py.
// Принимает «похожее на ApiError» — чтобы не зависеть от общего слоя до его появления.

export interface ApiErrorLike {
	code?: string | null;
	status?: number;
	detail?: string | null;
	extra?: Record<string, unknown> | null;
	retryAfter?: number | null;
}

export type SignErrorKind =
	| 'token_invalid'
	| 'invalid_code'
	| 'code_expired'
	| 'code_missing'
	| 'send_limit'
	| 'locked'
	| 'already_signed'
	| 'not_signable'
	| 'hash_mismatch'
	| 'time_untrusted'
	| 'rate_limited'
	| 'no_channel'
	| 'unknown';

export interface SignError {
	kind: SignErrorKind;
	message: string;
	/** Страницу подписи дальше показывать бессмысленно — переключаемся в терминальное состояние. */
	fatal: boolean;
	/** Через сколько секунд можно повторить (429). */
	retryAfter?: number;
	/** Статус запроса из `extra.status` (для CRM-1505). */
	requestStatus?: string;
}

const NOT_SIGNABLE_TEXT: Record<string, string> = {
	locked: 'Подписание заблокировано после нескольких неверных кодов. Инициатор уведомлён.',
	signed: 'Документ уже подписан.',
	rejected: 'Документ уже отклонён.',
	expired: 'Срок подписания истёк.',
	void: 'Документ аннулирован.',
	pending: 'Сейчас не ваша очередь: документ подписывает предыдущий участник.'
};

export function signErrorMessage(err: ApiErrorLike): SignError {
	const detail = (err.detail ?? '').toLowerCase();
	const extra = err.extra ?? {};
	switch (err.code) {
		case 'CRM-1504':
			return { kind: 'token_invalid', fatal: true, message: 'Ссылка недействительна или срок её действия истёк. Попросите инициатора отправить документ заново.' };
		case 'CRM-1503':
			if (detail.includes('истёк') || detail.includes('истек')) {
				return { kind: 'code_expired', fatal: false, message: 'Срок действия кода истёк. Запросите новый.' };
			}
			if (detail.includes('лимит')) {
				return { kind: 'send_limit', fatal: false, message: 'Исчерпан лимит отправок кода для этого документа. Обратитесь к инициатору.' };
			}
			if (detail.includes('не запрашивался') || detail.includes('использован')) {
				return { kind: 'code_missing', fatal: false, message: 'Код ещё не запрашивался или уже использован. Запросите новый.' };
			}
			return { kind: 'invalid_code', fatal: false, message: 'Код неверен. Проверьте цифры и попробуйте ещё раз.' };
		case 'CRM-1505': {
			const status = typeof extra.status === 'string' ? extra.status : undefined;
			if (status === 'locked') return { kind: 'locked', fatal: true, message: NOT_SIGNABLE_TEXT.locked, requestStatus: status };
			if (status === 'signed') return { kind: 'already_signed', fatal: true, message: NOT_SIGNABLE_TEXT.signed, requestStatus: status };
			return {
				kind: 'not_signable',
				fatal: status !== 'pending',
				message: (status && NOT_SIGNABLE_TEXT[status]) ?? err.detail ?? 'Документ сейчас нельзя подписать.',
				requestStatus: status
			};
		}
		case 'CRM-1502':
			return { kind: 'hash_mismatch', fatal: true, message: 'Документ изменился после отправки на подпись — подпись не поставлена, запрос аннулирован. Инициатору нужно отправить документ заново.' };
		case 'CRM-1506':
			return { kind: 'time_untrusted', fatal: false, message: 'Подписание временно недоступно: не удалось подтвердить доверенное время. Попробуйте через минуту.' };
		case 'CRM-8429': {
			const retryAfter = typeof err.retryAfter === 'number' && err.retryAfter > 0 ? Math.ceil(err.retryAfter) : undefined;
			return {
				kind: 'rate_limited',
				fatal: false,
				retryAfter,
				message: retryAfter ? `Слишком много запросов. Повторите через ${retryAfter} с.` : 'Слишком много запросов. Повторите чуть позже.'
			};
		}
		case 'CRM-1001':
			if (detail.includes('канал')) {
				return { kind: 'no_channel', fatal: true, message: 'У подписанта не указан телефон или эл. почта — код отправить некуда. Обратитесь к инициатору.' };
			}
			return { kind: 'unknown', fatal: false, message: err.detail || 'Проверьте введённые данные.' };
		default:
			return { kind: 'unknown', fatal: false, message: err.detail || 'Что-то пошло не так. Попробуйте ещё раз.' };
	}
}
