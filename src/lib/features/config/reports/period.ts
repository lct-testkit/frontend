// Быстрые периоды отчёта: «Этот месяц», «Квартал» и т. д. Считаются по календарю браузера; граница — дата без времени.

export const PERIOD_PRESETS = ['this_month', 'prev_month', 'this_quarter', 'this_year', 'all'] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
	this_month: 'Этот месяц',
	prev_month: 'Прошлый месяц',
	this_quarter: 'Квартал',
	this_year: 'С начала года',
	all: 'Всё время'
};

export const isPeriodPreset = (v: unknown): v is PeriodPreset => typeof v === 'string' && (PERIOD_PRESETS as readonly string[]).includes(v);

const pad = (n: number): string => String(n).padStart(2, '0');
/** `ГГГГ-ММ-ДД` по локальному календарю (не по UTC: ночью UTC-дата может отличаться на сутки). */
export const isoDate = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Даты периода для пресета; `null` — «Всё время» (без ограничений). */
export function periodFor(preset: PeriodPreset, today: Date): { date_from: string; date_to: string } | null {
	const y = today.getFullYear();
	const m = today.getMonth();
	switch (preset) {
		case 'this_month':
			return { date_from: isoDate(new Date(y, m, 1)), date_to: isoDate(today) };
		case 'prev_month':
			return { date_from: isoDate(new Date(y, m - 1, 1)), date_to: isoDate(new Date(y, m, 0)) };
		case 'this_quarter':
			return { date_from: isoDate(new Date(y, m - (m % 3), 1)), date_to: isoDate(today) };
		case 'this_year':
			return { date_from: isoDate(new Date(y, 0, 1)), date_to: isoDate(today) };
		case 'all':
			return null;
	}
}

/** Какой пресет соответствует выбранным датам (для подсветки кнопки); `null` — свои даты. */
export function presetOf(from: string | undefined, to: string | undefined, today: Date): PeriodPreset | null {
	if (!from && !to) return 'all';
	for (const preset of PERIOD_PRESETS) {
		const p = periodFor(preset, today);
		if (p && p.date_from === from && p.date_to === to) return preset;
	}
	return null;
}
