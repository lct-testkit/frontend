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
