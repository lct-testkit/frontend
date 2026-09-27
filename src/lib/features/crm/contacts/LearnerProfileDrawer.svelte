<script lang="ts">
	// Правка профиля учащегося. Значения в профиле замаскированы, поэтому форма пустая: подсказка в поле — то, что сейчас записано
	// (маска), введённое заменяет значение, пустое поле не меняется. Проверку (СНИЛС с контрольной суммой, серия и номер паспорта,
	// даты) делает сервер — тем же кодом, что и при импорте шаблона LMS; ошибки показываются под полями.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { FormDrawer, FormRow, FormSection, toast } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { toFormFailure } from '$lib/features/config/shared/form-errors';
	import type { LearnerProfile } from '../types';
	import { EDUCATION_OPTIONS, LEARNER_SECTIONS, SEX_OPTIONS, buildProfilePatch, fieldRows, requestKey, type LearnerFieldDef } from './learnerProfile';

	interface Props {
		open: boolean;
		contactId: string;
		profile: LearnerProfile | null;
		onClose: () => void;
		onSaved: (profile: LearnerProfile) => void;
	}

	let { open, contactId, profile, onClose, onSaved }: Props = $props();

	let values = $state<Record<string, string>>({});
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			values = {};
			errors = {};
			formError = null;
		});
	});

	const dirty = $derived(Object.keys(buildProfilePatch(values)).length > 0);
	const current = (key: string): string => String((profile as Record<string, unknown> | null)?.[key] ?? '');
	const allKeys = LEARNER_SECTIONS.flatMap((s) => s.fields.map((f) => requestKey(f.key)));

	async function save() {
		const body = buildProfilePatch(values);
		if (!Object.keys(body).length) return onClose();
		saving = true;
		formError = null;
		try {
			const saved = await unwrap(api.PUT('/api/contacts/{contact_id}/learner-profile', { params: { path: { contact_id: contactId } }, body }));
			toast.success('Профиль сохранён');
			onSaved(saved);
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, allKeys);
			errors = { ...failure.fields };
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

{#snippet input(f: LearnerFieldDef)}
	{@const key = requestKey(f.key)}
	{#if key === 'sex'}
		<Pick label={f.label} value={values.sex ?? null} items={SEX_OPTIONS} clearable error={errors.sex} onChange={(v) => (values = { ...values, sex: v ?? '' })} />
	{:else if key === 'education'}
		<Pick label={f.label} value={values.education ?? null} items={EDUCATION_OPTIONS} clearable error={errors.education} hint={profile?.education_label ? `Сейчас: ${profile.education_label}` : undefined} onChange={(v) => (values = { ...values, education: v ?? '' })} />
	{:else}
		<TextField label={f.label} value={values[key] ?? ''} placeholder={current(key)} hint={f.format} error={errors[key]} disabled={saving} onInput={(v) => (values = { ...values, [key]: v })} />
	{/if}
{/snippet}

<FormDrawer {open} title="Профиль учащегося" saveLabel="Сохранить" {saving} {dirty} canSave={dirty} {formError} onSave={save} {onClose}>
	<ul class="t-body-s m-0 flex list-none flex-col gap-1 p-0 text-muted">
		<li>Данные попадают в выгрузку для LMS. Все поля необязательные.</li>
		<li>ФИО, телефон и e-mail берутся из карточки контакта.</li>
		<li>Сохранённое скрыто: в поле показано, что записано сейчас. Пустое поле не меняется.</li>
	</ul>
	{#each LEARNER_SECTIONS as section (section.key)}
		<FormSection title={section.title}>
			{#each fieldRows(section.fields) as row (row[0].key)}
				<!-- a wide field (a long text) stands outside a row: the whole width; the short ones go two in a row -->
				{#if row[0].wide}
					{@render input(row[0])}
				{:else}
					<FormRow>
						{#each row as f (f.key)}{@render input(f)}{/each}
					</FormRow>
				{/if}
			{/each}
		</FormSection>
	{/each}
</FormDrawer>
