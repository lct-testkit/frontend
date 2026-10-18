// Общая фикстура тестов: воронка из задания — 14 шагов, три завершающих статуса, переходы по правилам сида бэкенда
// (вперёд по цепочке, назад на шаг, из каждого шага в отказ и в заморозку, из заморозки обратно на шаг, с последнего шага в успех).
// Шаг 5 («корректировка документов») необязателен: при `optionalStep5` есть переход «через шаг» 4 → 6.
import type { WorkflowGraph, WorkflowStatus, WorkflowTransition } from '$lib/features/crm/types';

export const STEP_NAMES = [
	'Поиск контактов ответственного в вузе',
	'Коммуникация с ним и уточнение актуальности программ по ИТ-направлениям',
	'Организация встречи с представителями вуза',
	'Обмен необходимым пакетом документов для подписания',
	'Корректировка документов перед подписанием (опционально)',
	'Подписание документов',
	'Передача обучающих материалов по ИТ-направлению, лицензии ИТ-продукта и его документации в вуз',
	'Сопровождение внедрения ИТ-продуктов в вузе',
	'Обучение преподавателей',
	'Актуализация учебной программы по ИТ-направлению с учётом обучения преподавателя и добавления ИТ-продукта',
	'Ведение занятий',
	'Актуализация документации по продукту и обучающим материалам',
	'Повышение квалификации преподавателей',
	'Контроль за исполнением каждого этапа'
];

/** id шага N (1…14): `s1`…`s14`; завершающие — `won`, `lost`, `parked` */
export const stepId = (n: number): string => `s${n}`;

export interface Funnel14Options {
	/** есть переход «через шаг» 4 → 6 (шаг 5 необязателен) */
	optionalStep5?: boolean;
}

export function funnel14({ optionalStep5 = true }: Funnel14Options = {}): WorkflowGraph {
	const statuses: WorkflowStatus[] = STEP_NAMES.map((name, i) => ({
		id: stepId(i + 1),
		code: `step_${i + 1}`,
		name,
		type: i === 0 ? 'initial' : 'intermediate',
		sort_order: (i + 1) * 10,
		required_fields: [],
		is_archived: false
	}));
	statuses.push(
		{ id: 'won', code: 'won', name: 'Успешно закрыта', type: 'won', sort_order: 1000, required_fields: [], is_archived: false },
		{ id: 'lost', code: 'lost', name: 'Отказ', type: 'lost', sort_order: 1010, required_fields: [], is_archived: false },
		{ id: 'parked', code: 'parked', name: 'Заморожена', type: 'parked', sort_order: 1020, required_fields: [], is_archived: false }
	);

	const transitions: WorkflowTransition[] = [];
	const add = (from: string, to: string, name: string) =>
		transitions.push({ id: `t${transitions.length + 1}`, from_status_id: from, to_status_id: to, name, allowed_roles: [], conditions: {}, actions: [], requires_comment: false, sort_order: transitions.length * 10 } as WorkflowTransition);

	for (let n = 1; n < 14; n += 1) add(stepId(n), stepId(n + 1), `Далее: шаг ${n + 1}`);
	if (optionalStep5) add(stepId(4), stepId(6), 'Без корректировки: к подписанию');
	for (let n = 2; n <= 14; n += 1) add(stepId(n), stepId(n - 1), `Назад: шаг ${n - 1}`);
	if (optionalStep5) add(stepId(6), stepId(4), 'Назад: к обмену документами');
	for (let n = 1; n <= 14; n += 1) add(stepId(n), 'lost', 'Отказ');
	for (let n = 1; n <= 14; n += 1) add(stepId(n), 'parked', 'Заморозить');
	for (let n = 1; n <= 14; n += 1) add('parked', stepId(n), 'Возобновить');
	add(stepId(14), 'won', 'Успешно закрыть');

	return { workflow: { id: 'wf14', code: 'b2b_university_v2', name: 'B2B: 14 шагов', deal_type: 'b2b', state: 'published', is_default: true, version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }, statuses, transitions, sla_rules: [] } as unknown as WorkflowGraph;
}
