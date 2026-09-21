<script lang="ts">
	// Конструктор условий перехода: группы «все / любое из» (вложение до 5 уровней), строка = поле · оператор · значение по типу поля.
	// Внизу — фраза человеческим языком; JSON пользователь не видит.
	import { Segment, SegmentedControl, TagGroup } from '@lct-testkit/rt-ui';
	import { AddLarge, Trash } from '@lct-testkit/rt-ui/icons';
	import { Btn, IconBtn } from '$lib/ui';
	import {
		DATE_OPERATORS,
		LIST_OPERATORS,
		MAX_CONDITION_DEPTH,
		OPERATOR_LABELS,
		VALUELESS_OPERATORS,
		describeCondition,
		findField,
		groupBranches,
		isGroup,
		type Condition,
		type ConditionGroup,
		type ConditionLeaf,
		type ConditionNode,
		type FieldDef,
		type Operator
	} from '../dsl';
	import { appendTo, depthOf, newLeaf, normalizeRoot, operatorsFor, removeAt, replaceAt, setKind, toCondition, withField, withOperator, type Path } from '../condition-tree';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick, { type PickItem } from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';

	interface Props {
		value: Condition;
		catalogue: readonly FieldDef[];
		disabled?: boolean;
		onChange: (next: Condition) => void;
	}

	let { value, catalogue, disabled = false, onChange }: Props = $props();

	const root = $derived(normalizeRoot(value));
	const emit = (next: ConditionGroup) => onChange(toCondition(next));

	const GROUP_TITLES: Record<FieldDef['group'], string> = { deal: 'Сделка', custom: 'Пользовательские поля', attachment: 'Вложения' };
	const fieldItems = $derived.by<PickItem[]>(() => {
		const out: PickItem[] = [];
		for (const group of ['deal', 'custom', 'attachment'] as const) {
			const fields = catalogue.filter((f) => f.group === group);
			if (fields.length) out.push({ key: `__${group}`, value: GROUP_TITLES[group], title: true }, ...fields.map((f) => ({ key: f.key, value: f.label })));
		}
		return out;
	});
	const fieldItemsFor = (leaf: ConditionLeaf): PickItem[] => (leaf.field && !catalogue.some((f) => f.key === leaf.field) ? [...fieldItems, { key: leaf.field, value: findField(leaf.field, catalogue)?.label ?? leaf.field }] : fieldItems);

	const BOOL_ITEMS: PickItem[] = [
		{ key: 'true', value: 'Да' },
		{ key: 'false', value: 'Нет' }
	];

	const setLeaf = (path: Path, leaf: ConditionLeaf) => emit(replaceAt(root, path, leaf));
	const asList = (leaf: ConditionLeaf): string[] => (Array.isArray(leaf.value) ? leaf.value.map(String) : []);
</script>

{#snippet valueEditor(leaf: ConditionLeaf, path: Path, field: FieldDef | undefined)}
	{#if VALUELESS_OPERATORS.has(leaf.op)}
		<span class="t-desc-l self-center text-soft">значение не нужно</span>
	{:else if LIST_OPERATORS.has(leaf.op)}
		{#if field?.options}
			<MultiPick placeholder="Выберите" items={field.options.map((o) => ({ key: o.key, value: o.value }))} value={asList(leaf)} {disabled} onChange={(v) => setLeaf(path, { ...leaf, value: v })} />
		{:else}
			<TagGroup
				closable
				editable
				editLabel="Добавить"
				items={asList(leaf).map((v) => ({ key: v, value: v }))}
				onAdd={(tag: { value: string }) => tag.value.trim() && setLeaf(path, { ...leaf, value: [...asList(leaf), tag.value.trim()] })}
				onRemove={(tag: { key: string }) => setLeaf(path, { ...leaf, value: asList(leaf).filter((v) => v !== tag.key) })}
			/>
		{/if}
	{:else if field?.kind === 'boolean'}
		<Pick items={BOOL_ITEMS} value={leaf.value === undefined ? null : String(leaf.value)} {disabled} onChange={(v) => setLeaf(path, { ...leaf, value: v === 'true' })} />
	{:else if field?.options}
		<Pick items={field.options.map((o) => ({ key: o.key, value: o.value }))} value={typeof leaf.value === 'string' ? leaf.value : null} {disabled} placeholder="Значение" onChange={(v) => setLeaf(path, { ...leaf, value: v ?? '' })} />
	{:else if field?.kind === 'money' || field?.kind === 'number'}
		<NumberField value={typeof leaf.value === 'number' ? leaf.value : leaf.value === '' || leaf.value === undefined ? null : Number(leaf.value)} {disabled} placeholder="Число" onChange={(n) => setLeaf(path, { ...leaf, value: n ?? '' })} />
	{:else if field?.kind === 'date' || DATE_OPERATORS.has(leaf.op)}
		<DateField value={typeof leaf.value === 'string' && /^\d{4}-/.test(leaf.value) ? leaf.value : null} {disabled} onChange={(v) => setLeaf(path, { ...leaf, value: v ?? '' })} />
	{:else}
		<TextField value={typeof leaf.value === 'string' || typeof leaf.value === 'number' ? String(leaf.value) : ''} {disabled} placeholder="Значение" onInput={(v) => setLeaf(path, { ...leaf, value: v })} />
	{/if}
{/snippet}

{#snippet leafRow(leaf: ConditionLeaf, path: Path)}
	{@const field = findField(leaf.field, catalogue)}
	<div class="flex flex-col gap-2 rounded-md border border-line bg-surface p-2">
		<div class="flex items-start gap-1">
			<Pick class="min-w-0 flex-1" search placeholder="Поле" items={fieldItemsFor(leaf)} value={leaf.field || null} {disabled} onChange={(f) => f && setLeaf(path, withField(leaf, findField(f, catalogue)))} />
			{#if !disabled}<IconBtn icon={Trash} label="Убрать условие" danger onclick={() => emit(removeAt(root, path))} />{/if}
		</div>
		<div class="grid grid-cols-2 gap-2">
			<Pick
				items={operatorsFor(field).map((o: Operator) => ({ key: o, value: OPERATOR_LABELS[o] }))}
				value={leaf.op}
				{disabled}
				onChange={(o) => o && setLeaf(path, withOperator(leaf, o as Operator))}
			/>
			<div class="min-w-0">{@render valueEditor(leaf, path, field)}</div>
		</div>
	</div>
{/snippet}

{#snippet groupBox(group: ConditionGroup, path: Path)}
	{@const { kind, branches } = groupBranches(group)}
	<div class={['flex flex-col gap-2', path.length > 0 && 'rounded-md border border-dashed border-line-strong p-2']}>
		<div class="flex items-center gap-2">
			<SegmentedControl size="s" value={kind} onChange={(k: string) => !disabled && emit(setKind(root, path, k as 'all' | 'any'))}>
				<Segment index="all" label="Все из" />
				<Segment index="any" label="Любое из" />
			</SegmentedControl>
			{#if path.length > 0 && !disabled}<IconBtn icon={Trash} label="Убрать группу" danger size="s" class="ml-auto" onclick={() => emit(removeAt(root, path))} />{/if}
		</div>
		{#each branches as branch, i (i)}
			{@const childPath = [...path, i]}
			{#if isGroup(branch)}{@render groupBox(branch as ConditionGroup, childPath)}{:else}{@render leafRow(branch as ConditionLeaf, childPath)}{/if}
		{/each}
		{#if !disabled}
			<div class="flex flex-wrap gap-2">
				<Btn label="Условие" icon={AddLarge} size="s" variant="outline" colorScheme="neutral" onclick={() => emit(appendTo(root, path, newLeaf(catalogue[0])))} />
				{#if depthOf(path) < MAX_CONDITION_DEPTH}
					<Btn label="Группа" icon={AddLarge} size="s" variant="ghost" colorScheme="neutral" onclick={() => emit(appendTo(root, path, { any: [newLeaf(catalogue[0])] } as ConditionNode))} />
				{/if}
			</div>
		{/if}
	</div>
{/snippet}

<div class="flex flex-col gap-2">
	{@render groupBox(root, [])}
	<p class="t-desc-l rounded-md bg-surface-2 px-2.5 py-1.5 text-muted">{describeCondition(value, catalogue)}</p>
</div>
