import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTACHMENT_CATEGORY_LABELS, FILE_STATUS_LABELS, TRANSFER_STATUS_LABELS } from '$lib/features/crm/shared/labels';
import { LICENSE_FIELD_LABELS } from '$lib/features/crm/licenses/licenseUtils';
import { REPORT_STATUS_INFO } from '$lib/features/config/reports/params';

const read = (file: string) => readFileSync(join(resolve(process.cwd(), 'src/lib/content/help'), file), 'utf8').replace(/\r\n/g, '\n');

/** Четырнадцать шагов из задания (rtk_requiriments.md, раздел 2), дословно. */
const TASK_STEPS = [
	'поиск контактов ответственного в вузе',
	'коммуникация с ним и уточнение актуальности программ по ИТ-направлениям',
	'организация встречи с представителями вуза',
	'обмен необходимым пакетом документов для подписания',
	'опционально: корректировка документов перед подписанием',
	'подписание документов',
	'передача обучающих материалов по ИТ-направлению, лицензии ИТ-продукта и его документации в вуз',
	'сопровождение внедрения ИТ-продуктов в вузе',
	'обучение преподавателей',
	'актуализация учебной программы по ИТ-направлению с учётом обучения преподавателя и добавления ИТ-продукта',
	'ведение занятий',
	'актуализация документации по продукту и обучающим материалам',
	'повышение квалификации преподавателей',
	'контроль за исполнением каждого этапа'
];

describe('руководство пользователя совпадает с интерфейсом', () => {
	it('«Отчёты»: все статусы отчёта и срок хранения названы так же, как на экране', () => {
		const text = read('16-reports.md');
		for (const { label } of Object.values(REPORT_STATUS_INFO)) expect(text, label).toContain(label);
		expect(text).toContain('Срок хранения истёк');
	});

	it('«Файлы в сделке»: все статусы файла и категории вложений', () => {
		const text = read('17-files.md');
		for (const label of Object.values(FILE_STATUS_LABELS)) expect(text, label).toContain(label);
		for (const label of Object.values(ATTACHMENT_CATEGORY_LABELS)) expect(text, label).toContain(label);
	});

	it('«Лицензии»: десять полей задания и все статусы передачи', () => {
		const text = read('14-licenses.md');
		for (const label of LICENSE_FIELD_LABELS) expect(text, label).toContain(label);
		for (const label of Object.values(TRANSFER_STATUS_LABELS)) expect(text, label).toContain(label);
	});

	it('«Воронка из 14 шагов»: ровно 14 строк с номерами 1–14, шаги совпадают с заданием', () => {
		const rows = read('18-funnel.md')
			.split('\n')
			.filter((line) => /^\| \d+ \|/.test(line))
			.map((line) => line.split('|').map((cell) => cell.trim()));
		expect(rows.map((r) => Number(r[1]))).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
		expect(rows.map((r) => r[2])).toEqual(TASK_STEPS);
	});
});
