<script lang="ts">
	// Новый контакт: ФИО, должность, организация, e-mail, телефон, ЛПР, каналы связи. Idempotency-Key на время попытки.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, ApiError, errorMessage, idem, unwrap } from '$lib/api';
	import { FormDrawer, Notice, toast } from '$lib/ui';
	import type { Contact } from '../types';
	import ContactForm from './ContactForm.svelte';
	import { duplicateCandidates, emptyContactForm, toCreateBody, validateContact, type ContactFormValues, type DuplicateCandidate } from './contactUtils';

	interface Props {
		open: boolean;
		/** из карточки организации: организация уже выбрана и не меняется */
		organizationId?: string | null;
		onClose: () => void;
		onCreated: (contact: Contact) => void;
	}

	let { open, organizationId = null, onClose, onCreated }: Props = $props();

	let values = $state<ContactFormValues>(emptyContactForm());
	let errors = $state<Record<string, string>>({});
	let failure = $state<string | null>(null);
	/** сервер нашёл такого человека (совпал email или телефон): вместо второй карточки предлагаем открыть первую */
	let duplicates = $state<DuplicateCandidate[] | null>(null);
	let busy = $state(false);
	let key = crypto.randomUUID();
	let keySig = '';

	$effect(() => {
		if (!open) return;
		untrack(() => {
			values = emptyContactForm(organizationId);
			errors = {};
			failure = null;
			duplicates = null;
			key = crypto.randomUUID();
			keySig = '';
		});
	});

	const dirty = $derived(open && JSON.stringify(values) !== JSON.stringify(emptyContactForm(organizationId)));

	async function submit() {
		if (busy) return;
		errors = validateContact(values);
		if (Object.keys(errors).length) return;
		const body = toCreateBody(values);
		const sig = JSON.stringify(body);
		if (sig !== keySig) {
			key = crypto.randomUUID();
			keySig = sig;
		}
		busy = true;
		failure = null;
		duplicates = null;
		try {
			const contact = await unwrap(api.POST('/api/contacts', { body, headers: idem(key) }));
			toast.success('Контакт создан');
			onCreated(contact);
		} catch (e) {
			const found = duplicateCandidates(e);
			if (found) duplicates = found;
			else if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors()).length) errors = e.fieldErrors();
			else failure = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer {open} title="Новый контакт" saveLabel="Создать" saveTestId="contact-create-submit" saving={busy} {dirty} formError={failure} onSave={submit} {onClose}>
	{#if duplicates}
		<Notice
			tone="warning"
			title="Такой контакт уже есть"
			actions={duplicates.filter((d) => d.accessible && d.id).slice(0, 2).map((d) => ({ label: 'Открыть карточку', onclick: () => goto(`/contacts/${d.id}`) }))}
		>
			Совпал email или телефон.{duplicates.some((d) => d.accessible) ? '' : ' Контакт ведёт другой менеджер: обратитесь к руководителю.'}
		</Notice>
	{/if}
	<ContactForm bind:values {errors} organizationLocked={!!organizationId} disabled={busy} />
</FormDrawer>
