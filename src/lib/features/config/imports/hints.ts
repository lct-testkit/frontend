// Что значат статусы задания импорта и его строк — простыми словами: подсказка над плашкой (StatusChip `hint`). Значения — imports/models.py
// (ImportJobStatus, ImportRowStatus); тест следит, чтобы ни одно значение не осталось без текста.
import { IMPORT_JOB_STATUS_INFO, IMPORT_ROW_STATUS_INFO } from './mapping';

export const IMPORT_JOB_STATUS_HINTS: Record<keyof typeof IMPORT_JOB_STATUS_INFO, string> = {
	uploaded: 'Файл загружен, колонки ещё не сопоставлены с полями CRM.',
	mapped: 'Колонки сопоставлены, осталось проверить файл.',
	validated: 'Файл проверен: можно применить импорт.',
	applying: 'Данные записываются в CRM. Дождитесь окончания.',
	completed: 'Все строки применены.',
	completed_with_errors: 'Применены не все строки: часть отклонена из-за ошибок. Список — в отчёте.',
	rolling_back: 'Изменения, сделанные импортом, отменяются.',
	rolled_back: 'Изменения, сделанные импортом, отменены.',
	failed: 'Импорт остановился из-за ошибки. Подробности — в карточке задания.'
};

export const IMPORT_ROW_STATUS_HINTS: Record<keyof typeof IMPORT_ROW_STATUS_INFO, string> = {
	ok: 'Строка прошла проверку без замечаний.',
	warn: 'Строка будет применена, но есть замечание: прочитайте его в описании.',
	error: 'В строке ошибка: она не будет применена, пока её не исправить в файле.',
	skipped: 'Строка не применена: запись уже есть или не найдена для режима импорта.',
	rolled_back: 'Изменения по строке отменены при откате импорта.',
	rollback_blocked: 'Откатить строку нельзя: к созданной записи уже привязаны другие данные, например сделка.'
};

export const importJobHint = (status: string): string | undefined => (IMPORT_JOB_STATUS_HINTS as Record<string, string>)[status];
export const importRowHint = (status: string): string | undefined => IMPORT_ROW_STATUS_HINTS[status];

// --- Формат значений поля в файле (подсказка «Какие колонки ждёт файл») ---------------------------------------------------------
// Виды полей — `imports/fields.py::FieldKind`; значения, которые понимает сервер, — `catalog/license_values.py` и `imports/fields.py`.
const FORMAT_HINTS: Record<string, string> = {
	text: 'текст',
	int: 'целое число, например 2027',
	decimal: 'число, например 1500,50',
	bool: 'да или нет',
	date: 'ГГГГ-ММ-ДД или ДД.ММ.ГГГГ',
	email: 'адрес почты',
	phone: 'телефон, например +7 900 123-45-67',
	inn: '10 или 12 цифр',
	kpp: '9 цифр',
	ogrn: '13 или 15 цифр',
	region_code: 'код региона из справочника',
	direction_code: 'код направления из справочника',
	org_type: 'вуз, колледж, компания или ИП',
	format: 'онлайн, очно или смешанный',
	product_kind: 'курс или ИТ-продукт (ПО)',
	organization_name: 'точное название вуза, как в справочнике организаций',
	transfer_status: 'передано, в работе, не начато или отказ (можно и not_started, in_progress, transferred, declined)',
	license_signed: 'да, нет или дата подписания ДД.ММ.ГГГГ',
	license_term: 'год окончания (2027), срок в годах (3 или «3 года») или «бессрочно»',
	person_name: 'Фамилия Имя Отчество одной ячейкой',
	product_list: 'несколько значений через запятую',
	contact_methods: 'способы связи через запятую: почта, чат в ТГ…',
	stream: 'номер потока, целое от 1',
	money: 'сумма, например 15000',
	currency: 'три буквы, например RUB',
	learner: 'значение из шаблона LMS'
};

/** Как записать значение поля в файле; для неизвестного вида — «текст». */
export function fieldFormatHint(kind: string): string {
	return FORMAT_HINTS[kind] ?? FORMAT_HINTS.text;
}
