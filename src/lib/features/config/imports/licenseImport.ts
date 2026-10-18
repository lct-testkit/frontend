// Импорт лицензий: пример строки и шаблон файла для скачивания. Пока у бэкенда нет ручки шаблона xlsx/xls (B3-9), файл собирается в браузере
// из полей типа, которые отдаёт сервер (`GET /api/imports/entity-types`), — список колонок всегда актуален. Формат CSV: BOM и «;» — так его открывает русский Excel.
import type { ImportEntityType } from './mapping';

/** Вымышленная строка-пример по полю (`target`): вуз в ней нарочно не существует — проверка скажет «вуз не найден», остальное пройдёт. */
export const LICENSE_EXAMPLE: Record<string, string> = {
	organization_name: 'Название вуза, как в справочнике организаций',
	vendor: 'Название вендора',
	product_name: 'Название программы',
	contract_number: 'ЛД-2026/001',
	license_signed_at: '15.03.2026',
	license_valid_year: '2027',
	transfer_status: 'в работе',
	manager_full_name: 'Фамилия Имя Отчество',
	responsible_contacts: 'Фамилия И. О., должность',
	comment: 'Любой комментарий'
};

const cell = (value: string): string => (/[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);

/** CSV-шаблон: BOM, разделитель «;», первая строка — названия колонок (`label` полей типа), вторая — пример (если он известен для типа). */
export function buildTemplateCsv(type: Pick<ImportEntityType, 'fields'>, example: Record<string, string> | null = null): string {
	const lines = [type.fields.map((f) => cell(f.label)).join(';')];
	if (example) lines.push(type.fields.map((f) => cell(example[f.target] ?? '')).join(';'));
	return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const templateFileName = (code: string): string => `shablon-${code}.csv`;

/** Сохранить текст как файл (без перехода со страницы). */
export function saveTextFile(name: string, text: string, mime = 'text/csv;charset=utf-8'): void {
	const url = URL.createObjectURL(new Blob([text], { type: mime }));
	const a = document.createElement('a');
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
