<script lang="ts">
	// Правка контакта (If-Match). Маскированные e-mail и телефон не отправляются, пока их не раскрыли и не изменили.
	import { untrack } from 'svelte';
	import { api, ApiError, errorMessage, ifMatch, unwrap } from '$lib/api';
	import { FormDrawer, toast } from '$lib/ui';
	import type { Contact } from '../types';
	import ContactForm from './ContactForm.svelte';
	import { formFromContact, toPatchBody, validateContact, type ContactFormValues } from './contactUtils';

	interface Props {
		open: boolean;
		contact: Contact;
		/** раскрыть контакты (запись в журнал); возвращает значения для полей */
		onReveal: () => Promise<{ email: string; phone: string } | null>;
		onClose: () => void;
		onSaved: (contact: Contact) => void;
		onConflict: () => Promise<void> | void;
	}

	let { open, contact, onReveal, onClose, onSaved, onConflict }: Props = $props();

	// svelte-ignore state_referenced_locally
	let base = $state(formFromContact(contact));
	// svelte-ignore state_referenced_locally
	let values = $state<ContactFormValues>(formFromContact(contact));
	let errors = $state<Record<string, string>>({});
	let banner = $state<string | null>(null);
	let conflict = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			base = formFromContact(contact);
			values = formFromContact(contact);
			errors = {};
			banner = null;
			conflict = false;
		});
	});

	async function reveal() {
		const full = await onReveal();
		if (!full) return;
		base = { ...base, email: full.email, phone: full.phone };
		values = { ...values, email: values.email.includes('*') ? full.email : values.email, phone: values.phone.includes('*') ? full.phone : values.phone };
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		await onConflict();
		busy = false;
		conflict = false;
		banner = null;
	}

	async function save() {
		if (busy) return;
		errors = validateContact(values);
		if (Object.keys(errors).length) return;
		const body = toPatchBody(base, values);
		if (!Object.keys(body).length) {
			onClose();
			return;
		}
		busy = true;
		banner = null;
		try {
			onSaved(await unwrap(api.PATCH('/api/contacts/{contact_id}', { params: { path: { contact_id: contact.id } }, headers: ifMatch(contact.version), body })));
			toast.success('Контакт сохранён');
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) {
				conflict = true;
				banner = 'Контакт изменён другим пользователем. Обновите данные — введённое сохранится.';
			} else if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors()).length) {
				errors = e.fieldErrors();
			} else {
				banner = errorMessage(e);
			}
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer
	{open}
	title="Редактирование контакта"
	saveTestId="contact-save"
	saving={busy}
	dirty={open && Object.keys(toPatchBody(base, values)).length > 0}
	{conflict}
	conflictText={banner ?? undefined}
	reloadLabel="Обновить"
	formError={conflict ? null : banner}
	onSave={save}
	onReload={refresh}
	{onClose}
>
	<ContactForm bind:values {errors} editing disabled={busy} onReveal={reveal} />
</FormDrawer>
