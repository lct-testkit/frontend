<script lang="ts">
	// Текст уведомления РКН: PDF и поля формы портала с кнопками копирования. Подаёт уведомление человек на портале РКН, система только готовит текст и потом фиксирует «отправлено».
	import { DocumentDownload } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { AppModal, Btn, CopyButton, Notice, TextField, toast } from '$lib/ui';
	import { noticeFileUrl, type RknNotice } from './api';
	import { contactMissing, noticeRows, type IncidentStage } from './incidents';

	interface Props {
		/** `null` — окно закрыто */
		notice: RknNotice | null;
		incidentId: string;
		/** можно сразу отметить отправку (только ADMIN) */
		canMark: boolean;
		onClose: () => void;
		onMark: (stage: IncidentStage) => void;
		/** сформировать текст заново (после правки настроек) */
		onRegenerate: (stage: IncidentStage) => void;
	}

	let { notice, incidentId, canMark, onClose, onMark, onRegenerate }: Props = $props();

	const rows = $derived(noticeRows(notice?.fields));
	const missing = $derived(contactMissing(notice?.fields));
	let opening = $state(false);
	let contact = $state('');
	let saving = $state(false);
	$effect(() => {
		if (notice) contact = '';
	});

	/** Контакт для РКН — системная настройка `pdn.rkn_contact`: тут же задаётся и текст формируется заново. */
	async function saveContact() {
		const value = contact.trim();
		if (!notice || !value || saving) return;
		saving = true;
		try {
			await unwrap(api.PUT('/api/admin/system-settings/{key}', { params: { path: { key: 'pdn.rkn_contact' } }, body: { value, description: 'Контакт ответственного для уведомления РКН (ФИО, должность, телефон, почта)' } }));
			toast.success('Контакт сохранён');
			onRegenerate(notice.stage);
		} catch (e) {
			toast.error(e, 'Не удалось сохранить контакт');
		} finally {
			saving = false;
		}
	}

	async function download() {
		if (!notice) return;
		opening = true;
		try {
			window.open(await noticeFileUrl(incidentId, notice.file_id), '_blank', 'noopener');
		} catch (e) {
			toast.error(e, 'Не удалось открыть файл');
		} finally {
			opening = false;
		}
	}
</script>

<AppModal open={notice !== null} dirty={contact.trim().length > 0} title={notice?.stage === '72h' ? 'Уведомление РКН · 72 часа' : 'Уведомление РКН · 24 часа'} size="l" {onClose}>
	{#if notice}
		<Notice class="shrink-0" tone="warning">Шаблон текста — проект: его должен утвердить юрист оператора. Уведомление подаёт человек на портале Роскомнадзора; здесь вы потом отмечаете, что оно подано.</Notice>
		{#if missing}
			<Notice class="shrink-0" tone="info">Контакт ответственного за уведомление не указан. Он нужен в тексте: укажите его, и текст сформируется заново.</Notice>
			{#if canMark}
				<div class="flex items-end gap-2 max-md:flex-col max-md:items-stretch">
					<div class="min-w-0 flex-1"><TextField label="Контакт для РКН" bind:value={contact} maxlength={500} placeholder="ФИО, должность, телефон, почта" onEnter={saveContact} /></div>
					<Btn label="Сохранить" variant="outline" colorScheme="neutral" loading={saving} disabled={!contact.trim()} onclick={saveContact} data-testid="notice-contact-save" />
				</div>
			{/if}
		{/if}
		<dl class="m-0 flex flex-col gap-3" aria-label="Поля формы уведомления">
			{#each rows as row (row.key)}
				<div class="flex min-w-0 items-start gap-2">
					<div class="flex min-w-0 flex-1 flex-col">
						<dt class="t-desc-l text-muted">{row.label}</dt>
						<dd class="t-body-m m-0 wrap-anywhere">{row.value}</dd>
					</div>
					<CopyButton value={row.value} label={`Скопировать: ${row.label}`} done="Скопировано" />
				</div>
			{/each}
		</dl>
	{/if}
	{#snippet footer()}
		<Btn label="Скачать PDF" icon={DocumentDownload} loading={opening} onclick={download} data-testid="notice-download" />
		{#if canMark && notice}<Btn label="Отметить отправку" variant="outline" colorScheme="neutral" onclick={() => notice && onMark(notice.stage)} data-testid="notice-mark" />{/if}
		<Btn label="Закрыть" variant="ghost" colorScheme="neutral" onclick={onClose} />
	{/snippet}
</AppModal>
