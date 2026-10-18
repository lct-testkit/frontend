<script lang="ts">
	// «Куда попадают заявки»: маршрут по умолчанию (тип сделки, воронка, стартовый статус, ответственный) и до десяти правил «если поле заявки равно … — другой маршрут».
	// Воронка выбирается из опубликованных; «новая» воронка создаётся в разделе «Воронки».
	import { untrack } from 'svelte';
	import { AddLarge, Trash } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, ApiError, errorMessage } from '$lib/api';
	import { Btn, ErrorState, FormDrawer, FormSection, IconBtn, Notice, Skeleton, confirm, toast } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import type { IntegrationSource, MappingTarget, Route } from '../types';
	import RouteFields from './RouteFields.svelte';
	import { EMPTY_ROUTE, MAX_RULES, OPERATORS, emptyRuleDraft, mapRoutingIssues, ruleToDraft, toRouting, validateRouting, type Operator, type RouteErrors, type RuleDraft, type RuleErrors } from './routing';
	import { TargetOptions } from './target.svelte';

	interface Props {
		open: boolean;
		source: IntegrationSource | null;
		onClose: () => void;
		/** маршрут после сохранения или сброса (`null` — прежнее поведение) */
		onSaved: () => void;
	}

	let { open, source, onClose, onSaved }: Props = $props();

	const options = new TargetOptions();
	let loading = $state(false);
	let loadError = $state<unknown>(null);
	let targets = $state<MappingTarget[]>([]);
	let had = $state(false);
	let def = $state<Route>({ ...EMPTY_ROUTE });
	let drafts = $state<RuleDraft[]>([]);
	let base = $state('');
	let defErrors = $state<RouteErrors>({});
	let ruleErrors = $state<Record<number, RuleErrors>>({});
	let formIssues = $state<string[]>([]);
	let formError = $state<string | null>(null);
	let saving = $state(false);

	const snapshot = () => JSON.stringify(toRouting(def, drafts));

	async function load() {
		if (!source) return;
		loading = true;
		loadError = null;
		try {
			const [r, m] = await Promise.all([
				unwrap(api.GET('/api/admin/integrations/sources/{code}/routing', { params: { path: { code: source.code } } })),
				unwrap(api.GET('/api/admin/integrations/sources/{code}/mapping', { params: { path: { code: source.code } } })),
				options.load()
			]);
			targets = m.targets;
			had = Boolean(r.routing);
			def = { ...EMPTY_ROUTE, ...(r.routing?.default ?? {}) };
			drafts = (r.routing?.rules ?? []).map(ruleToDraft);
			defErrors = {};
			ruleErrors = {};
			formIssues = [];
			formError = null;
			base = snapshot();
		} catch (e) {
			loadError = e;
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		if (open) untrack(() => void load());
	});

	const dirty = $derived(!loading && base !== '' && snapshot() !== base);
	const targetItems = $derived(targets.map((t) => ({ key: t.code, value: t.label })));

	async function save() {
		if (!source || saving) return;
		formError = null;
		formIssues = [];
		const v = validateRouting(def, drafts);
		defErrors = v.def;
		ruleErrors = Object.fromEntries(v.rules.map((e, i) => [i, e]));
		if (Object.keys(v.def).length || v.rules.some((e) => Object.keys(e).length)) return void (formError = 'Исправьте подсвеченные поля');
		if (source.is_active && !(await confirm({ title: 'Сохранить маршрут для включённого источника?', message: 'Новые заявки сразу пойдут по новому маршруту.', confirmLabel: 'Сохранить' }))) return;
		saving = true;
		try {
			await unwrap(api.PUT('/api/admin/integrations/sources/{code}/routing', { params: { path: { code: source.code } }, body: toRouting(def, drafts) }));
			toast.success('Маршрут заявок сохранён');
			onSaved();
			onClose();
		} catch (e) {
			if (e instanceof ApiError && e.errors.length) {
				const m = mapRoutingIssues(e.errors);
				defErrors = m.def;
				ruleErrors = m.rules;
				formIssues = m.form;
				formError = 'Сервер не принял маршрут';
			} else formError = errorMessage(e);
		} finally {
			saving = false;
		}
	}

	async function reset() {
		if (!source) return;
		if (!(await confirm({ title: 'Вернуть прежнее поведение?', message: 'Маршрут и правила будут удалены: заявки снова идут в сделки B2C в воронку по умолчанию.', confirmLabel: 'Вернуть', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/admin/integrations/sources/{code}/routing', { params: { path: { code: source.code } } }));
			toast.success('Маршрут удалён, заявки идут как раньше');
			onSaved();
			onClose();
		} catch (e) {
			toast.error(e);
		}
	}

	const removeRule = (i: number) => {
		drafts = drafts.filter((_, k) => k !== i);
		ruleErrors = {};
	};
</script>

{#snippet extra()}
	{#if had}<Btn label="Вернуть прежнее" variant="ghost" colorScheme="neutral" danger onclick={reset} />{/if}
{/snippet}

<FormDrawer {open} title={`Куда попадают заявки: ${source?.name ?? ''}`} width={760} {saving} {formError} {dirty} onSave={save} {onClose} {extra}>
	{#if loadError || options.error}
		<ErrorState error={loadError ?? options.error} onRetry={load} compact />
	{:else if loading}
		<Skeleton kind="tile" rows={1} height={220} />
	{:else}
		<Notice tone="info">Без настройки заявки с сайта становятся сделками B2C в воронке по умолчанию. Здесь можно выбрать другую воронку и стартовый статус, а заявки вузов направить в B2B.</Notice>
		{#if formIssues.length}<Notice tone="error"><ul class="m-0 pl-4">{#each formIssues as m (m)}<li>{m}</li>{/each}</ul></Notice>{/if}

		<FormSection title="По умолчанию">
			<RouteFields bind:route={def} {options} errors={defErrors} />
		</FormSection>

		<FormSection title="Правила">
			{#if drafts.length === 0}
				<p class="t-body-s m-0 text-muted">Правил нет — все заявки идут по маршруту «По умолчанию». Правило направит заявку по значению её поля, например вузы — в B2B.</p>
			{/if}
			<ol class="m-0 flex list-none flex-col gap-3 p-0">
				{#each drafts as rule, i (rule.uid)}
					{@const errs = ruleErrors[i] ?? {}}
					<li class="m-0 flex list-none flex-col gap-3 rounded-lg border border-line bg-surface p-3" aria-label={`Правило ${i + 1}`}>
						<div class="flex items-center justify-between gap-2">
							<span class="t-body-m-strong">Если поле заявки…</span>
							<IconBtn icon={Trash} label="Удалить правило" size="s" onclick={() => removeRule(i)} />
						</div>
						<div class="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] items-start gap-3 max-md:grid-cols-1">
							<Pick label="Поле заявки" required bind:value={drafts[i].target} items={targetItems} error={errs.target} search />
							<Pick label="Условие" value={rule.op} items={OPERATORS.map((o) => ({ key: o.key, value: o.value }))} onChange={(v) => (drafts[i].op = (v as Operator) ?? 'equals')} />
							<TextField label={rule.op === 'in' ? 'Значения через запятую' : 'Значение'} required bind:value={drafts[i].value} error={errs.value} placeholder={rule.op === 'in' ? 'university, vuz' : 'university'} maxlength={255} />
						</div>
						<p class="t-desc-l m-0 text-muted">…то заявка идёт так:</p>
						<RouteFields bind:route={drafts[i].route} {options} errors={errs} />
					</li>
				{/each}
			</ol>
			<div>
				<Btn label="Добавить правило" icon={AddLarge} variant="outline" colorScheme="neutral" disabled={drafts.length >= MAX_RULES} onclick={() => (drafts = [...drafts, emptyRuleDraft()])} />
			</div>
			<p class="t-desc-l m-0 text-muted">Не больше {MAX_RULES} правил; срабатывает первое подходящее. Нужной воронки нет? <a href="/workflows">Создайте её в «Воронках»</a>.</p>
		</FormSection>
	{/if}
</FormDrawer>
