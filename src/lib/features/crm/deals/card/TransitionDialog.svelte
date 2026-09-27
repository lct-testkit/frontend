<script lang="ts">
	// Диалог перехода по статусу: чек-лист условий (с флагами satisfied от бэкенда), поля, которые можно заполнить прямо здесь,
	// подсказки для остального (файлы, подпись, задачи) и комментарий. Бэкенд остаётся арбитром: его отказы (CRM-1201…1206, 1002)
	// показываются понятными фразами, введённое не теряется.
	import { untrack } from 'svelte';
	import { ArrowRight, CheckSmall, CloseSmall } from '@lct-testkit/rt-ui/icons';
	import { ApiError, api, errorMessage, ifMatch, unwrap } from '$lib/api';
	import { CheckField, FormModal, Notice, StatusChip, toast } from '$lib/ui';
	import { mayClose } from '$lib/ui/form-close';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import Ico from '../../shared/Ico.svelte';
	import { dealFieldDefs, lossReasons } from '../../shared/refs.svelte';
	import { LOSS_REASON_CATEGORY_LABELS } from '../../shared/labels';
	import type { AvailableTransition, Deal, WorkflowGraph } from '../../types';
	import { currentText, describeCondition, type ConditionLike } from '../conditions';
	import { statusName, statusTone, transitionKind } from '../statusUtils';
	import { buildTransitionForm, isOtherReason, serializeTransitionFields, unmetAlternatives, type TransitionFormField } from '../transitionForm';

	interface Props {
		open: boolean;
		deal: Deal;
		transition: AvailableTransition;
		graph: WorkflowGraph | undefined;
		onClose: () => void;
		onDone: (deal: Deal, transition: AvailableTransition) => void;
		/** подсказки-ссылки: перейти на вкладку карточки (`files`, `signing`, `tasks`) или открыть редактирование (`edit`) */
		onNavigate?: (target: 'files' | 'signing' | 'tasks' | 'edit') => void;
		/** конфликт версий: родитель перечитывает сделку, диалог получает свежий `deal` и вводимое сохраняется */
		onConflict?: () => Promise<void> | void;
	}

	let { open, deal, transition, graph, onClose, onDone, onNavigate, onConflict }: Props = $props();

	// бэкенд может не прислать `conditions` — считаем, что условий нет
	const tr = $derived({ ...transition, conditions: transition.conditions ?? [] });
	const current = $derived(graph?.statuses.find((s) => s.id === deal.status_id));
	const target = $derived(graph?.statuses.find((s) => s.id === transition.to_status_id));
	const defs = $derived(dealFieldDefs.value ?? []);
	const tree = $derived(graph?.transitions.find((t) => t.id === transition.id)?.conditions ?? null);
	const form = $derived(buildTransitionForm({ transition: tr, conditionTree: tree, targetStatus: target, deal, customFieldDefs: defs }));
	const kind = $derived(transitionKind(target, current));

	/** выбрана «другая причина» (отказа или заморозки): бэкенд не хранит её отдельным полем, поэтому её вписывают в комментарий — он становится обязательным */
	const otherReason = $derived(
		form.fields.some((f) => {
			const v = values[f.key];
			if (f.input !== 'select' || !v) return false;
			if (f.key === 'loss_reason_id') {
				const r = lossReasons.value?.find((x) => x.id === v);
				return isOtherReason(r?.name, r?.category);
			}
			const o = f.options?.find((x) => x.key === v);
			return isOtherReason(o?.value, o?.key === 'other' ? 'other' : null);
		})
	);
	const commentRequired = $derived(form.needsComment || otherReason);

	let values = $state<Record<string, unknown>>({});
	let comment = $state('');
	let errors = $state<Record<string, string>>({});
	let banner = $state<{ tone: 'error' | 'warning'; text: string; conflict?: boolean; unmet?: ConditionLike[] } | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (open) {
			void dealFieldDefs.ensure().catch(() => {});
			void lossReasons.ensure().catch(() => {});
		}
	});

	// значения полей появляются, когда стали известны определения полей (граф + справочник); ввод пользователя не перетирается
	$effect(() => {
		const fields = form.fields;
		untrack(() => {
			for (const f of fields) if (!(f.key in values)) values[f.key] = f.currentValue ?? null;
		});
	});

	const lossItems = $derived(
		(lossReasons.value ?? []).map((r) => ({ key: r.id, value: r.name, hint: LOSS_REASON_CATEGORY_LABELS[r.category] ?? r.category }))
	);
	const CURRENCIES = [
		{ key: 'RUB', value: 'Рубли, ₽' },
		{ key: 'USD', value: 'Доллары, $' },
		{ key: 'EUR', value: 'Евро, €' }
	];

	const setValue = (key: string, value: unknown) => {
		values[key] = value;
		if (errors[key]) errors = { ...errors, [key]: '' };
		// заполнили одно поле группы «одно из» — ошибка снимается со всех её полей
		const group = form.alternatives.find((g) => g.includes(key));
		if (group && value !== null && value !== '' && group.some((k) => errors[k])) errors = { ...errors, ...Object.fromEntries(group.map((k) => [k, ''])) };
	};
	const asNumber = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
	const asString = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

	/** листья условий, сгруппированные так же, как в дереве воронки («все» / «одно из»); без дерева — одним списком */
	const groups = $derived.by(() => {
		if (!tr.conditions.length) return [];
		if (!form.groups.length) return [{ mode: 'all' as const, leaves: tr.conditions }];
		return form.groups.map((g) => ({ mode: g.mode, leaves: tr.conditions.filter((c) => g.fields.includes(c.field)) })).filter((g) => g.leaves.length);
	});

	// сообщения о переходе стоят в подвале окна (над кнопками), а не над полями: появившаяся плашка не сдвигает форму
	const formError = $derived(
		banner && !banner.conflict
			? banner.unmet?.length
				? `${banner.text} Что не выполнено — в списке выше.`
				: banner.text
			: null
	);

	const title = $derived(transition.name);
	const danger = $derived(kind === 'lost');
	const actionLabel = $derived(kind === 'lost' ? 'Отказ' : kind === 'parked' ? 'Заморозить' : kind === 'won' ? 'Закрыть сделку' : kind === 'back' ? 'Вернуть' : 'Перейти');
	const missingHints = $derived(form.hints.filter((h) => !h.satisfied));
	/** подсказка-ссылка к строке условия (файлы, подпись, задачи) — показываем прямо в чек-листе */
	const hintOf = (leaf: ConditionLike) => missingHints.find((h) => h.field === leaf.field);
	/** подсказки без строки в чек-листе (обязательные поля статуса, роль) */
	const looseHints = $derived(missingHints.filter((h) => !tr.conditions.some((c) => c.field === h.field)));

	function validate(): boolean {
		const next: Record<string, string> = {};
		for (const f of form.fields) {
			const v = values[f.key];
			const bad = f.input === 'bool' ? v !== (f.expected ?? true) : v === null || v === undefined || v === '';
			if (f.required && bad) next[f.key] = f.input === 'bool' ? 'Нужно подтвердить' : 'Заполните поле';
		}
		// группа «одно из»: хватит любого поля, но не заполнено ни одно
		const satisfiedNow = new Set(tr.conditions.filter((c) => c.satisfied).map((c) => c.field));
		for (const key of unmetAlternatives(form, values, satisfiedNow)) next[key] = 'Заполните одно из полей';
		if (commentRequired && !comment.trim()) next.comment = otherReason ? 'Опишите причину' : 'Укажите комментарий';
		errors = next;
		return Object.keys(next).length === 0;
	}

	const unmetOf = (extra: unknown): ConditionLike[] =>
		Array.isArray(extra) ? extra.filter((x): x is ConditionLike => typeof x === 'object' && x !== null && typeof (x as ConditionLike).field === 'string') : [];

	function fail(e: unknown) {
		if (e instanceof ApiError) {
			switch (e.code) {
				case 'CRM-1002':
					banner = { tone: 'warning', conflict: true, text: 'Сделка изменена другим пользователем. Обновите данные — введённое сохранится.' };
					return;
				case 'CRM-1201':
					banner = { tone: 'error', text: 'Условия перехода не выполнены.', unmet: unmetOf(e.extra.unmet) };
					return;
				case 'CRM-1202':
					banner = { tone: 'error', text: 'Этот переход недоступен вашей роли.' };
					return;
				case 'CRM-1203':
					banner = { tone: 'error', conflict: true, text: 'Сделка уже закрыта.' };
					return;
				case 'CRM-1204':
					errors = { ...errors, comment: 'Укажите комментарий' };
					return;
				case 'CRM-1205':
					banner = { tone: 'error', text: 'Заполните обязательные поля.' };
					return;
				case 'CRM-1206':
					banner = { tone: 'error', text: 'Нужен подписанный документ — вкладка «Подписание».' };
					return;
				case 'CRM-9503':
					banner = { tone: 'warning', conflict: true, text: 'Сделку сейчас обрабатывает другой переход. Повторите попытку через пару секунд.' };
					return;
			}
		}
		banner = { tone: 'error', text: errorMessage(e) };
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		try {
			await onConflict?.();
			banner = null;
		} finally {
			busy = false;
		}
	}

	async function submit() {
		if (busy || form.blocked || !validate()) return;
		busy = true;
		banner = null;
		try {
			const res = await unwrap(
				api.POST('/api/deals/{deal_id}/transition', {
					params: { path: { deal_id: deal.id } },
					headers: ifMatch(deal.version),
					body: { to_status_id: transition.to_status_id, comment: comment.trim() || null, fields: serializeTransitionFields(values, form.fields) }
				})
			);
			toast.success(`Статус: «${target?.name ?? ''}»`);
			onDone(res.deal, transition);
		} catch (e) {
			fail(e);
		} finally {
			busy = false;
		}
	}

	const HINT_TARGET = { attachment: 'files', signature: 'signing', tasks: 'tasks', edit: 'edit' } as const;
	const HINT_LINK = { attachment: 'К файлам', signature: 'К подписанию', tasks: 'К задачам', edit: 'Редактировать' } as const;

	/** несохранённый ввод — как для закрытия диалога (`dirty` ниже), так и для ухода по ссылке-подсказке */
	const inputDirty = $derived(comment.trim().length > 0);

	/** ссылка-подсказка уходит со страницы диалога: тот же вопрос, что и при закрытии, иначе комментарий тихо теряется */
	async function goNavigate(target: 'files' | 'signing' | 'tasks' | 'edit') {
		if (await mayClose(inputDirty)) onNavigate?.(target);
	}

	/** кнопка-переход плашки («К файлам», «К подписанию»…); у остальных подсказок кнопки нет */
	function navActions(kind: string | undefined): { label: string; onclick: () => void }[] {
		if (!onNavigate || !kind || !(kind in HINT_TARGET)) return [];
		return [{ label: HINT_LINK[kind as keyof typeof HINT_LINK], onclick: () => void goNavigate(HINT_TARGET[kind as keyof typeof HINT_TARGET]) }];
	}

</script>

{#snippet leafText(leaf: ConditionLike)}
	{describeCondition(leaf, defs)}
	{#if !leaf.satisfied && currentText(leaf)}<span class="text-muted"> · {currentText(leaf)}</span>{/if}
	{#if leaf.field.startsWith('attachments.') && !leaf.satisfied}<span class="text-muted"> · сервер пока не проверяет вложения</span>{/if}
{/snippet}

<!-- выполненное условие — тихая строка с галочкой; невыполненное — плашка Notice с кнопкой перехода («К файлам», «К подписанию»…) -->
{#snippet leafRow(leaf: ConditionLike)}
	{#if leaf.satisfied}
		<li class="flex items-start gap-2">
			<Ico icon={leaf.satisfied ? CheckSmall : CloseSmall} tone={leaf.satisfied ? 'success' : 'danger'} size={20} class="mt-px" />
			<span class={['t-body-m min-w-0 flex-1 break-words', leaf.satisfied ? 'text-muted' : 'text-fg']}>{@render leafText(leaf)}</span>
		</li>
	{:else}
		<li><Notice class="shrink-0" tone="warning" actions={navActions(hintOf(leaf)?.kind)}>{@render leafText(leaf)}</Notice></li>
	{/if}
{/snippet}

<FormModal {open} size="m" {title} saveLabel={actionLabel} {danger} saveTestId="transition-submit" saving={busy} canSave={!form.blocked} dirty={open && inputDirty} {formError} conflict={!!banner?.conflict} conflictText={banner?.text} reloadLabel="Обновить" onReload={refresh} onSave={submit} {onClose}>
	<div class="flex flex-wrap items-center gap-2">
		{#if current}<StatusChip label={statusName(current.name)} color={current.color} tone={statusTone(current.type)} />{/if}
		<Ico icon={ArrowRight} tone="soft" size={20} />
		{#if target}<StatusChip label={statusName(target.name)} color={target.color} tone={statusTone(target.type)} />{/if}
	</div>

	{#if groups.length}
		<div class="flex flex-col gap-2" data-testid="conditions">
			{#each groups as group, gi (gi)}
				<div class="flex flex-col gap-1.5">
					{#if groups.length > 1 || group.mode === 'any'}
						<span class="t-desc-l text-muted">{group.mode === 'any' ? 'Достаточно одного из условий' : 'Нужно выполнить'}</span>
					{/if}
					<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
						{#each group.leaves as leaf, li (li)}{@render leafRow(leaf)}{/each}
					</ul>
				</div>
			{/each}
		</div>
	{/if}

	{#if looseHints.length}
		<div class="flex flex-col gap-2">
			{#each looseHints as hint, i (i)}
				<Notice class="shrink-0" tone="warning" actions={navActions(hint.kind)}>{hint.text}</Notice>
			{/each}
		</div>
	{/if}

	{#each form.fields as field (field.key)}
		{@render fieldInput(field)}
	{/each}

	<AreaField
		label={otherReason ? 'Опишите причину' : 'Комментарий'}
		required={commentRequired}
		value={comment}
		rows={2}
		error={errors.comment || undefined}
		onInput={(v) => {
			comment = v;
			if (errors.comment) errors = { ...errors, comment: '' };
		}}
		onSubmit={submit}
	/>
</FormModal>

{#snippet fieldInput(field: TransitionFormField)}
	{@const error = errors[field.key] || undefined}
	{#if field.input === 'money'}
		<NumberField label={field.label} required={field.required} value={asNumber(values[field.key])} {error} onChange={(v) => setValue(field.key, v)} />
	{:else if field.input === 'number'}
		<NumberField integer label={field.label} required={field.required} value={asNumber(values[field.key])} {error} onChange={(v) => setValue(field.key, v)} />
	{:else if field.input === 'date'}
		<DateField label={field.label} required={field.required} value={asString(values[field.key]) || null} {error} onChange={(v) => setValue(field.key, v)} />
	{:else if field.input === 'currency'}
		<Pick label={field.label} required={field.required} items={CURRENCIES} value={asString(values[field.key]) || null} {error} onChange={(v) => setValue(field.key, v)} />
	{:else if field.input === 'select' && field.key === 'loss_reason_id'}
		<Pick label={field.label} required={field.required} items={lossItems} search value={asString(values[field.key]) || null} {error} emptyText="Причин пока нет" onChange={(v) => setValue(field.key, v)} />
	{:else if field.input === 'select'}
		<Pick label={field.label} required={field.required} items={field.options ?? []} value={asString(values[field.key]) || null} {error} onChange={(v) => setValue(field.key, v)} />
	{:else if field.input === 'bool'}
		<CheckField label={field.label} required={field.required} checked={values[field.key] === (field.expected ?? true)} {error} onChange={(v) => setValue(field.key, v ? (field.expected ?? true) : false)} />
	{:else}
		<TextField label={field.label} required={field.required} value={asString(values[field.key])} {error} onInput={(v) => setValue(field.key, v)} />
	{/if}
{/snippet}
