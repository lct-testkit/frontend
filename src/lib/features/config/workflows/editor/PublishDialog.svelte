<script lang="ts">
	// Подтверждение публикации: что публикуем (число статусов и переходов) и предупреждения проверки — они публикацию не блокируют.
	import { Notice } from '$lib/ui';
	import ConfirmModal from '$lib/ui/ConfirmModal.svelte';
	import { statusesWord, transitionsWord } from './format';

	interface Props {
		open: boolean;
		name: string;
		statuses: number;
		transitions: number;
		warnings: readonly string[];
		busy: boolean;
		onConfirm: () => void;
		onClose: () => void;
	}

	let { open, name, statuses, transitions, warnings, busy, onConfirm, onClose }: Props = $props();
</script>

<ConfirmModal
	{open}
	title={`Опубликовать «${name}»?`}
	message="{statusesWord(statuses)} и {transitionsWord(transitions)}. Новый граф начнёт действовать для всех сделок этой воронки."
	confirmLabel="Опубликовать"
	{busy}
	dismissible={!busy}
	{onConfirm}
	onCancel={onClose}
>
	{#if warnings.length}
		<p class="t-body-s-strong">Советы ({warnings.length})</p>
		{#each warnings as w (w)}
			<Notice class="shrink-0" tone="warning">{w}</Notice>
		{/each}
	{/if}
</ConfirmModal>
