<script lang="ts">
	// Шаг перед формой запроса: чьи данные удаляем — сотрудника, контакта или ИП.
	import ContactPicker from '$lib/features/crm/shared/pickers/ContactPicker.svelte';
	import OrgPicker from '$lib/features/crm/shared/pickers/OrgPicker.svelte';
	import { FormModal, RadioField, UserPicker } from '$lib/ui';
	import { ERASURE_SUBJECT_LABEL } from '../labels';
	import type { ErasureSubjectType } from '../types';
	import { subjectName } from './subject';

	interface Props {
		open: boolean;
		onClose: () => void;
		onPick: (subject: { type: ErasureSubjectType; id: string; name: string }) => void;
	}

	let { open, onClose, onPick }: Props = $props();

	let type = $state<ErasureSubjectType>('contact');
	let id = $state<string | null>(null);
	let error = $state<string | undefined>();

	// каждое открытие — с чистого листа
	$effect(() => {
		if (open) {
			type = 'contact';
			id = null;
			error = undefined;
		}
	});

	const pick = (v: string | null) => ((id = v), (error = undefined));
	/** «Далее» без выбора не молчит и не заблокирована: говорит, чего не хватает */
	function next() {
		if (!id) {
			error = 'Выберите, чьи данные удалить';
			return;
		}
		onPick({ type, id, name: subjectName(type, id) });
	}

	const types = Object.keys(ERASURE_SUBJECT_LABEL) as ErasureSubjectType[];
	const typeItems = types.map((t) => ({ key: t, label: ERASURE_SUBJECT_LABEL[t] }));
</script>

<FormModal {open} title="Чьи данные удалить" size="m" saveLabel="Далее" saveTestId="erasure-subject-next" onSave={next} {onClose}>
	<RadioField
		items={typeItems}
		value={type}
		onChange={(v) => {
			type = v as ErasureSubjectType;
			id = null;
			error = undefined;
		}}
	/>
	{#if type === 'user'}
		<UserPicker label="Сотрудник" required value={id} {error} onChange={pick} />
	{:else if type === 'contact'}
		<ContactPicker required value={id} {error} onChange={pick} />
	{:else}
		<OrgPicker label="ИП" required value={id} {error} onChange={pick} />
	{/if}
</FormModal>
