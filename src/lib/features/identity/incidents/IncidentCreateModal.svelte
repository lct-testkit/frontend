<script lang="ts">
	// Завести инцидент вручную: кандидат, который администратор потом подтвердит (с подтверждения идут сроки РКН 24 и 72 часа).
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { toFormFailure } from '../../config/shared/form-errors';
	import { AreaField, FormModal, MultiPick, NumberField, Pick, TextField } from '$lib/ui';
	import { DATA_CATEGORIES, SEVERITIES } from './incidents';

	interface Props {
		open: boolean;
		onClose: () => void;
		onCreated: (id: string) => void;
	}

	let { open, onClose, onCreated }: Props = $props();

	let title = $state('');
	let severity = $state<string | null>('warning');
	let description = $state('');
	let categories = $state<string[]>([]);
	let subjects = $state<number | null>(null);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);
	let idemKey = crypto.randomUUID();

	$effect(() => {
		if (!open) return;
		untrack(() => {
			title = description = '';
			severity = 'warning';
			categories = [];
			subjects = null;
			errors = {};
			formError = null;
			idemKey = crypto.randomUUID();
		});
	});

	async function save() {
		const next: Record<string, string> = {};
		if (!title.trim()) next.title = 'Опишите инцидент в одной строке';
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const created = await unwrap(
				api.POST('/api/admin/incidents', {
					body: { title: title.trim(), severity: severity as 'info' | 'warning' | 'critical', description: description.trim() || null, data_categories: categories, subjects_estimate: subjects },
					headers: { 'Idempotency-Key': idemKey }
				})
			);
			onClose();
			onCreated(created.id);
		} catch (e) {
			const failure = toFormFailure(e, ['title', 'description', 'subjects_estimate']);
			errors = { ...failure.fields, ...(failure.fields.subjects_estimate ? { subjects: failure.fields.subjects_estimate } : {}) };
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormModal {open} title="Завести инцидент" size="m" {saving} {formError} saveLabel="Завести" onSave={save} {onClose}>
	<TextField label="Что случилось" required bind:value={title} error={errors.title} maxlength={255} placeholder="Например: письмо с выгрузкой ушло не тому адресату" autofocus />
	<Pick label="Серьёзность" bind:value={severity} items={SEVERITIES.map((s) => ({ key: s.key, value: s.value }))} />
	<AreaField label="Описание" bind:value={description} error={errors.description} rows={3} maxRows={8} hint="Что известно: когда заметили, где, какие данные могли попасть наружу" />
	<MultiPick label="Какие данные затронуты" bind:value={categories} items={DATA_CATEGORIES.map((c) => ({ key: c, value: c }))} placeholder="Пока неизвестно" />
	<NumberField label="Сколько субъектов затронуто, примерно" bind:value={subjects} integer min={0} error={errors.subjects} />
</FormModal>
