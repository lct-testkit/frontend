<script lang="ts">
	// SLA-правило статуса: срок (часы / дни), порог предупреждения, рабочие дни, эскалация, каналы. Нет правила — срок не контролируется.
	import { untrack } from 'svelte';
	import { NOTIFY_CHANNEL_LABELS, NOTIFY_CHANNELS } from '../dsl';
	import { slaOf, type StatusDraft } from '../graph';
	import type { WorkflowEditor } from './editor.svelte';
	import { formatHours } from './format';
	import { FormRow, FormSection } from '$lib/ui';
	import MultiPick from '$lib/ui/fields/MultiPick.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';

	interface Props {
		editor: WorkflowEditor;
		status: StatusDraft;
	}

	let { editor, status }: Props = $props();

	const rule = $derived(slaOf(editor.draft, status.key));
	const on = $derived(Boolean(rule?.is_active));

	// единица ввода запоминается на время редактирования; при первом показе — дни, если срок кратен суткам
	let unit = $state<'hours' | 'days'>('hours');
	$effect(() => {
		void status.key;
		untrack(() => {
			const h = slaOf(editor.draft, status.key)?.max_duration_hours ?? 0;
			unit = h >= 24 && h % 24 === 0 ? 'days' : 'hours';
		});
	});
	const amount = $derived(rule ? (unit === 'days' ? Math.round(rule.max_duration_hours / 24) : rule.max_duration_hours) : null);

	function setAmount(n: number | null) {
		if (n === null) return;
		editor.setSla(status.key, { max_duration_hours: Math.max(1, unit === 'days' ? n * 24 : n) });
	}
	/** Смена единицы сохраняет число: «5 часов» → «5 дней» (в модель срок всегда пишется в часах). */
	function setUnit(next: string | null) {
		if (!next || !rule || next === unit) return;
		const n = Math.max(1, amount ?? 1);
		unit = next as 'hours' | 'days';
		editor.setSla(status.key, { max_duration_hours: unit === 'days' ? n * 24 : n });
	}
</script>

<FormSection collapsible title="Срок (SLA)" summary={on && rule ? formatHours(rule.max_duration_hours) : 'Не задан'} open={on}>
	<Toggle label="Контролировать срок в статусе" checked={on} disabled={editor.readonly} onChange={(v) => {
			if (!v) return editor.setSla(status.key, null);
			unit = 'days';
			editor.setSla(status.key, { is_active: true });
		}} />
	{#if rule && on}
		<FormRow>
			<NumberField label="Срок" integer min={1} value={amount} disabled={editor.readonly} onChange={setAmount} />
			<Pick
				label="Единица"
				value={unit}
				disabled={editor.readonly}
				items={[
					{ key: 'hours', value: 'Часов' },
					{ key: 'days', value: 'Дней' }
				]}
				onChange={setUnit}
			/>
		</FormRow>
		<NumberField
			label="Предупредить при расходе, %"
			integer
			min={1}
			max={100}
			value={rule.warn_threshold_pct}
			disabled={editor.readonly}
			onChange={(n) => n !== null && editor.setSla(status.key, { warn_threshold_pct: Math.min(100, Math.max(1, n)) })}
		/>
		<Toggle label="Считать только рабочие дни" checked={rule.count_business_days} disabled={editor.readonly} onChange={(v) => editor.setSla(status.key, { count_business_days: v })} />
		<Pick
			label="Эскалация при нарушении"
			clearable
			placeholder="Не эскалировать"
			value={rule.escalate_to_role}
			disabled={editor.readonly}
			items={[
				{ key: 'HEAD', value: 'Руководителю' },
				{ key: 'ADMIN', value: 'Администратору' }
			]}
			onChange={(v) => editor.setSla(status.key, { escalate_to_role: v })}
		/>
		<MultiPick
			label="Уведомлять через"
			search={false}
			value={rule.channels}
			disabled={editor.readonly}
			items={NOTIFY_CHANNELS.map((c) => ({ key: c, value: NOTIFY_CHANNEL_LABELS[c] }))}
			onChange={(v) => editor.setSla(status.key, { channels: v })}
		/>
	{/if}
</FormSection>
