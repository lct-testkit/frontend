<script lang="ts">
	// Пользовательское поле: код и тип задаются при создании; форма подстраивается под тип (варианты для списков, границы для чисел, длина и шаблон для текста).
	import { untrack } from 'svelte';
	import { TagGroup } from '@lct-testkit/rt-ui';
	import { api, unwrap, idem, ifMatch } from '$lib/api';
	import { toast } from '$lib/ui';
	import { CUSTOM_FIELD_ENTITIES, CUSTOM_FIELD_TYPES, labelOf } from '../labels';
	import type { CustomFieldDef, Workflow } from '../types';
	import { FormDrawer } from '$lib/ui';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';
	import { buildOptions, buildValidation, choicesOf, validationOf } from './custom-fields';

	type EntityType = 'deal' | 'organization' | 'contact' | 'product';
	type FieldType = 'string' | 'number' | 'date' | 'bool' | 'select' | 'multiselect' | 'file';

	interface Props {
		open: boolean;
		item: CustomFieldDef | null;
		presetEntity: string;
		nextOrder: number;
		workflows: readonly Workflow[];
		onClose: () => void;
		onSaved: () => void;
	}

	let { open, item, presetEntity, nextOrder, workflows, onClose, onSaved }: Props = $props();

	const CODE = /^[a-z][a-z0-9_]{1,63}$/;
	// «файл» бэкенд принимает, но интерфейсов ввода для него ещё нет
	const TYPES = CUSTOM_FIELD_TYPES.filter((t) => t.key !== 'file').map((t) => ({ key: t.key, value: t.value }));

	let entity = $state<string | null>('deal');
	let code = $state('');
	let label = $state('');
	let type = $state<string | null>('string');
	let required = $state(false);
	let choices = $state<string[]>([]);
	let min = $state<number | null>(null);
	let max = $state<number | null>(null);
	let maxLength = $state<number | null>(null);
	let pattern = $state('');
	let workflowId = $state<string | null>(null);
	let version = $state(0);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	const isNew = $derived(item === null);
	const listType = $derived(type === 'select' || type === 'multiselect');

	$effect(() => {
		if (!open) return;
		untrack(() => {
			entity = item?.entity_type ?? presetEntity;
			code = item?.code ?? '';
			label = item?.label ?? '';
			type = item?.field_type ?? 'string';
			required = item?.is_required ?? false;
			choices = item ? choicesOf(item) : [];
			const v = item ? validationOf(item) : {};
			min = v.min ?? null;
			max = v.max ?? null;
			maxLength = v.max_length ?? null;
			pattern = v.pattern ?? '';
			workflowId = item?.workflow_id ?? null;
			version = item?.version ?? 0;
			errors = {};
			formError = null;
			conflict = false;
			idemKey = crypto.randomUUID();
		});
	});

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (isNew && !CODE.test(code)) next.code = 'Латиница, цифры и «_», начинается с буквы (2–64 символа)';
		if (!label.trim()) next.label = 'Укажите подпись';
		if (listType && choices.length === 0) next.options = 'Добавьте хотя бы один вариант';
		if (type === 'number' && min !== null && max !== null && min > max) next.max = 'Меньше минимума';
		if (type === 'string' && pattern) {
			try {
				new RegExp(pattern);
			} catch {
				next.pattern = 'Некорректное регулярное выражение';
			}
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function save() {
		formError = null;
		if (!validate()) return;
		saving = true;
		try {
			const options = buildOptions(type ?? '', choices);
			const validation = buildValidation(type ?? '', { min: min ?? undefined, max: max ?? undefined, max_length: maxLength ?? undefined, pattern: pattern || undefined });
			if (item) {
				await unwrap(
					api.PATCH('/api/custom-field-defs/{field_id}', {
						params: { path: { field_id: item.id } },
						body: { label: label.trim(), is_required: required, options, validation },
						headers: ifMatch(version)
					})
				);
				toast.success('Поле сохранено');
			} else {
				await unwrap(
					api.POST('/api/custom-field-defs', {
						body: { entity_type: entity as EntityType, code, label: label.trim(), field_type: type as FieldType, is_required: required, options, validation, workflow_id: entity === 'deal' ? workflowId : null, sort_order: nextOrder },
						headers: idem(idemKey)
					})
				);
				toast.success('Поле создано');
			}
			onSaved();
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['code', 'label', 'entity_type', 'field_type']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	function reload() {
		onSaved();
		conflict = false;
		toast.info('Список обновлён', 'Откройте поле ещё раз, чтобы увидеть актуальные данные');
		onClose();
	}
</script>

<FormDrawer {open} title={isNew ? 'Новое поле' : label || 'Поле'} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reload}>
	{#if isNew}
		<Pick label="Для чего" bind:value={entity} items={CUSTOM_FIELD_ENTITIES.map((e) => ({ key: e.key, value: e.value }))} />
		<TextField label="Код" bind:value={code} error={errors.code} maxlength={64} placeholder="contract_number" autofocus />
	{:else}
		<div class="t-desc-l flex flex-wrap items-center gap-x-3 gap-y-1 text-muted">
			<span>{labelOf(CUSTOM_FIELD_ENTITIES, entity)}</span>
			<span class="font-mono">{code}</span>
		</div>
	{/if}
	<TextField label="Подпись" bind:value={label} error={errors.label} maxlength={255} autofocus={!isNew} />
	{#if isNew}
		<Pick label="Тип" bind:value={type} items={TYPES} />
	{:else}
		<TextField label="Тип" value={labelOf(CUSTOM_FIELD_TYPES, type)} readonly />
	{/if}
	<Toggle label="Обязательное" bind:checked={required} />

	{#if listType}
		<div class="flex flex-col gap-1.5">
			<span class="t-body-s-strong">Варианты</span>
			<TagGroup
				closable
				editable
				editLabel="Добавить вариант"
				items={choices.map((c) => ({ key: c, value: c }))}
				onAdd={(tag: { key: string; value: string }) => {
					const v = tag.value.trim();
					if (v && !choices.includes(v)) choices = [...choices, v];
				}}
				onRemove={(tag: { key: string }) => (choices = choices.filter((c) => c !== tag.key))}
			/>
			{#if errors.options}<p class="t-desc-m text-danger">{errors.options}</p>{/if}
		</div>
	{:else if type === 'number'}
		<div class="grid grid-cols-2 gap-3 max-md:grid-cols-1">
			<NumberField label="Минимум" bind:value={min} />
			<NumberField label="Максимум" bind:value={max} error={errors.max} />
		</div>
	{:else if type === 'string'}
		<NumberField label="Максимальная длина" bind:value={maxLength} integer />
		<TextField label="Шаблон (регулярное выражение)" bind:value={pattern} error={errors.pattern} placeholder="^[0-9]{6}$" />
	{/if}

	{#if isNew && entity === 'deal'}
		<Pick
			label="Только для воронки"
			bind:value={workflowId}
			clearable
			hint="Пусто — поле доступно во всех воронках"
			items={workflows.map((w) => ({ key: w.id, value: w.name }))}
		/>
	{:else if item?.workflow_id}
		<TextField label="Воронка" value={workflows.find((w) => w.id === item?.workflow_id)?.name ?? item.workflow_id} readonly />
	{/if}
</FormDrawer>
