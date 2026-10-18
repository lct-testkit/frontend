<script lang="ts">
	// Правка карточки инцидента (ADMIN): что известно сейчас. Сроки и статус здесь не меняются — их двигают шаги процедуры. Версия карточки — `If-Match`.
	import { untrack } from 'svelte';
	import { toFormFailure } from '../../config/shared/form-errors';
	import { AreaField, FormDrawer, FormSection, MultiPick, NumberField, Pick, TextField, UserPicker } from '$lib/ui';
	import { loadIncident, patchIncident } from './api';
	import { DATA_CATEGORIES, SEVERITIES, type Incident } from './incidents';

	interface Props {
		open: boolean;
		incident: Incident;
		onClose: () => void;
		onSaved: (next: Incident) => void;
	}

	let { open, incident, onClose, onSaved }: Props = $props();

	let title = $state('');
	let severity = $state<string | null>(null);
	let description = $state('');
	let categories = $state<string[]>([]);
	let subjects = $state<number | null>(null);
	let causes = $state('');
	let harm = $state('');
	let measures = $state('');
	let summary = $state('');
	let responsible = $state<string | null>(null);
	let version = $state(0);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let conflict = $state(false);
	let saving = $state(false);

	function fill(i: Incident) {
		title = i.title;
		severity = i.severity;
		description = i.description ?? '';
		categories = [...(i.data_categories ?? [])];
		subjects = i.subjects_estimate ?? null;
		causes = i.causes ?? '';
		harm = i.harm ?? '';
		measures = i.measures ?? '';
		summary = i.investigation_summary ?? '';
		responsible = i.responsible_user_id ?? null;
		version = i.version;
	}

	$effect(() => {
		if (!open) return;
		untrack(() => {
			fill(incident);
			errors = {};
			formError = null;
			conflict = false;
		});
	});

	const extra = $derived(categories.filter((c) => !DATA_CATEGORIES.includes(c)));

	async function save() {
		const next: Record<string, string> = {};
		if (!title.trim()) next.title = 'Укажите название';
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const out = await patchIncident(
				{ ...incident, version },
				{
					title: title.trim(),
					severity: severity as 'info' | 'warning' | 'critical',
					description: description.trim() || null,
					data_categories: categories,
					subjects_estimate: subjects,
					causes: causes.trim() || null,
					harm: harm.trim() || null,
					measures: measures.trim() || null,
					investigation_summary: summary.trim() || null,
					responsible_user_id: responsible
				}
			);
			onSaved(out);
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['title', 'description', 'subjects_estimate']);
			errors = failure.fields;
			formError = failure.form;
			conflict = failure.conflict;
		} finally {
			saving = false;
		}
	}

	/** После конфликта версий: актуальная версия карточки, введённое остаётся в форме. */
	async function reload() {
		try {
			const fresh = await loadIncident(incident.id);
			version = fresh.version;
			conflict = false;
			onSaved(fresh);
		} catch (e) {
			formError = e instanceof Error ? e.message : 'Не удалось загрузить карточку';
		}
	}
</script>

<FormDrawer {open} title="Карточка инцидента" width={560} {saving} {formError} {conflict} onSave={save} {onClose} onReload={reload}>
	<TextField label="Название" required bind:value={title} error={errors.title} maxlength={255} autofocus />
	<Pick label="Серьёзность" bind:value={severity} items={SEVERITIES.map((s) => ({ key: s.key, value: s.value }))} />
	<UserPicker label="Ответственный" value={responsible} roles={['ADMIN', 'HEAD']} onChange={(id) => (responsible = id)} hint="Кто ведёт расследование и подаёт уведомление" />
	<AreaField label="Описание" bind:value={description} rows={3} maxRows={8} />
	<MultiPick label="Какие данные затронуты" bind:value={categories} items={[...DATA_CATEGORIES, ...extra].map((c) => ({ key: c, value: c }))} placeholder="Пока неизвестно" />
	<NumberField label="Сколько субъектов затронуто, примерно" bind:value={subjects} integer min={0} error={errors.subjects_estimate} />
	<FormSection title="Для уведомления РКН">
		<AreaField label="Предполагаемые причины" bind:value={causes} rows={2} maxRows={6} />
		<AreaField label="Предполагаемый вред субъектам" bind:value={harm} rows={2} maxRows={6} />
		<AreaField label="Принятые меры" bind:value={measures} rows={2} maxRows={6} />
		<AreaField label="Итоги внутреннего расследования" bind:value={summary} rows={3} maxRows={8} hint="Войдут в уведомление на 72 часа" />
	</FormSection>
</FormDrawer>
