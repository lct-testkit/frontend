// Панель «Состояние защиты» (GET /api/admin/security/posture): что из мер, которые обещает документация, включено на самом деле. По одной строке на меру:
// статус (включено / нужно внимание / не включено / нет данных), одна фраза «что это значит» и, где можно, что делать. Данные Keycloak сервер кэширует на минуту.
import type { components } from '$lib/api';

export type Posture = components['schemas']['SecurityPostureOut'];
export type PostureStatus = 'ok' | 'warn' | 'bad' | 'unknown';

export interface PostureCheck {
	key: string;
	title: string;
	status: PostureStatus;
	/** что показывает панель: «Включено», «Не включено», «Без второго фактора: 2» */
	label: string;
	/** что это значит и что с этим делать */
	text: string;
}

export const STATUS_TONE: Record<PostureStatus, 'success' | 'warning' | 'error' | 'neutral'> = { ok: 'success', warn: 'warning', bad: 'error', unknown: 'neutral' };

const yes = (v: boolean | null | undefined): PostureStatus => (v === null || v === undefined ? 'unknown' : v ? 'ok' : 'bad');

function totp(p: Posture): PostureCheck {
	const n = p.admins_without_totp.length;
	return {
		key: 'totp',
		title: 'Второй фактор у администраторов и руководителей',
		status: n === 0 ? 'ok' : 'bad',
		label: n === 0 ? 'У всех включён' : `Без второго фактора: ${n}`,
		text: n === 0 ? 'У всех администраторов и руководителей подключено приложение-аутентификатор.' : 'Эти учётные записи входят только по паролю. Попросите владельцев подключить аутентификатор при следующем входе; без него высокие права защищены слабо.'
	};
}

function bearer(p: Posture): PostureCheck {
	const mode = p.bearer_auth_mode;
	if (mode === 'integration_only') return { key: 'bearer', title: 'Вход по токену без сессии (Bearer)', status: 'ok', label: 'Только служебная роль', text: 'Токен без сессии принимается только у роли «Интеграция» — так и нужно в боевом режиме.' };
	if (mode === 'off') return { key: 'bearer', title: 'Вход по токену без сессии (Bearer)', status: 'ok', label: 'Выключен', text: 'Токены без сессии не принимаются вовсе: внешние системы ходят по API-ключам.' };
	if (mode === 'all') return { key: 'bearer', title: 'Вход по токену без сессии (Bearer)', status: 'warn', label: 'Разрешён всем ролям', text: 'Так удобно в демо, но в боевом режиме токен без сессии должен быть только у роли «Интеграция».' };
	return { key: 'bearer', title: 'Вход по токену без сессии (Bearer)', status: 'unknown', label: mode || 'Нет данных', text: 'Режим не распознан.' };
}

function antivirus(p: Posture): PostureCheck {
	const av = p.antivirus;
	const title = 'Проверка загружаемых файлов антивирусом';
	if (!av.enabled) return { key: 'antivirus', title, status: 'bad', label: 'Не включена', text: 'Файлы принимаются без проверки на вредоносное содержимое. Включите антивирус в настройках сервера.' };
	if (av.reachable === false) return { key: 'antivirus', title, status: av.fail_mode === 'closed' ? 'warn' : 'bad', label: 'Сервис недоступен', text: av.fail_mode === 'closed' ? 'Антивирус не отвечает, файлы не принимаются, пока его не восстановят.' : 'Антивирус не отвечает, а файлы всё равно принимаются без проверки. Восстановите сервис или переключите режим на «отказывать».' };
	if (av.fail_mode === 'open') return { key: 'antivirus', title, status: 'warn', label: av.reachable ? 'Работает, режим «пропускать»' : 'Включена', text: 'Если антивирус перестанет отвечать, файлы будут приниматься без проверки. Для боевого режима лучше «отказывать».' };
	return { key: 'antivirus', title, status: 'ok', label: 'Работает', text: 'Каждый загруженный файл проверяется; при сбое проверки файл не принимается.' };
}

function audit(p: Posture): PostureCheck {
	return {
		key: 'audit',
		title: 'Подпись цепочки журнала аудита',
		status: p.audit_hmac_key_set ? 'ok' : 'warn',
		label: p.audit_hmac_key_set ? 'Ключ задан' : 'Ключ не задан',
		text: p.audit_hmac_key_set ? 'Записи журнала связаны подписью: подмену задним числом можно обнаружить.' : 'Без ключа записи журнала не подписываются, и подмену задним числом не обнаружить. Задайте ключ в настройках сервера.'
	};
}

function encryption(p: Posture): PostureCheck {
	return {
		key: 'encryption',
		title: 'Шифрование персональных полей',
		status: p.field_encryption_enabled ? 'ok' : 'warn',
		label: p.field_encryption_enabled ? 'Включено' : 'Не включено',
		text: p.field_encryption_enabled ? 'Чувствительные поля хранятся в базе в зашифрованном виде.' : 'Чувствительные поля хранятся открытым текстом. Включите шифрование и задайте ключ в настройках сервера.'
	};
}

/** Политика Keycloak: четыре признака, каждый может быть неизвестен (realm не прочитан). */
function realm(p: Posture): PostureCheck[] {
	const r = p.realm;
	if (!r) return [{ key: 'realm', title: 'Политика Keycloak', status: 'unknown', label: 'Нет данных', text: 'Keycloak не ответил. Проверьте его состояние на странице «Интеграции».' }];
	const ssl = r.ssl_required;
	const sslStatus: PostureStatus = ssl === null || ssl === undefined ? 'unknown' : ssl === 'none' ? 'bad' : ssl === 'external' ? 'ok' : 'ok';
	return [
		{
			key: 'brute',
			title: 'Защита от подбора пароля (Keycloak)',
			status: yes(r.brute_force_protected),
			label: r.brute_force_protected === null || r.brute_force_protected === undefined ? 'Нет данных' : r.brute_force_protected ? 'Включена' : 'Не включена',
			text: r.brute_force_protected ? 'Учётная запись временно блокируется после серии неудачных входов.' : 'Без защиты пароль можно подбирать без ограничений. Включите «Brute force detection» в realm.'
		},
		{
			key: 'refresh',
			title: 'Ротация refresh-токенов (Keycloak)',
			status: yes(r.revoke_refresh_token),
			label: r.revoke_refresh_token === null || r.revoke_refresh_token === undefined ? 'Нет данных' : r.revoke_refresh_token ? 'Включена' : 'Не включена',
			text: r.revoke_refresh_token ? 'Украденный refresh-токен нельзя использовать повторно.' : 'Refresh-токен можно использовать многократно: украденный токен живёт до истечения. Включите «Revoke Refresh Token» в realm.'
		},
		{
			key: 'events',
			title: 'События входа в Keycloak',
			status: yes(r.events_enabled),
			label: r.events_enabled === null || r.events_enabled === undefined ? 'Нет данных' : r.events_enabled ? 'Записываются' : 'Не записываются',
			text: r.events_enabled ? 'Неудачные входы и сбои попадают в журнал безопасности.' : 'Keycloak не пишет события входа, поэтому в «Событиях безопасности» не будет неудачных входов. Включите «Save events» в realm.'
		},
		{
			key: 'ssl',
			title: 'Обязательность HTTPS в Keycloak',
			status: sslStatus,
			label: ssl === null || ssl === undefined ? 'Нет данных' : ssl === 'none' ? 'Не требуется' : ssl === 'external' ? 'Для внешних адресов' : 'Для всех адресов',
			text: ssl === 'none' ? 'Вход возможен по незащищённому HTTP. В боевом режиме требуйте HTTPS («external» или «all»).' : ssl ? 'Вход по незащищённому соединению не принимается.' : 'Настройка не прочитана.'
		}
	];
}

/** Все меры панели в порядке важности. */
export function postureChecks(p: Posture): PostureCheck[] {
	return [totp(p), bearer(p), antivirus(p), audit(p), encryption(p), ...realm(p)];
}

export interface PostureSummary {
	bad: number;
	warn: number;
	unknown: number;
	ok: number;
}

export function summarize(checks: readonly PostureCheck[]): PostureSummary {
	const out = { bad: 0, warn: 0, unknown: 0, ok: 0 };
	for (const c of checks) out[c.status] += 1;
	return out;
}

/** Фраза над списком: сколько мер требуют внимания. */
export function summaryText(s: PostureSummary): string {
	if (s.bad === 0 && s.warn === 0) return s.unknown ? `Всё, что удалось проверить, в порядке. Нет данных по ${s.unknown}.` : 'Все меры включены.';
	const parts: string[] = [];
	if (s.bad) parts.push(`не включено или опасно: ${s.bad}`);
	if (s.warn) parts.push(`стоит усилить: ${s.warn}`);
	if (s.unknown) parts.push(`нет данных: ${s.unknown}`);
	return parts.join(' · ');
}
