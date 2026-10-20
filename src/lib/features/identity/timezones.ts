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

// ── «UTC+7 (Барнаул)»: смещение считает Intl, город — по-русски из словаря (зоны России) или из названия зоны ──

/** Города зон России по-русски (названия IANA — по главному городу зоны, кроме Сахалина и Камчатки). */
const CITY_RU: Record<string, string> = {
	'Europe/Kaliningrad': 'Калининград',
	'Europe/Moscow': 'Москва',
	'Europe/Simferopol': 'Симферополь',
	'Europe/Kirov': 'Киров',
	'Europe/Volgograd': 'Волгоград',
	'Europe/Astrakhan': 'Астрахань',
	'Europe/Saratov': 'Саратов',
	'Europe/Ulyanovsk': 'Ульяновск',
	'Europe/Samara': 'Самара',
	'Asia/Yekaterinburg': 'Екатеринбург',
	'Asia/Omsk': 'Омск',
	'Asia/Novosibirsk': 'Новосибирск',
	'Asia/Barnaul': 'Барнаул',
	'Asia/Tomsk': 'Томск',
	'Asia/Novokuznetsk': 'Новокузнецк',
	'Asia/Krasnoyarsk': 'Красноярск',
	'Asia/Irkutsk': 'Иркутск',
	'Asia/Chita': 'Чита',
	'Asia/Yakutsk': 'Якутск',
	'Asia/Khandyga': 'Хандыга',
	'Asia/Vladivostok': 'Владивосток',
	'Asia/Ust-Nera': 'Усть-Нера',
	'Asia/Magadan': 'Магадан',
	'Asia/Sakhalin': 'Сахалин',
	'Asia/Srednekolymsk': 'Среднеколымск',
	'Asia/Kamchatka': 'Камчатка',
	'Asia/Anadyr': 'Анадырь'
};

/** Смещение зоны от UTC как «UTC+7», «UTC+5:30», «UTC» (по текущей дате); `null`, если Intl не знает такой зоны. */
function utcOffsetLabel(zone: string, at: Date = new Date()): string | null {
	try {
		const part = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')?.value ?? '';
		const m = /^GMT(?:([+-−])(\d{1,2})(?::(\d{2}))?)?$/.exec(part);
		if (!m) return null;
		if (!m[1]) return 'UTC';
		const minutes = m[3] && m[3] !== '00' ? `:${m[3]}` : '';
		if (Number(m[2]) === 0 && !minutes) return 'UTC';
		return `UTC${m[1] === '+' ? '+' : '−'}${Number(m[2])}${minutes}`;
	} catch {
		return null;
	}
}

/** Город зоны: по-русски для России, иначе последняя часть названия IANA (`America/New_York` → «New York»). */
function timezoneCity(zone: string): string {
	return CITY_RU[zone] ?? zone.split('/').pop()!.replaceAll('_', ' ');
}

/** «UTC+7 (Барнаул)» — часовой пояс для человека; пусто → «—», зона, которую Intl не знает, остаётся как есть. */
export function timezoneHuman(zone: string | null | undefined): string {
	if (!zone) return '—';
	const offset = utcOffsetLabel(zone);
	return offset ? `${offset} (${timezoneCity(zone)})` : zone;
}
