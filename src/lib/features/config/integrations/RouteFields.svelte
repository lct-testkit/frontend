<script lang="ts">
	// Поля одного маршрута: тип сделки, воронка, стартовый статус, кто отвечает. Воронки и статусы приходят из `TargetOptions`.
	import { untrack } from 'svelte';
	import { Notice } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import UserPicker from '$lib/ui/UserPicker.svelte';
	import type { Route } from '../types';
	import { DEAL_KINDS, OWNER_POLICIES, routeWarnings, statusOptions, workflowOptions, type RouteErrors } from './routing';
	import type { TargetOptions } from './target.svelte';

	interface Props {
		route: Route;
		options: TargetOptions;
		errors?: RouteErrors;
	}

	let { route = $bindable(), options, errors = {} }: Props = $props();

	const kind = $derived(route.deal_type ?? 'b2c');
	const code = $derived(options.effectiveCode(kind, route.workflow_code));
	$effect(() => {
		const c = code;
		untrack(() => void options.ensureStatuses(c));
	});
	const wfItems = $derived(workflowOptions(options.workflows, kind));
	const stItems = $derived(code && options.statuses[code] ? statusOptions(options.statuses[code]!) : []);
	const warnings = $derived(options.loaded ? routeWarnings({ ...route, deal_type: kind }, options.workflows, code ? (options.statuses[code] ?? null) : null) : []);

	function setKind(v: string | null) {
		route.deal_type = (v as Route['deal_type']) ?? 'b2c';
		route.workflow_code = null;
		route.initial_status_code = null;
		if (route.deal_type === 'b2c' && route.owner_policy === 'organization_owner') route.owner_policy = 'least_loaded';
	}
</script>

<div class="grid grid-cols-2 items-start gap-3 max-md:grid-cols-1">
	<Pick label="Тип сделки" value={kind} items={DEAL_KINDS.map((d) => ({ key: d.key, value: d.value, hint: d.hint }))} onChange={setKind} />
	<Pick
		label="Воронка"
		value={route.workflow_code}
		clearable
		placeholder="Воронка по умолчанию"
		items={wfItems}
		error={errors.workflow}
		hint={options.loaded && wfItems.length === 0 ? 'Нет опубликованных воронок этого типа' : undefined}
		onChange={(v) => {
			route.workflow_code = v;
			route.initial_status_code = null;
		}}
	/>
	<Pick label="Статус новой заявки" value={route.initial_status_code} clearable placeholder="Начальный статус воронки" items={stItems} error={errors.status} onChange={(v) => (route.initial_status_code = v)} />
	<Pick
		label="Кто ведёт заявку"
		value={route.owner_policy ?? 'least_loaded'}
		items={OWNER_POLICIES.filter((p) => kind === 'b2b' || p.key !== 'organization_owner').map((p) => ({ key: p.key, value: p.value, hint: p.hint }))}
		onChange={(v) => (route.owner_policy = (v as Route['owner_policy']) ?? 'least_loaded')}
	/>
</div>
{#if route.owner_policy === 'fixed'}
	<UserPicker label="Менеджер" required roles={['KAM', 'HEAD']} value={route.fixed_owner_id ?? null} error={errors.owner} onChange={(id) => (route.fixed_owner_id = id)} />
{/if}
{#each warnings as w (w)}<Notice tone="warning">{w}</Notice>{/each}
{#if options.loaded && wfItems.length === 0}
	<p class="t-desc-l m-0 text-muted">Опубликуйте воронку этого типа в разделе «<a href="/workflows">Воронки</a>».</p>
{/if}
