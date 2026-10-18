// Исходящие webhook-подписки: каталог событий, подписи по-русски, проверка формы, тексты ошибок доставки и примеры для принимающей стороны.
// Каталог событий ручкой не отдаётся (список — в описании POST /api/admin/integrations/webhooks): незнакомый код показываем как есть.

export const WEBHOOK_EVENTS: readonly { key: string; value: string }[] = [
	{ key: 'DEAL_CREATED', value: 'Сделка создана' },
	{ key: 'DEAL_STATUS_CHANGED', value: 'Статус сделки изменён' },
	{ key: 'DOCUMENT_SIGNED', value: 'Документ подписан' },
	{ key: 'LEARNING_ENROLLMENT_SENT', value: 'Зачисление в LMS отправлено' },
	{ key: 'LEARNING_TRANSFER_REQUESTED', value: 'Запрошен перевод на обучение' }
];

export const eventTitle = (code: string): string => WEBHOOK_EVENTS.find((e) => e.key === code)?.value ?? code;

/** Адрес для списка: хост и путь, без логина, пароля, query и фрагмента. Не адрес — как есть. */
export function urlLabel(raw: string): string {
	try {
		const u = new URL(raw);
		const path = u.pathname === '/' ? '' : u.pathname;
		return `${u.host}${path}`;
	} catch {
		return raw;
	}
}

export interface SubscriptionForm {
	name: string;
	url: string;
	events: string[];
	filtersText: string;
}

export type SubscriptionErrors = Partial<Record<'name' | 'url' | 'events' | 'filters', string>>;

/** Фильтры — JSON-объект «поле нагрузки → значение» (не больше 10 ключей, как на сервере). */
export function parseFilters(text: string): { value: Record<string, unknown>; error?: undefined } | { value?: undefined; error: string } {
	const src = text.trim();
	if (!src) return { value: {} };
	let parsed: unknown;
	try {
		parsed = JSON.parse(src);
	} catch {
		return { error: 'Некорректный JSON: проверьте скобки и кавычки' };
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { error: 'Ожидается объект вида { "deal_type": "b2c" }' };
	if (Object.keys(parsed).length > 10) return { error: 'Не больше 10 полей' };
	return { value: parsed as Record<string, unknown> };
}

/** Проверка формы до отправки; `prod` — боевой профиль: только https (внутренние адреса всё равно отклоняет сервер). */
export function validateSubscription(form: SubscriptionForm, opts: { prod: boolean }): SubscriptionErrors {
	const errors: SubscriptionErrors = {};
	if (!form.name.trim()) errors.name = 'Укажите название';
	const url = form.url.trim();
	if (!url) errors.url = 'Укажите адрес';
	else {
		let parsed: URL | null;
		try {
			parsed = new URL(url);
		} catch {
			parsed = null;
		}
		if (!parsed || !/^https?:$/.test(parsed.protocol)) errors.url = 'Адрес должен начинаться с https:// или http://';
		else if (opts.prod && parsed.protocol !== 'https:') errors.url = 'В боевом режиме принимается только https://';
	}
	if (form.events.length === 0) errors.events = 'Выберите хотя бы одно событие';
	const filters = parseFilters(form.filtersText);
	if (filters.error) errors.filters = filters.error;
	return errors;
}

/** Причины, по которым сервер сам выключил подписку (`disabled_reason`). */
export function disabledReasonText(reason: string | null | undefined): string | null {
	if (!reason) return null;
	if (reason === 'gone_410') return 'Получатель ответил «410»: адрес снят, подписка выключена';
	if (reason === 'too_many_failures') return 'Выключена после 20 недоставленных событий подряд';
	return 'Выключена сервером';
}

/** Что записано в `last_error` доставки — по-русски; незнакомое — общей фразой. */
export function deliveryErrorText(code: string | null | undefined): string | null {
	if (!code) return null;
	const http = /^http_(\d{3})$/.exec(code);
	if (http) return `Получатель ответил кодом ${http[1]}`;
	if (code === 'subscription_inactive') return 'Подписка была выключена';
	const failed = /^request_failed:(\w*)$/.exec(code);
	if (failed) {
		const type = failed[1];
		if (/Timeout/i.test(type)) return 'Нет ответа за 10 секунд';
		if (/Connect|Network/i.test(type)) return 'Не удалось соединиться с адресом';
		if (type === 'ValueError') return 'Адрес не прошёл проверку безопасности';
		return 'Сбой при отправке';
	}
	return 'Не удалось доставить';
}

export interface PingResult {
	ok: boolean;
	text: string;
}

/** Результат тестовой отправки (PING): код ответа, задержка, причина по-русски. */
export function pingText(r: { status_code?: number | null; elapsed_ms: number; error?: string | null }): PingResult {
	const ms = `${Math.round(r.elapsed_ms)} мс`;
	if (r.status_code != null) {
		const ok = r.status_code >= 200 && r.status_code < 300;
		return { ok, text: ok ? `Получатель ответил ${r.status_code} за ${ms}` : `Получатель ответил ${r.status_code} за ${ms}: ожидается 2xx` };
	}
	return { ok: false, text: `${deliveryErrorText(`request_failed:${r.error ?? ''}`) ?? 'Не удалось отправить'} (${ms})` };
}

export const RECEIVE_HEADERS = [
	'Content-Type: application/json',
	'X-CRM-Event: DEAL_STATUS_CHANGED',
	'X-CRM-Delivery: <идентификатор доставки>',
	'X-Timestamp: <секунды Unix>',
	'X-Signature: sha256=<HMAC-SHA256 строки «метка.тело»>'
];

export const RECEIVE_EXAMPLE = `{
  "id": "01924f3a-…",
  "event": "DEAL_STATUS_CHANGED",
  "occurred_at": "2026-10-16T09:12:00+00:00",
  "data": { "deal_type": "b2c", "status_code": "payment_contract" }
}`;

export const RECEIVE_PYTHON = `import hmac, hashlib, time

def verify(secret: str, raw_body: bytes, timestamp: str, signature: str) -> bool:
    if abs(time.time() - int(timestamp)) > 300:  # метка старше 5 минут
        return False
    signed = timestamp.encode() + b"." + raw_body
    expected = "sha256=" + hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)`;

export const RECEIVE_NODE = `import { createHmac, timingSafeEqual } from 'node:crypto';

export function verify(secret, rawBody, timestamp, signature) {
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false; // метка старше 5 минут
  const expected = 'sha256=' + createHmac('sha256', secret).update(timestamp + '.').update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}`;

export const RECEIVE_RULES = [
	'Получатель отвечает кодом 2xx быстрее чем за 10 секунд, иначе доставка считается неудачной.',
	'Повторы идут через 1 с, 5 с, 30 с, 5 мин, 30 мин и 2 часа; после 8 неудач событие получает статус «Не доставлено», его можно вернуть в очередь вручную.',
	'Ответ 410 выключает подписку сразу; 20 недоставленных событий подряд тоже выключают её.',
	'Подпись считается по сырому телу запроса. Одно событие может прийти дважды: ориентируйтесь на X-CRM-Delivery.'
];
