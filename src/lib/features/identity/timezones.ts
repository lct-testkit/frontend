// Часовые пояса России (11 зон UTC+2…UTC+12) — тот же список, что бэкенд не ограничивает перечислением
// (`identity.schemas.MePatchRequest.timezone` — произвольная строка IANA, ≤ 64 символов), но вся демо-база
// и весь набор пользователей — российские вузы, поэтому подборка короче полного `Intl.supportedValuesOf('timeZone')`.
const RUSSIAN_TIMEZONES = ['Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka'] as const;

/** Названия поясов России по-русски, со смещением от UTC («Москва, UTC+3»). Незнакомый пояс остаётся как есть. */
const ZONE_NAMES: Record<string, string> = {
	'Europe/Kaliningrad': 'Калининград, UTC+2',
	'Europe/Moscow': 'Москва, UTC+3',
	'Europe/Samara': 'Самара, UTC+4',
	'Asia/Yekaterinburg': 'Екатеринбург, UTC+5',
	'Asia/Omsk': 'Омск, UTC+6',
	'Asia/Krasnoyarsk': 'Красноярск, UTC+7',
	'Asia/Irkutsk': 'Иркутск, UTC+8',
	'Asia/Yakutsk': 'Якутск, UTC+9',
	'Asia/Vladivostok': 'Владивосток, UTC+10',
	'Asia/Magadan': 'Магадан, UTC+11',
	'Asia/Kamchatka': 'Камчатка, UTC+12'
};
export const timezoneLabel = (zone: string | null | undefined): string => (zone ? (ZONE_NAMES[zone] ?? zone) : '—');

/** Список для `Pick`: текущее значение всегда в нём, даже если оно за пределами `RUSSIAN_TIMEZONES` (часовой пояс задан вручную или через импорт). */
export function timezoneOptions(current: string): { key: string; value: string }[] {
	const zones = (RUSSIAN_TIMEZONES as readonly string[]).includes(current) ? RUSSIAN_TIMEZONES : [current, ...RUSSIAN_TIMEZONES];
	return zones.map((z) => ({ key: z, value: timezoneLabel(z) }));
}
