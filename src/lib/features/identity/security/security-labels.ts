// Русские подписи и подсказки к типам событий безопасности и их серьёзности. Незнакомый код (бэкенд мог добавить новый тип) показывается как есть.

export const SECURITY_EVENT_LABELS: Record<string, string> = {
	LOGIN_FAILED: 'Неудачная попытка входа',
	BRUTE_FORCE_LOCK: 'Блокировка из-за подбора пароля',
	PASSWORD_CHANGED: 'Пароль изменён',
	PASSWORD_RESET: 'Пароль сброшен',
	SESSION_HIJACK_SUSPECT: 'Подозрение на чужой сеанс',
	PERMISSION_DENIED: 'Отказ в доступе',
	MALWARE_DETECTED: 'Найден вредоносный файл',
	FILE_REJECTED: 'Файл отклонён',
	MASS_EXPORT: 'Массовая выгрузка',
	SIGNATURE_OTP_FAILED: 'Неверный код при подписании',
	SIGNATURE_TOKEN_PROBE: 'Перебор ссылок подписания',
	SIGNATURE_KEY_COMPROMISED: 'Ключ подписи скомпрометирован',
	INTEGRATION_SIGNATURE_INVALID: 'Неверная подпись вебхука'
};

export const SECURITY_EVENT_HINTS: Record<string, string> = {
	LOGIN_FAILED: 'Ввели неверный текущий пароль, например при смене пароля. Много таких событий подряд — признак подбора.',
	BRUTE_FORCE_LOCK: 'После нескольких неудачных попыток вход или действие временно закрыты.',
	PASSWORD_CHANGED: 'Сотрудник сменил пароль сам.',
	PASSWORD_RESET: 'Администратор сбросил пароль сотрудника. Проверьте, что это сделали вы.',
	SESSION_HIJACK_SUSPECT: 'Сеанс используется с необычного адреса или устройства.',
	PERMISSION_DENIED: 'Сотрудник пытался сделать то, что ему не разрешено ролью.',
	MALWARE_DETECTED: 'Антивирус нашёл вредоносное содержимое в загруженном файле. Файл не принят.',
	FILE_REJECTED: 'Содержимое файла не совпадает с его расширением: возможно, файл просто переименован. Файл не принят.',
	MASS_EXPORT: 'Выгружен большой объём данных: журнал аудита, отчёт или список. Проверьте, что выгрузку делал сам сотрудник.',
	SIGNATURE_OTP_FAILED: 'Подписант ввёл неверный код из сообщения при подписании документа.',
	SIGNATURE_TOKEN_PROBE: 'С одного адреса много попыток открыть ссылки подписания с неверным ключом. Похоже на подбор.',
	SIGNATURE_KEY_COMPROMISED: 'Ключ подписи помечен как скомпрометированный: подписи им больше не принимаются.',
	INTEGRATION_SIGNATURE_INVALID: 'Внешняя система прислала запрос с неверной подписью. Проверьте секрет источника в разделе «Интеграции».'
};

export const securityEventLabel = (type: string): string => SECURITY_EVENT_LABELS[type] ?? type;
export const securityEventHint = (type: string): string | undefined => SECURITY_EVENT_HINTS[type];

export const SEVERITY_LABELS: Record<string, string> = { info: 'Информация', warning: 'Предупреждение', critical: 'Критично' };
export type SeverityTone = 'neutral' | 'warning' | 'error';
export const SEVERITY_TONES: Record<string, SeverityTone> = { info: 'neutral', warning: 'warning', critical: 'error' };

export const severityMeta = (severity: string): { label: string; tone: SeverityTone } => ({ label: SEVERITY_LABELS[severity] ?? severity, tone: SEVERITY_TONES[severity] ?? 'neutral' });
