<script lang="ts">
	// Секрет или ключ, который сервер показывает ровно один раз (подпись webhook, API-ключ): скопировать сейчас, потом он недоступен.
	// Значение живёт только в памяти этого окна: не логируется и не сохраняется.
	import { AppModal, Btn, CopyButton, Notice, TextField } from '$lib/ui';

	interface Props {
		/** `null` — окно закрыто */
		value: string | null;
		title: string;
		label: string;
		/** что сделать с ним дальше (одна короткая фраза) */
		note?: string;
		/** пример, как им пользоваться (команда): блок под значением с кнопкой копирования */
		example?: string;
		onClose: () => void;
	}

	let { value, title, label, note, example, onClose }: Props = $props();
</script>

<AppModal open={value !== null} {title} size="m" dismissible={false} {onClose}>
	{#if value !== null}
		<Notice class="shrink-0" tone="warning">{`Сохраните сейчас, потом он будет недоступен.${note ? ` ${note}` : ''}`}</Notice>
		<div class="flex items-center gap-1">
			<div class="min-w-0 flex-1"><TextField {label} value={value} readonly /></div>
			<CopyButton {value} label="Копировать" size="m" done="Скопировано" />
		</div>
		{#if example}
			<div class="flex flex-col gap-1">
				<span class="t-desc-l flex items-center justify-between text-muted">Пример вызова <CopyButton value={example} label="Скопировать пример" /></span>
				<pre class="t-desc-m m-0 overflow-x-auto rounded-sm bg-surface-2 p-2 font-mono whitespace-pre">{example}</pre>
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		<Btn label="Я сохранил" onclick={onClose} data-testid="secret-done" />
	{/snippet}
</AppModal>
