<script lang="ts">
	// Новый контакт: ФИО, должность, организация, e-mail, телефон, ЛПР, каналы связи. Idempotency-Key на время попытки.
	import { untrack } from 'svelte';
	import { api, ApiError, errorMessage, idem, unwrap } from '$lib/api';
	import { FormDrawer, toast } from '$lib/ui';
	import type { Contact } from '../types';
	import ContactForm from './ContactForm.svelte';
	import { emptyContactForm, toCreateBody, validateContact, type ContactFormValues } from './contactUtils';

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
	let busy = $state(false);
	let key = crypto.randomUUID();
	let keySig = '';

	$effect(() => {
		if (!open) return;
		untrack(() => {
			values = emptyContactForm(organizationId);
			errors = {};
			failure = null;
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
		try {
			const contact = await unwrap(api.POST('/api/contacts', { body, headers: idem(key) }));
			toast.success('Контакт создан');
			onCreated(contact);
		} catch (e) {
			if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors()).length) errors = e.fieldErrors();
			else failure = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer {open} title="Новый контакт" saveLabel="Создать" saveTestId="contact-create-submit" saving={busy} {dirty} formError={failure} onSave={submit} {onClose}>
	<ContactForm bind:values {errors} organizationLocked={!!organizationId} disabled={busy} />
</FormDrawer>
