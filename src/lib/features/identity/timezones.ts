// Часовые пояса России (11 зон UTC+2…UTC+12) — тот же список, что бэкенд не ограничивает перечислением
// (`identity.schemas.MePatchRequest.timezone` — произвольная строка IANA, ≤ 64 символов), но вся демо-база
// и весь набор пользователей — российские вузы, поэтому подборка короче полного `Intl.supportedValuesOf('timeZone')`.
export const RUSSIAN_TIMEZONES = ['Europe/Kaliningrad', 'Europe/Moscow', 'Europe/Samara', 'Asia/Yekaterinburg', 'Asia/Omsk', 'Asia/Krasnoyarsk', 'Asia/Irkutsk', 'Asia/Yakutsk', 'Asia/Vladivostok', 'Asia/Magadan', 'Asia/Kamchatka'] as const;

/** Список для `Pick`: текущее значение всегда в нём, даже если оно за пределами `RUSSIAN_TIMEZONES` (часовой пояс задан вручную или через импорт). */
export function timezoneOptions(current: string): { key: string; value: string }[] {
	const zones = (RUSSIAN_TIMEZONES as readonly string[]).includes(current) ? RUSSIAN_TIMEZONES : [current, ...RUSSIAN_TIMEZONES];
	return zones.map((z) => ({ key: z, value: z }));
}
