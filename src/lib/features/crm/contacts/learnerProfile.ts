// Профиль учащегося: как поля группируются в карточке контакта и как выглядят значения.

export interface LearnerFieldDef {
	key: string;
	label: string;
	/** как вводить: подсказка под полем формы (формат проверяет сервер) */
	format?: string;
	/** поле занимает всю ширину формы (длинный текст); остальные встают по два в ряд */
	wide?: boolean;
}
export interface LearnerSection {
	key: string;
	title: string;
	fields: LearnerFieldDef[];
}

const f = (key: string, label: string, opts: Pick<LearnerFieldDef, 'format' | 'wide'> = {}): LearnerFieldDef => ({ key, label, ...opts });
const DATE = 'ДД.ММ.ГГГГ';

/**
 * Секции идут в том порядке, в каком человек заполняет анкету: кто он, документ (паспорт и СНИЛС), где прописан, чему учился (образование и диплом).
 * Все поля необязательные: сервер требует только правильный вид того, что введено (`catalog/learner.py`).
 */
export const LEARNER_SECTIONS: readonly LearnerSection[] = [
	{
		key: 'person',
		title: 'Основное',
		fields: [f('sex', 'Пол', { format: 'Выберите из списка' }), f('birth_date', 'Дата рождения', { format: DATE })]
	},
	{
		key: 'passport',
		title: 'Паспорт и СНИЛС',
		fields: [
			f('passport_series', 'Серия', { format: '4 цифры' }),
			f('passport_number', 'Номер', { format: '6 цифр' }),
			f('passport_issued_by', 'Кем выдан', { wide: true }),
			f('passport_issued_at', 'Дата выдачи', { format: DATE }),
			f('passport_dept_code', 'Код подразделения', { format: '6 цифр: ХХХ-ХХХ' }),
			f('snils', 'СНИЛС', { format: '11 цифр: ХХХ-ХХХ-ХХХ ХХ', wide: true })
		]
	},
	{
		key: 'registration',
		title: 'Адрес регистрации',
		fields: [
			f('reg_zip', 'Индекс', { format: '6 цифр' }),
			f('reg_region', 'Регион', { format: 'Область, край, республика' }),
			f('reg_city', 'Населённый пункт'),
			f('reg_street', 'Улица'),
			f('reg_house', 'Дом'),
			f('reg_apartment', 'Квартира')
		]
	},
	{
		key: 'diploma',
		title: 'Образование и диплом',
		fields: [
			f('education_label', 'Образование', { wide: true }),
			f('diploma_profession', 'Профессия по диплому', { wide: true }),
			f('diploma_institution', 'Учебное заведение', { wide: true }),
			f('diploma_surname', 'Фамилия в дипломе', { wide: true }),
			f('diploma_series', 'Серия диплома', { format: 'Как в дипломе' }),
			f('diploma_number', 'Номер диплома', { format: 'Как в дипломе' }),
			f('diploma_reg_number', 'Регистрационный номер', { format: 'Как в дипломе' }),
			f('diploma_issued_at', 'Дата выдачи', { format: DATE })
		]
	},
	{
		key: 'dative',
		title: 'ФИО в дательном падеже',
		fields: [f('last_name_dative', 'Фамилия', { wide: true }), f('first_name_dative', 'Имя', { wide: true }), f('middle_name_dative', 'Отчество', { wide: true })]
	}
];

/** Поля секции рядами для формы: широкое поле — свой ряд, соседние узкие — по два. */
export function fieldRows(fields: readonly LearnerFieldDef[]): LearnerFieldDef[][] {
	const rows: LearnerFieldDef[][] = [];
	let open: LearnerFieldDef[] | null = null;
	for (const field of fields) {
		if (field.wide) {
			rows.push([field]);
			open = null;
		} else if (open && open.length < 2) {
			open.push(field);
		} else {
			open = [field];
			rows.push(open);
		}
	}
	return rows;
}

const SEX: Record<string, string> = { M: 'Мужской', F: 'Женский' };

/** Значение для показа: пол словами, дата — ДД.ММ.ГГГГ (год без изменений), остальное как есть. */
export function displayValue(key: string, value: unknown): string {
	const text = String(value);
	if (key === 'sex') return SEX[text] ?? text;
	if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text.slice(8)}.${text.slice(5, 7)}.${text.slice(0, 4)}`;
	return text;
}

/** Поля секции, у которых есть значение, уже готовые к показу. */
export function filledFields(data: Record<string, unknown>, fields: readonly LearnerFieldDef[]): { key: string; label: string; value: string }[] {
	return fields
		.filter((field) => data[field.key] !== null && data[field.key] !== undefined && data[field.key] !== '')
		.map((field) => ({ key: field.key, label: field.label, value: displayValue(field.key, data[field.key]) }));
}

/** Уровни образования шаблона LMS (лист «Лист2»); ключ — код, который принимает сервер. */
export const EDUCATION_OPTIONS: readonly { key: string; value: string }[] = [
	{ key: 'none', value: 'Без образования' },
	{ key: 'basic_general', value: 'Основное общее образование - 9 классов' },
	{ key: 'secondary_general', value: 'Среднее общее образование - 11 классов' },
	{ key: 'secondary_vocational', value: 'Среднее профессиональное образование' },
	{ key: 'higher_bachelor', value: 'Высшее образование – бакалавриат' },
	{ key: 'higher_specialist_master', value: 'Высшее образование – специалитет, магистратура' },
	{ key: 'higher_top_qualification', value: 'Высшее образование – подготовка кадров высшей квалификации' }
];

/** Пол в формате шаблона LMS: `М` / `Ж`. */
export const SEX_OPTIONS: readonly { key: string; value: string }[] = [
	{ key: 'М', value: 'Мужской' },
	{ key: 'Ж', value: 'Женский' }
];

/** Поле формы → поле тела запроса: подпись образования в ответе приходит как `education_label`, а сохраняется код `education`. */
export const requestKey = (key: string): string => (key === 'education_label' ? 'education' : key);

/**
 * Тело `PUT /learner-profile`: только то, что ввели. Пустое поле — «не менять»: значения профиля в форме замаскированы,
 * поэтому подставлять их обратно нельзя, а очищать поле по ошибке — тем более.
 */
export function buildProfilePatch(values: Record<string, string>): Record<string, string> {
	const body: Record<string, string> = {};
	for (const [key, raw] of Object.entries(values)) {
		const value = raw.trim();
		if (value) body[requestKey(key)] = value;
	}
	return body;
}

// --- Ввод: даты и цифровые поля ---------------------------------------------------------------------------------------------------

/** Поля-даты: календарь и ввод `дд.мм.гггг` (сервер принимает и `ГГГГ-ММ-ДД`); раньше сегодняшнего дня. */
export const DATE_KEYS: readonly string[] = ['birth_date', 'passport_issued_at', 'diploma_issued_at'];

interface DigitSpec {
	/** сколько цифр */
	length: number;
	/** как цифры делятся на группы и чем разделены: СНИЛС `123-456-789 01`, код подразделения `123-456` */
	groups?: readonly number[];
	separators?: readonly string[];
	/** «Серия паспорта» в тексте ошибки */
	what: string;
}

const DIGIT_FIELDS: Record<string, DigitSpec> = {
	passport_series: { length: 4, what: 'Серия паспорта' },
	passport_number: { length: 6, what: 'Номер паспорта' },
	passport_dept_code: { length: 6, groups: [3, 3], separators: ['-'], what: 'Код подразделения' },
	snils: { length: 11, groups: [3, 3, 3, 2], separators: ['-', '-', ' '], what: 'СНИЛС' },
	reg_zip: { length: 6, what: 'Индекс' }
};

export const isDigitField = (key: string): boolean => key in DIGIT_FIELDS;

/** Сколько знаков занимает поле вместе с разделителями (для `maxlength`). */
export function digitFieldWidth(key: string): number | undefined {
	const spec = DIGIT_FIELDS[key];
	return spec ? spec.length + (spec.separators?.length ?? 0) : undefined;
}

/** Только цифры нужной длины, разделители расставляются сами: `12345678901` → `123-456-789 01` (разделитель появляется, когда за ним есть цифра). */
export function maskDigits(key: string, raw: string): string {
	const spec = DIGIT_FIELDS[key];
	if (!spec) return raw;
	const digits = raw.replace(/\D/g, '').slice(0, spec.length);
	if (!spec.groups || !spec.separators) return digits;
	let out = '';
	let at = 0;
	spec.groups.forEach((size, i) => {
		const part = digits.slice(at, at + size);
		if (!part) return;
		out += (i > 0 ? spec.separators![i - 1] : '') + part;
		at += size;
	});
	return out;
}

/** «Серия паспорта: 4 цифры»; `null` — поле пустое (необязательное) или цифр хватает. */
function digitsError(key: string, value: string): string | null {
	const spec = DIGIT_FIELDS[key];
	const digits = value.replace(/\D/g, '');
	if (!spec || !digits) return null;
	return digits.length === spec.length ? null : `${spec.what}: ${spec.length} цифр${spec.length === 4 ? 'ы' : ''}`;
}

/** Проверка до отправки (контрольную сумму СНИЛС и смысл дат проверяет сервер): только длина цифровых полей. */
export function validateProfileValues(values: Record<string, string>): Record<string, string> {
	const errors: Record<string, string> = {};
	for (const key of Object.keys(DIGIT_FIELDS)) {
		const error = digitsError(key, values[key] ?? '');
		if (error) errors[key] = error;
	}
	return errors;
}
