<script lang="ts">
	// Оформить соглашение об ЭДО: сторона (организация, контакт или сотрудник), способ заключения, сроки и скан подписанного соглашения.
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CloseLarge } from '@lct-testkit/rt-ui/icons';
	import { ApiError, api, errorMessage, unwrap } from '$lib/api';
	import { uploadFile, type UploadedFile } from '$lib/api/upload';
	import ContactPicker from '$lib/features/crm/shared/pickers/ContactPicker.svelte';
	import OrgPicker from '$lib/features/crm/shared/pickers/OrgPicker.svelte';
	import { DateField, FormDrawer, FormRow, IconBtn, Notice, Pick, TextField, UserPicker, toast } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import { SCAN_ACCEPT } from '../file-accept';
	import { edmMethodLabel, edmPartyLabel } from '../status';
	import type { EdmAgreement, EdmConclusionMethod, EdmPartyType } from '../types';

	interface Props {
		open: boolean;
		onClose: () => void;
		onCreated: (agreement: EdmAgreement) => void;
		/** deep link from «Оформить соглашение» on a blocked document (`DocumentPanel.svelte`): the side already known */
		presetPartyType?: EdmPartyType;
		presetPartyId?: string;
	}

	let { open, onClose, onCreated, presetPartyType, presetPartyId }: Props = $props();

	const PARTY_TYPES: EdmPartyType[] = ['organization', 'contact', 'user'];
	const METHODS: EdmConclusionMethod[] = ['paper', 'ukep', 'offer_acceptance', 'employment'];
	const partyItems = PARTY_TYPES.map((k) => ({ key: k, value: edmPartyLabel(k) }));
	const methodItems = METHODS.map((k) => ({ key: k, value: edmMethodLabel(k) }));
	const defaultMethod = (type: EdmPartyType): EdmConclusionMethod => (type === 'user' ? 'employment' : 'paper');

	let partyType = $state<EdmPartyType>('organization');
	let partyId = $state<string | null>(null);
	let method = $state<EdmConclusionMethod>('paper');
	let number = $state('');
	let signedOn = $state<string | null>(null);
	let validFrom = $state<string | null>(null);
	let validTo = $state<string | null>(null);
	let file = $state<UploadedFile | null>(null);
	let progress = $state<number | null>(null);
	let uploadError = $state<string | null>(null);
	let saving = $state(false);
	let fieldErrors = $state<Record<string, string>>({});
	let failure = $state<string | null>(null);

	// каждое открытие — чистая форма (кроме стороны, если пришла ссылкой из заблокированного документа)
	$effect(() => {
		if (!open) return;
		partyType = presetPartyType ?? 'organization';
		partyId = presetPartyId ?? null;
		method = defaultMethod(partyType);
		number = '';
		signedOn = validFrom = validTo = null;
		file = null;
		progress = null;
		uploadError = null;
		saving = false;
		fieldErrors = {};
		failure = null;
	});

	function pickType(next: EdmPartyType) {
		partyType = next;
		partyId = null;
		method = defaultMethod(next);
		delete fieldErrors.party_id;
	}

	async function pickFile(picked: File) {
		uploadError = null;
		file = null;
		progress = 0;
		try {
			file = await uploadFile(picked, { purpose: 'edm_agreement', category: 'contract', onProgress: (f) => (progress = f) });
		} catch (e) {
			uploadError = errorMessage(e);
		} finally {
			progress = null;
		}
	}

	/** the scan is uploaded before the agreement exists: if it is not used, do not leave an orphan in the storage */
	async function dropFile() {
		const orphan = file;
		file = null;
		if (!orphan) return;
		try {
			await api.DELETE('/api/files/{file_id}', { params: { path: { file_id: orphan.id } } });
		} catch {
			// best effort: the file is not attached to anything and is swept with other unattached uploads
		}
	}

	function close() {
		void dropFile();
		onClose();
	}

	async function save() {
		const errors: Record<string, string> = {};
		if (!partyId) errors.party_id = 'Выберите, с кем заключено соглашение';
		if (validFrom && validTo && validTo < validFrom) errors.valid_to = 'Раньше даты начала';
		fieldErrors = errors;
		failure = null;
		if (Object.keys(errors).length || saving || progress !== null) return;
		saving = true;
		try {
			const created = await unwrap(
				api.POST('/api/admin/edm-agreements', {
					body: {
						party_type: partyType,
						party_id: partyId!,
						agreement_number: number.trim() || null,
						agreement_file_id: file?.id ?? null,
						conclusion_method: method,
						// день подписания без времени: полдень, чтобы часовой пояс не сдвинул дату
						signed_at: signedOn ? new Date(`${signedOn}T12:00:00`).toISOString() : null,
						valid_from: validFrom,
						valid_to: validTo
					}
				})
			);
			file = null; // now it belongs to the agreement
			toast.success('Соглашение оформлено');
			onCreated(created);
		} catch (e) {
			if (e instanceof ApiError && e.isValidation) fieldErrors = e.fieldErrors();
			failure = errorMessage(e);
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer
	{open}
	title="Новое соглашение об ЭДО"
	width={520}
	saveTestId="edm-save"
	saving={saving}
	canSave={progress === null}
	dirty={open && (!!partyId || !!number.trim() || !!signedOn || !!validFrom || !!validTo || !!file)}
	formError={failure && !Object.keys(fieldErrors).length ? failure : null}
	onSave={save}
	onClose={close}
>
	<Pick label="Кто сторона" items={partyItems} value={partyType} onChange={(v) => v && pickType(v as EdmPartyType)} />
	{#if partyType === 'organization'}
		<OrgPicker required value={partyId} error={fieldErrors.party_id} onChange={(id) => ((partyId = id), delete fieldErrors.party_id)} />
	{:else if partyType === 'contact'}
		<ContactPicker required value={partyId} error={fieldErrors.party_id} onChange={(id) => ((partyId = id), delete fieldErrors.party_id)} />
	{:else}
		<UserPicker label="Сотрудник" required value={partyId} error={fieldErrors.party_id} onChange={(id) => ((partyId = id), delete fieldErrors.party_id)} />
	{/if}
	<Pick label="Как заключено" items={methodItems} value={method} onChange={(v) => v && (method = v as EdmConclusionMethod)} />
	<TextField label="Номер соглашения" value={number} error={fieldErrors.agreement_number} onInput={(v) => (number = v)} />
	<DateField label="Дата подписания" value={signedOn} onChange={(v) => (signedOn = v)} />
	<FormRow>
		<DateField label="Действует с" value={validFrom} onChange={(v) => (validFrom = v)} />
		<DateField label="Действует до" hint="Пусто — бессрочно" value={validTo} error={fieldErrors.valid_to} onChange={(v) => ((validTo = v), delete fieldErrors.valid_to)} />
	</FormRow>
	<div class="flex flex-col gap-2">
		{#if file}
			<div class="flex items-center justify-between gap-2 rounded-md bg-surface-3 py-2 pr-1 pl-3">
				<span class="t-body-s min-w-0 truncate" title={file.original_filename}>{file.original_filename}</span>
				<span class="t-desc-m flex-none text-muted">{formatBytes(file.size_bytes)}</span>
				<IconBtn icon={CloseLarge} label="Убрать файл" size="s" onclick={dropFile} />
			</div>
		{:else}
			<FileField accept={SCAN_ACCEPT} label="Скан соглашения — выберите или перетащите" disabled={progress !== null} loading={progress !== null} onPick={pickFile} />
			{#if progress !== null}<Progress value={Math.round(progress * 100)} showValue label="Загружаем файл…" />{/if}
		{/if}
		{#if uploadError}<Notice class="shrink-0" tone="error">{uploadError}</Notice>{/if}
	</div>
</FormDrawer>
