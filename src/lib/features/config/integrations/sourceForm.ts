// Форма источника: проверка имён переменных окружения, вынос двух ключей `config` в отдельные поля, пример запроса для терминала.

/** Как у бэкенда (`IntegrationSourceUpdateRequest.credentials_ref`): имя переменной окружения. */
const REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
export const REF_MAX = 128;

/** Текст ошибки для имени переменной или `null`; пустое значение допустимо. */
export function validateRef(value: string): string | null {
	const v = value.trim();
	if (!v) return null;
	if (v.length > REF_MAX) return `Не длиннее ${REF_MAX} знаков`;
	if (!REF_PATTERN.test(v)) return 'Имя переменной: латиница, цифры и «_», не с цифры, без пробелов';
	return null;
}

export interface SplitConfig {
	signingSecretRef: string;
	requireTimestamp: boolean;
	/** остальные ключи `config`: их бэкенд не читает, но не теряет */
	rest: Record<string, unknown>;
}

/** Два ключа, которые читает приём вебхуков, показываются полями; остальное остаётся в блоке «Дополнительно». */
export function splitConfig(config: Record<string, unknown> | null | undefined): SplitConfig {
	const { signing_secret_ref, require_timestamp, ...rest } = config ?? {};
	return { signingSecretRef: typeof signing_secret_ref === 'string' ? signing_secret_ref : '', requireTimestamp: require_timestamp === true, rest };
}

export function mergeConfig(parts: SplitConfig): Record<string, unknown> {
	const out: Record<string, unknown> = { ...parts.rest };
	if (parts.signingSecretRef.trim()) out.signing_secret_ref = parts.signingSecretRef.trim();
	if (parts.requireTimestamp) out.require_timestamp = true;
	return out;
}

export interface CurlOptions {
	origin: string;
	path: string;
	body: string;
	/** имя переменной окружения терминала с секретом */
	secretVar: string;
	timestamp: boolean;
	idempotencyKey: string;
}

/** Команда для терминала: считает подпись HMAC-SHA256 (с меткой времени или без) и отправляет запрос. Секрет в команде — только имя переменной. */
export function signedCurl(o: CurlOptions): string {
	const lines = [`BODY='${o.body}'`];
	if (o.timestamp) {
		lines.push('TS=$(date +%s)');
		lines.push(`SIG=$(printf '%s' "$TS.$BODY" | openssl dgst -sha256 -hmac "$${o.secretVar}" | sed 's/^.* //')`);
	} else {
		lines.push(`SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$${o.secretVar}" | sed 's/^.* //')`);
	}
	const head = [`curl -X POST '${o.origin}${o.path}'`, `-H 'Content-Type: application/json'`, `-H "X-Signature: sha256=$SIG"`];
	if (o.timestamp) head.push(`-H "X-Timestamp: $TS"`);
	head.push(`-H 'Idempotency-Key: ${o.idempotencyKey}'`, `-d "$BODY"`);
	return `${lines.join('\n')}\n${head.join(' \\\n  ')}`;
}

/** Адрес внешней системы: только http(s) со своим хостом. Пустое значение допустимо у выключенного источника (см. `sourceFormErrors`). */
function validateBaseUrl(value: string): string | null {
	const v = value.trim();
	if (!v) return null;
	try {
		const url = new URL(v);
		if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) throw new Error('scheme');
		return null;
	} catch {
		return 'Адрес должен начинаться с http:// или https://, например https://crm.example.ru';
	}
}

export interface SourceAccess {
	baseUrl: string;
	authType: string | null;
	/** источник включён (или включён забор по расписанию): без адреса и способа входа он работать не может */
	enabled: boolean;
}

/** Ошибки полей «Адрес системы» и «Способ входа». Выключенному источнику можно оставить поля пустыми, но не заполнять мусором. */
export function sourceAccessErrors({ baseUrl, authType, enabled }: SourceAccess): { base_url?: string; auth_type?: string } {
	const out: { base_url?: string; auth_type?: string } = {};
	if (enabled && !baseUrl.trim()) out.base_url = 'Укажите адрес системы: источник включён';
	else {
		const invalid = validateBaseUrl(baseUrl);
		if (invalid) out.base_url = invalid;
	}
	if (enabled && !authType) out.auth_type = 'Выберите способ входа: источник включён';
	return out;
}
