<script lang="ts">
	// Мастер «Отправить на подпись» из сделки: 1) документ (шаблон или PDF) → 2) подписанты, порядок, срок → отправка.
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { Progress, useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import UserPicker from '$lib/ui/UserPicker.svelte';
	import WizardSteps from '$lib/ui/WizardSteps.svelte';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { SendDraft } from './send-draft.svelte';
	import type { SignatureDocument } from './types';

	interface Props {
		open: boolean;
		dealId: string;
		onClose: () => void;
		/** документ создан и отправлен (ответ сервера с одноразовыми ссылками) */
		onDone: (doc: SignatureDocument) => void;
	}

	let { open, dealId, onClose, onDone }: Props = $props();

	const bp = useBreakpoint();
	let draft = $state<SendDraft | null>(null);

	// каждое открытие — новый черновик со свежими данными сделки и шаблонов
	$effect(() => {
		if (!open) return;
		const next = new SendDraft(dealId);
		draft = next;
		void next.load();
	});

	async function submit() {
		const sent = await draft?.submit();
		if (sent) onDone(sent);
	}

	const templateItems = $derived((draft?.templates ?? []).map((t) => ({ key: t.code, value: t.name })));
	const steps = ['Документ', 'Подписанты'];
</script>

<AppModal {open} title="Отправить на подпись" size="m" {onClose}>
	{#if !draft || draft.loading}
		<Skeleton kind="rows" rows={5} />
	{:else if draft.loadError}
		<ErrorState error={draft.loadError} onRetry={() => draft?.load()} compact />
	{:else}
		<WizardSteps {steps} current={draft.step} compact />

		{#if draft.step === 0}
			{#if draft.templates.length}
				<SegmentedControl value={draft.source} onChange={(v) => draft?.setSource(v as 'template' | 'file')} size={bp.isMobile ? 'l' : 'm'}>
					<Segment index="template" label="Из шаблона" />
					<Segment index="file" label="Свой PDF" />
				</SegmentedControl>
			{/if}

			{#if draft.source === 'template'}
				<Pick label="Шаблон" items={templateItems} value={draft.templateCode} onChange={(k) => k && draft?.pickTemplate(k)} />
			{:else}
				<FileField
					label="Выберите PDF или перетащите его сюда"
					fileName={draft.file ? draft.file.name : null}
					disabled={draft.uploading > 0}
					loading={draft.uploading > 0}
					onPick={(f) => draft?.pickFile(f)}
				/>
				{#if draft.uploading > 0}
					<Progress value={Math.round(draft.uploading * 100)} showValue label="Загружаем файл…" />
				{/if}
			{/if}

			<TextField label="Название" value={draft.title} onInput={(v) => draft?.setTitle(v)} maxlength={255} />
		{:else}
			<fieldset class="m-0 flex flex-col gap-1 rounded-lg border border-line p-3">
				<legend class="t-desc-l px-1 text-muted">Кто подписывает</legend>
				<CheckField label="Руководитель" checked={draft.head} onChange={(v) => draft && (draft.head = v)} />
				{#if draft.deal?.contactId}
					<CheckField label={`Контакт сделки${draft.deal.contactName ? `: ${draft.deal.contactName}` : ''}`} checked={draft.contact} onChange={(v) => draft && (draft.contact = v)} />
				{/if}
				{#if draft.deal?.organizationId}
					<CheckField label="ЛПР организации" checked={draft.lpr} onChange={(v) => draft && (draft.lpr = v)} />
				{/if}
				<div class="pt-2">
					<UserPicker
						label="Ещё сотрудник"
						placeholder="Не обязательно"
						value={draft.user?.id ?? null}
						onChange={(id, person) => draft && (draft.user = id ? { id, name: person?.full_name ?? '' } : null)}
					/>
				</div>
				{#if draft.signersError}<Notice class="shrink-0" tone="error">{draft.signersError}</Notice>{/if}
			</fieldset>

			<div class="flex flex-wrap items-end gap-x-4 gap-y-3">
				<SegmentedControl value={draft.order} onChange={(v) => draft && (draft.order = v as 'sequential' | 'parallel')} size={bp.isMobile ? 'l' : 'm'}>
					<Segment index="sequential" label="По очереди" />
					<Segment index="parallel" label="Одновременно" />
				</SegmentedControl>
				<NumberField class="w-40" label="Срок, дн." integer min={1} max={60} value={draft.days} onChange={(v) => v !== null && draft && (draft.days = v)} />
			</div>

			{#if draft.warnExternalNotFirst}
				<Notice class="shrink-0" tone="warning">Внешний подписант не первый: ссылку ему сервер не выдаст. Подпишите «Одновременно» или поставьте контрагента первым.</Notice>
			{/if}
		{/if}

		{#if draft.error}<Notice class="shrink-0" tone="error">{draft.error}</Notice>{/if}
	{/if}

	{#snippet footer()}
		{#if draft && !draft.loading && !draft.loadError}
			{#if draft.step === 0}
				<Btn label="Далее" disabled={!draft.sourceReady} onclick={() => draft && (draft.step = 1)} data-testid="wizard-next" />
				<Btn label="Отмена" variant="secondary" colorScheme="neutral" onclick={onClose} />
			{:else}
				<Btn label="Отправить на подпись" loading={draft.busy} disabled={!draft.canSubmit} onclick={submit} data-testid="wizard-submit" />
				<Btn label="Назад" variant="secondary" colorScheme="neutral" disabled={draft.busy} onclick={() => draft && (draft.step = 0)} />
			{/if}
		{/if}
	{/snippet}
</AppModal>
