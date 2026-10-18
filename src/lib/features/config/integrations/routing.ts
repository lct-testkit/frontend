// Куда попадают заявки источника: маршрут по умолчанию и правила «если поле заявки равно / одно из — другой маршрут».
// Чистая часть: варианты воронок и статусов, предупреждения о недоступной воронке, строка-описание для карточки, перевод правил в тело PUT и обратно.
import type { Route, Routing, RoutingRule, Workflow } from '../types';

export type DealKind = 'b2c' | 'b2b';
export const DEAL_KINDS: readonly { key: DealKind; value: string; hint: string }[] = [
	{ key: 'b2c', value: 'B2C (физлица)', hint: 'Воронка для сделок с физическими лицами.' },
	{ key: 'b2b', value: 'B2B (организации)', hint: 'Воронка для сделок с организациями: вузами, колледжами, компаниями.' }
];
const kindLabel = (k: string) => DEAL_KINDS.find((d) => d.key === k)?.value.split(' ')[0] ?? k.toUpperCase();

export const OWNER_POLICIES = [
	{ key: 'least_loaded', value: 'Менеджер с наименьшей нагрузкой', hint: 'Берётся менеджер, у которого меньше всего открытых сделок.' },
	{ key: 'organization_owner', value: 'Ответственный за вуз', hint: 'Заявка вуза уходит его менеджеру; если организации нет — как в первом варианте.' },
	{ key: 'fixed', value: 'Конкретный менеджер', hint: 'Все такие заявки получает один выбранный сотрудник.' }
] as const;

export const MAX_RULES = 10;

export interface StatusLike {
	code: string;
	name: string;
	type: string;
	sort_order: number;
	is_archived: boolean;
}

export const EMPTY_ROUTE: Route = { deal_type: 'b2c', workflow_code: null, initial_status_code: null, owner_policy: 'least_loaded', fixed_owner_id: null };

/** Опубликованные воронки нужного типа; по умолчанию — первой, затем по названию. */
export function workflowOptions(workflows: readonly Workflow[], dealType: string): { key: string; value: string }[] {
	return workflows
		.filter((w) => w.state === 'published' && w.deal_type === dealType)
		.sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name, 'ru'))
		.map((w) => ({ key: w.code, value: w.is_default ? `${w.name} (по умолчанию)` : w.name }));
}

/** Статусы, в которые можно поставить новую заявку: начальные и промежуточные, не в архиве, по порядку воронки. */
export function statusOptions(statuses: readonly StatusLike[]): { key: string; value: string }[] {
	return statuses
		.filter((s) => !s.is_archived && (s.type === 'initial' || s.type === 'intermediate'))
		.sort((a, b) => a.sort_order - b.sort_order)
		.map((s) => ({ key: s.code, value: s.name }));
}

/** Что не так с сохранённым маршрутом (воронку архивировали или сменился тип, статуса нет в графе). Пустой список — всё в порядке. */
export function routeWarnings(route: Route, workflows: readonly Workflow[], statuses: readonly StatusLike[] | null): string[] {
	const out: string[] = [];
	if (route.workflow_code) {
		const w = workflows.find((x) => x.code === route.workflow_code);
		if (!w) out.push('Выбранной воронки нет. Заявки идут в воронку по умолчанию');
		else if (w.state !== 'published') out.push('Выбранная воронка не опубликована. Заявки идут в воронку по умолчанию');
		else if (w.deal_type !== route.deal_type) out.push('Тип воронки не совпадает с типом сделки. Заявки идут в воронку по умолчанию');
	}
	if (route.initial_status_code && statuses && !statusOptions(statuses).some((s) => s.key === route.initial_status_code)) {
		out.push('Выбранного статуса нет в воронке. Заявка встанет в начальный статус');
	}
	return out;
}

/** Строка для карточки: «B2C, воронка «…», статус «…»» или «B2C, воронка по умолчанию». */
export function describeRoute(route: Route | null | undefined, workflows: readonly Workflow[], statuses?: readonly StatusLike[] | null): string {
	if (!route) return 'B2C, воронка по умолчанию';
	const w = route.workflow_code ? workflows.find((x) => x.code === route.workflow_code) : null;
	const parts = [kindLabel(route.deal_type ?? 'b2c'), w ? `воронка «${w.name}»` : route.workflow_code ? `воронка «${route.workflow_code}»` : 'воронка по умолчанию'];
	if (route.initial_status_code) parts.push(`статус «${statuses?.find((s) => s.code === route.initial_status_code)?.name ?? route.initial_status_code}»`);
	return parts.join(', ');
}

export type Operator = 'equals' | 'in';
export const OPERATORS: readonly { key: Operator; value: string }[] = [
	{ key: 'equals', value: 'равно' },
	{ key: 'in', value: 'одно из' }
];

export interface RuleDraft {
	uid: number;
	target: string | null;
	op: Operator;
	/** для «одно из» — значения через запятую */
	value: string;
	route: Route;
}

let nextUid = 1;
export const emptyRuleDraft = (): RuleDraft => ({ uid: nextUid++, target: null, op: 'equals', value: '', route: { ...EMPTY_ROUTE, deal_type: 'b2b', owner_policy: 'organization_owner' } });

export const splitList = (raw: string): string[] => raw.split(',').map((s) => s.trim()).filter(Boolean);

export function ruleToDraft(rule: RoutingRule): RuleDraft {
	const list = rule.when.in ?? null;
	return { uid: nextUid++, target: rule.when.target, op: list ? 'in' : 'equals', value: list ? list.join(', ') : (rule.when.equals ?? ''), route: { ...EMPTY_ROUTE, ...rule.route } };
}

/** Маршрут в виде для PUT: пустое — `null`, «конкретный менеджер» только с менеджером, лишнего не отправляем. */
export function cleanRoute(route: Route): Route {
	const fixed = route.owner_policy === 'fixed';
	return {
		deal_type: route.deal_type ?? 'b2c',
		workflow_code: route.workflow_code || null,
		initial_status_code: route.initial_status_code || null,
		owner_policy: route.owner_policy ?? 'least_loaded',
		fixed_owner_id: fixed ? (route.fixed_owner_id ?? null) : null
	};
}

export function toRouting(def: Route, drafts: readonly RuleDraft[]): Routing {
	return {
		default: cleanRoute(def),
		rules: drafts.map((d) => ({ when: d.op === 'in' ? { target: d.target ?? '', in: splitList(d.value) } : { target: d.target ?? '', equals: d.value.trim() }, route: cleanRoute(d.route) }))
	};
}

export type RouteErrors = Partial<Record<'workflow' | 'status' | 'owner', string>>;
export type RuleErrors = RouteErrors & Partial<Record<'target' | 'value', string>>;

const routeProblems = (r: Route): RouteErrors => (r.owner_policy === 'fixed' && !r.fixed_owner_id ? { owner: 'Выберите менеджера' } : {});

/** Проверки до отправки; сервер проверяет остальное (воронка опубликована, статус в графе, менеджер активен). */
export function validateRouting(def: Route, drafts: readonly RuleDraft[]): { def: RouteErrors; rules: RuleErrors[] } {
	return {
		def: routeProblems(def),
		rules: drafts.map((d) => ({
			...routeProblems(d.route),
			...(d.target ? {} : { target: 'Выберите поле заявки' }),
			...(splitList(d.value).length ? {} : { value: d.op === 'in' ? 'Укажите значения через запятую' : 'Укажите значение' })
		}))
	};
}

/** Ответ 422: `rules[0].route.workflow_code` → под правило и поле; `default.…` → под маршрут по умолчанию; остальное — общим списком. */
export function mapRoutingIssues(issues: readonly { field: string; reason: string }[]): { def: RouteErrors; rules: Record<number, RuleErrors>; form: string[] } {
	const out = { def: {} as RouteErrors, rules: {} as Record<number, RuleErrors>, form: [] as string[] };
	const slot = (f: string): keyof RouteErrors | null => (f.endsWith('workflow_code') ? 'workflow' : f.endsWith('initial_status_code') ? 'status' : f.endsWith('owner_id') || f.endsWith('owner_policy') ? 'owner' : null);
	for (const i of issues) {
		const m = /^rules\[(\d+)\]\.(.+)$/.exec(i.field);
		if (m) {
			const key = m[2].startsWith('when') ? (m[2].endsWith('target') ? 'target' : 'value') : slot(m[2]);
			if (key) ((out.rules[Number(m[1])] ??= {})[key] = i.reason);
			else out.form.push(i.reason);
		} else if (i.field.startsWith('default')) {
			const key = slot(i.field);
			if (key) out.def[key] = i.reason;
			else out.form.push(i.reason);
		} else out.form.push(i.field && i.field !== 'rules' ? `${i.field}: ${i.reason}` : i.reason);
	}
	return out;
}
