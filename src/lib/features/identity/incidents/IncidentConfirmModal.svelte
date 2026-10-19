<script lang="ts">
	// Подтвердить кандидата: с этого момента идут сроки уведомления РКН — 24 часа на первое и 72 часа на итоги расследования. Время выявления называет человек,
	// а не система: именно от него считаются сроки.
	import { untrack } from 'svelte';
	import { toFormFailure } from '../../config/shared/form-errors';
	import { AreaField, DateField, FormModal, MultiPick, Notice, NumberField, TextField, UserPicker } from '$lib/ui';
	import { confirmIncident } from './api';
	import { DATA_CATEGORIES, combineDateTime, dateValue, timeValue, type Incident } from './incidents';

	interface Props {
		open: boolean;
		incident: Incident;
		onClose: () => void;
		onDone: (next: Incident) => void;
	}

	let { open, incident, onClose, onDone }: Props = $props();

	let date = $state<string | null>(null);
	let time = $state('');
	let categories = $state<string[]>([]);
	let causes = $state('');
	let harm = $state('');
	let measures = $state('');
	let subjects = $state<number | null>(null);
	let responsible = $state<string | null>(null);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			const now = new Date();
			date = dateValue(now);
			time = timeValue(now);
			categories = [...(incident.data_categories ?? [])];
			causes = incident.causes ?? '';
			harm = incident.harm ?? '';
			measures = incident.measures ?? '';
			subjects = incident.subjects_estimate ?? null;
			responsible = incident.responsible_user_id ?? null;
			errors = {};
			formError = null;
		});
	});

	const extra = $derived(categories.filter((c) => !DATA_CATEGORIES.includes(c)));

	async function save() {
		const detected = combineDateTime(date, time);
		const next: Record<string, string> = {};
		if (!detected) next.detected = 'Укажите дату и время в формате ЧЧ:ММ';
		else if (detected.getTime() > Date.now() + 60_000) next.detected = 'Выявлено не может быть в будущем';
		errors = next;
		if (!detected || Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const out = await confirmIncident(incident, {
				detected_at: detected.toISOString(),
				data_categories: categories,
				causes: causes.trim() || null,
				harm: harm.trim() || null,
				measures: measures.trim() || null,
				subjects_estimate: subjects,
				responsible_user_id: responsible
			});
			onClose();
			onDone(out);
		} catch (e) {
			const failure = toFormFailure(e, ['detected_at', 'data_categories', 'subjects_estimate']);
			errors = { ...failure.fields, ...(failure.fields.detected_at ? { detected: failure.fields.detected_at } : {}) };
			formError = failure.conflict ? 'Карточку изменил другой администратор. Закройте окно, обновите страницу и повторите.' : failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormModal {open} title="Подтвердить инцидент" size="m" {saving} {formError} saveLabel="Подтвердить" saveTestId="incident-confirm-submit" onSave={save} {onClose}>
	<Notice class="shrink-0" tone="warning">После подтверждения начинается отсчёт: 24 часа на уведомление РКН и 72 часа на итоги расследования. Сроки считаются от времени выявления.</Notice>
	<div class="grid grid-cols-[minmax(0,1fr)_120px] items-start gap-3 max-md:grid-cols-1">
		<DateField label="Когда выявили" required bind:value={date} error={errors.detected} maxDate={new Date()} />
		<TextField label="Время" required bind:value={time} placeholder="ЧЧ:ММ" maxlength={5} inputmode="numeric" transform={(v) => v.replace(/[^0-9:]/g, '')} />
	</div>
	<UserPicker label="Ответственный" value={responsible} roles={['ADMIN', 'HEAD']} onChange={(id) => (responsible = id)} hint="Кто ведёт расследование и подаёт уведомление" />
	<MultiPick label="Какие данные затронуты" bind:value={categories} items={[...DATA_CATEGORIES, ...extra].map((c) => ({ key: c, value: c }))} placeholder="Пока неизвестно" error={errors.data_categories} />
	<NumberField label="Сколько субъектов затронуто, примерно" bind:value={subjects} integer min={0} error={errors.subjects_estimate} />
	<AreaField label="Предполагаемые причины" bind:value={causes} rows={2} maxRows={6} />
	<AreaField label="Предполагаемый вред субъектам" bind:value={harm} rows={2} maxRows={6} />
	<AreaField label="Принятые меры" bind:value={measures} rows={2} maxRows={6} />
</FormModal>
