<script lang="ts">
	// Диалог «действие + причина»: отклонить, аннулировать, заблокировать, отозвать… Ошибка сервера остаётся в диалоге,
	// введённый текст не теряется. Enter в многострочном поле — перенос, отправка — кнопкой (Ctrl+Enter тоже).
	import type { Snippet } from 'svelte';
	import { errorMessage } from '$lib/api';
	import { AreaField, FormModal } from '$lib/ui';

	interface Props {
		open: boolean;
		title: string;
		confirmLabel: string;
		onSubmit: (reason: string) => Promise<void>;
		onClose: () => void;
		label?: string;
		placeholder?: string;
		/** false — причина необязательна (например, разблокировка) */
		required?: boolean;
		minLength?: number;
		maxLength?: number;
		danger?: boolean;
		/** одна строка над полем: последствия действия */
		note?: string;
		/** дополнительные поля под причиной (чекбоксы, дата) */
		extra?: Snippet;
	}

	let {
		open,
		title,
		confirmLabel,
		onSubmit,
		onClose,
		label = 'Причина',
		placeholder,
		required = true,
		minLength = 3,
		maxLength = 500,
		danger = false,
		note,
		extra
	}: Props = $props();

	let reason = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	// каждое открытие — чистая форма
	$effect(() => {
		if (open) {
			reason = '';
			error = null;
			busy = false;
		}
	});

	async function submit() {
		const text = reason.trim();
		if (required && text.length < minLength) {
			error = `Укажите причину (не короче ${minLength} символов)`;
			return;
		}
		busy = true;
		error = null;
		try {
			await onSubmit(text);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} {title} size="s" saveLabel={confirmLabel} {danger} saveTestId="reason-confirm" saving={busy} dirty={open && reason.trim().length > 0} onSave={submit} {onClose}>
	{#if note}<p class="t-body-s m-0 text-muted">{note}</p>{/if}
	<AreaField {label} {required} {placeholder} rows={3} maxlength={maxLength} value={reason} error={error ?? undefined} onInput={(v) => ((reason = v), (error = null))} onSubmit={submit} />
	{@render extra?.()}
</FormModal>
