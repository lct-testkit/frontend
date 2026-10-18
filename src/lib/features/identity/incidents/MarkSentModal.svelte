<script lang="ts">
	// Отметить, что уведомление РКН подано: номер или ссылка подачи на портале и время. Само уведомление система не подаёт.
	import { untrack } from 'svelte';
	import { toFormFailure } from '../../config/shared/form-errors';
	import { DateField, FormModal, Notice, TextField } from '$lib/ui';
	import { markRknSent } from './api';
	import { combineDateTime, dateValue, timeValue, type Incident, type IncidentStage } from './incidents';

	interface Props {
		open: boolean;
		incident: Incident;
		stage: IncidentStage;
		onClose: () => void;
		onDone: (next: Incident) => void;
	}

	let { open, incident, stage, onClose, onDone }: Props = $props();

	let reference = $state('');
	let date = $state<string | null>(null);
	let time = $state('');
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			const now = new Date();
			reference = '';
			date = dateValue(now);
			time = timeValue(now);
			errors = {};
			formError = null;
		});
	});

	async function save() {
		const sent = combineDateTime(date, time);
		const next: Record<string, string> = {};
		if (!reference.trim()) next.reference = 'Укажите номер или ссылку подачи';
		if (!sent) next.sent = 'Укажите дату и время в формате ЧЧ:ММ';
		else if (sent.getTime() > Date.now() + 60_000) next.sent = 'Время подачи не может быть в будущем';
		errors = next;
		if (!sent || Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const out = await markRknSent(incident, stage, reference.trim(), sent.toISOString());
			onClose();
			onDone(out);
		} catch (e) {
			const failure = toFormFailure(e, ['reference', 'sent_at']);
			errors = { ...failure.fields, ...(failure.fields.sent_at ? { sent: failure.fields.sent_at } : {}) };
			formError = failure.conflict ? 'Карточку изменил другой администратор. Закройте окно, обновите страницу и повторите.' : failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormModal {open} title={stage === '72h' ? 'Уведомление 72 часа подано' : 'Уведомление 24 часа подано'} size="m" {saving} {formError} saveLabel="Отметить" saveTestId="mark-sent-submit" onSave={save} {onClose}>
	<Notice class="shrink-0" tone="info">Сначала сформируйте текст уведомления: без него отметить подачу нельзя.</Notice>
	<TextField label="Номер или ссылка подачи" required bind:value={reference} error={errors.reference} maxlength={255} placeholder="Номер обращения на портале РКН" autofocus />
	<div class="grid grid-cols-[minmax(0,1fr)_120px] items-start gap-3 max-md:grid-cols-1">
		<DateField label="Когда подано" required bind:value={date} error={errors.sent} maxDate={new Date()} />
		<TextField label="Время" required bind:value={time} placeholder="ЧЧ:ММ" maxlength={5} inputmode="numeric" />
	</div>
</FormModal>
