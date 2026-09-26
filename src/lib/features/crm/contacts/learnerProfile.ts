// Профиль учащегося: как поля группируются в карточке контакта и как выглядят значения.

export interface LearnerFieldDef {
	key: string;
	label: string;
}
export interface LearnerSection {
	key: string;
	title: string;
	fields: LearnerFieldDef[];
}

const f = (key: string, label: string): LearnerFieldDef => ({ key, label });

export const LEARNER_SECTIONS: readonly LearnerSection[] = [
	{
		key: 'person',
		title: 'Общие данные',
		fields: [f('sex', 'Пол'), f('birth_date', 'Дата рождения'), f('snils', 'СНИЛС'), f('education_label', 'Образование')]
	},
	{
		key: 'passport',
		title: 'Паспорт',
		fields: [
			f('passport_series', 'Серия'),
			f('passport_number', 'Номер'),
			f('passport_issued_by', 'Кем выдан'),
			f('passport_issued_at', 'Дата выдачи'),
			f('passport_dept_code', 'Код подразделения')
		]
	},
	{
		key: 'registration',
		title: 'Регистрация',
		fields: [f('reg_zip', 'Индекс'), f('reg_region', 'Регион'), f('reg_city', 'Населённый пункт'), f('reg_street', 'Улица'), f('reg_house', 'Дом'), f('reg_apartment', 'Квартира')]
	},
	{
		key: 'diploma',
		title: 'Диплом',
		fields: [
			f('diploma_profession', 'Профессия'),
			f('diploma_institution', 'Учебное заведение'),
			f('diploma_surname', 'Фамилия в дипломе'),
			f('diploma_series', 'Серия'),
			f('diploma_number', 'Номер'),
			f('diploma_reg_number', 'Регистрационный номер'),
			f('diploma_issued_at', 'Дата выдачи')
		]
	},
	{
		key: 'dative',
		title: 'Для документов (родительный падеж)',
		fields: [f('last_name_dative', 'Фамилия'), f('first_name_dative', 'Имя'), f('middle_name_dative', 'Отчество')]
	}
];

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
