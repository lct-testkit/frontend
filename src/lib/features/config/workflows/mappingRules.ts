// Правила переноса сделок при архивации статуса: «если условие — в этот статус, иначе — в целевой». Чистая логика (тесты рядом).
// Бэкенд принимает `mapping_rules` и сохраняет их в задаче переноса, но пока не применяет (в схеме: «сейчас не влияет на перенос»),
// поэтому в мастере блок «Правила по условиям» не показывается; модуль готов к включению вместе с B9 (применение правил).
import { describeCondition, isEmptyCondition, type Condition, type FieldDef } from './dsl';
import { validateCondition } from './dsl-validate';

export interface MappingRule {
	/** условие в формате дерева переходов (`all` / `any`) */
	when: Condition;
	/** id статуса, куда уходит сделка, подошедшая под условие */
	to: string;
}

/** Тело `mapping_rules` запроса архивации: без правил — пустой объект (поле не влияет на перенос). */
export function toRequest(rules: readonly MappingRule[]): { rules?: { when: Condition; to_status_id: string }[] } {
	return rules.length ? { rules: rules.map((r) => ({ when: r.when, to_status_id: r.to })) } : {};
}

export interface RuleContext {
	/** архивируемый статус: сам в себя переносить нельзя */
	archiving: string;
	statuses: readonly { id: string | null; name: string; is_archived: boolean }[];
	knownCustomFields?: ReadonlySet<string>;
}

/** Ошибки правил по порядку строк (пустой список у строки — всё в порядке): цель существует, не архивная, не сам статус; условие не пустое и корректное. */
export function validateRules(rules: readonly MappingRule[], ctx: RuleContext): string[][] {
	return rules.map((rule) => {
		const errors: string[] = [];
		const target = ctx.statuses.find((s) => s.id === rule.to);
		if (!rule.to || !target) errors.push('Выберите статус, куда перенести');
		else if (target.is_archived) errors.push(`Статус «${target.name}» уже в архиве`);
		else if (rule.to === ctx.archiving) errors.push('Нельзя переносить в архивируемый статус');
		if (isEmptyCondition(rule.when)) errors.push('Укажите условие');
		else errors.push(...validateCondition(rule.when, { knownCustomFields: ctx.knownCustomFields, path: 'Условие' }));
		return errors;
	});
}

/** «Если подписан документ → «Подписание документов»». */
export function describeRule(rule: MappingRule, statusName: (id: string) => string, catalogue?: readonly FieldDef[]): string {
	return `Если ${describeCondition(rule.when, catalogue).toLowerCase()} → «${statusName(rule.to)}»`;
}
