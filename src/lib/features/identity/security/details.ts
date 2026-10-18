// «Подробности» события безопасности: объект `details` → пары «название: значение». Значения отдаёт сервер уже с маской; на клиенте ничего не собирается заново.

const KEY_LABELS: Record<string, string> = {
	source: 'Источник',
	kind: 'Вид',
	rows: 'Строк',
	reason: 'Причина',
	context: 'Где',
	path: 'Адрес запроса',
	method: 'Метод',
	filename: 'Файл',
	attempts: 'Попыток',
	external_id: 'Идентификатор',
	inbound_message_id: 'Запись во входящих'
};

const VALUE_LABELS: Record<string, Record<string, string>> = {
	reason: { current_password_invalid: 'неверный текущий пароль' },
	context: { password_change: 'смена пароля' }
};
const KIND_LABELS: Record<string, string> = { audit_export: 'выгрузка журнала аудита', report_export: 'выгрузка отчёта', security_events_export: 'выгрузка журнала безопасности' };

export interface DetailRow {
	key: string;
	label: string;
	value: string;
}

const show = (key: string, v: unknown): string => {
	if (v === null || v === undefined || v === '') return '—';
	if (typeof v === 'boolean') return v ? 'да' : 'нет';
	if (typeof v === 'object') return JSON.stringify(v);
	const text = String(v);
	if (key === 'kind') return KIND_LABELS[text] ?? text;
	return VALUE_LABELS[key]?.[text] ?? text;
};

/** Плоский список; вложенные объекты разворачиваются в «ключ.вложенный: значение», массивы — через запятую. */
export function detailRows(details: Record<string, unknown> | null | undefined, prefix = ''): DetailRow[] {
	const rows: DetailRow[] = [];
	for (const [k, v] of Object.entries(details ?? {})) {
		const key = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === 'object' && !Array.isArray(v)) rows.push(...detailRows(v as Record<string, unknown>, key));
		else rows.push({ key, label: KEY_LABELS[k] ?? key, value: Array.isArray(v) ? v.map((x) => show(k, x)).join(', ') || '—' : show(k, v) });
	}
	return rows;
}
