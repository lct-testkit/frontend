<script lang="ts">
	// Одно правило маппинга: куда положить (поле CRM), откуда взять (ключ в запросе), как преобразовать. Поля зависят от преобразования.
	import { ArrowDown, ArrowUp, Trash } from '@lct-testkit/rt-ui/icons';
	import { IconBtn } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import type { MappingTarget } from '../types';
	import { CUSTOM_TARGET, TRANSFORMS, type RuleDraft, type RuleErrors } from './mapping';

	interface Props {
		rule: RuleDraft;
		index: number;
		targets: readonly MappingTarget[];
		errors: RuleErrors;
		/** ключи примера запроса, похожие на выбранное поле */
		suggestions: string[];
		first: boolean;
		last: boolean;
		onRemove: () => void;
		onMove: (delta: -1 | 1) => void;
	}

	let { rule = $bindable(), index, targets, errors, suggestions, first, last, onRemove, onMove }: Props = $props();

	const targetItems = $derived([...targets.map((t) => ({ key: t.code, value: t.label })), { key: CUSTOM_TARGET, value: 'Своё поле сделки…' }]);
	const hint = $derived(TRANSFORMS.find((t) => t.key === rule.transform)?.hint);
</script>

<li class="m-0 flex list-none flex-col gap-3 rounded-lg border border-line bg-surface p-3" aria-label={`Правило ${index + 1}`}>
	<div class="flex items-center justify-between gap-2">
		<span class="t-body-m-strong">Правило {index + 1}</span>
		<span class="flex items-center">
			<IconBtn icon={ArrowUp} label="Выше" size="s" disabled={first} onclick={() => onMove(-1)} />
			<IconBtn icon={ArrowDown} label="Ниже" size="s" disabled={last} onclick={() => onMove(1)} />
			<IconBtn icon={Trash} label="Удалить правило" size="s" onclick={onRemove} />
		</span>
	</div>
	<div class="grid grid-cols-2 items-start gap-3 max-md:grid-cols-1">
		<Pick label="Поле CRM" required bind:value={rule.target} items={targetItems} error={errors.target} search />
		{#if rule.transform === 'join'}
			<AreaField label="Ключи в запросе, по одному в строке" required bind:value={rule.sources} rows={2} maxRows={5} error={errors.sources} />
		{:else if rule.transform === 'constant'}
			<TextField label="Значение" required bind:value={rule.constant} error={errors.constant} maxlength={255} />
		{:else}
			<TextField label="Ключ в запросе" required bind:value={rule.source} error={errors.source} placeholder="например, Телефон или contact.phone" maxlength={255} />
		{/if}
	</div>

	{#if suggestions.length && !rule.source && rule.transform !== 'join' && rule.transform !== 'constant'}
		<p class="t-desc-l m-0 flex flex-wrap items-center gap-1.5 text-muted">
			В примере есть:
			{#each suggestions as key (key)}<button type="button" class="t-desc-l cursor-pointer rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-body" onclick={() => (rule.source = key)}>{key}</button>{/each}
		</p>
	{/if}

	<div class="grid grid-cols-2 items-start gap-3 max-md:grid-cols-1">
		<Pick label="Преобразование" bind:value={rule.transform} items={TRANSFORMS.map((t) => ({ key: t.key, value: t.value }))} {hint} />
		<TextField label="Если ключа нет или пусто" bind:value={rule.defaultValue} placeholder="Ничего не подставлять" maxlength={255} />
	</div>
	{#if rule.transform === 'value_map'}
		<AreaField label="Замены, по одной в строке: что пришло = что записать" required bind:value={rule.valueMap} rows={3} maxRows={8} error={errors.value_map} placeholder="python-basics = py-base" />
	{:else if rule.transform === 'template'}
		<TextField label="Шаблон" required bind:value={rule.template} error={errors.template} placeholder={'Кампания: {value}'} maxlength={500} />
	{/if}
	<Toggle label="Обязательное: без значения заявка отклоняется" bind:checked={rule.required} />
</li>
