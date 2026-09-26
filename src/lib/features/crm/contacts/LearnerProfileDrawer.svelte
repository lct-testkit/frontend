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
	import { EDUCATION_OPTIONS, LEARNER_SECTIONS, SEX_OPTIONS, buildProfilePatch, requestKey } from './learnerProfile';

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

<FormDrawer {open} title="Профиль учащегося" saveLabel="Сохранить" {saving} {dirty} canSave={dirty} {formError} onSave={save} {onClose}>
	<p class="t-desc-l m-0 text-muted">Заполните только то, что нужно изменить: пустые поля остаются как есть. Значения проверяются так же, как при загрузке шаблона LMS.</p>
	{#each LEARNER_SECTIONS as section (section.key)}
		<FormSection title={section.title}>
			<FormRow>
				{#each section.fields as f (f.key)}
					{@const key = requestKey(f.key)}
					{#if key === 'sex'}
						<Pick label={f.label} value={values.sex ?? null} items={SEX_OPTIONS} clearable error={errors.sex} onChange={(v) => (values = { ...values, sex: v ?? '' })} />
					{:else if key === 'education'}
						<Pick label={f.label} value={values.education ?? null} items={EDUCATION_OPTIONS} clearable error={errors.education} hint={profile?.education_label ? `Сейчас: ${profile.education_label}` : undefined} onChange={(v) => (values = { ...values, education: v ?? '' })} />
					{:else}
						<TextField
							label={f.label}
							value={values[key] ?? ''}
							placeholder={current(key)}
							error={errors[key]}
							disabled={saving}
							onInput={(v) => (values = { ...values, [key]: v })}
						/>
					{/if}
				{/each}
			</FormRow>
		</FormSection>
	{/each}
</FormDrawer>
