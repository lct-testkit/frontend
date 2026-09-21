<script lang="ts">
	// «Четыре глаза»: операция создана как заявка и ждёт второго администратора. Объясняем, что дальше, и ведём к заявкам.
	import { goto } from '$app/navigation';
	import ConfirmModal from '$lib/ui/ConfirmModal.svelte';

	let { open, what, onClose }: { open: boolean; what: string; onClose: () => void } = $props();
</script>

<ConfirmModal
	{open}
	title="Нужно второе подтверждение"
	message="{what} должен подтвердить второй администратор. После подтверждения вернитесь в «Согласования» и нажмите «Выполнить»."
	confirmLabel="К согласованиям"
	cancelLabel="Закрыть"
	confirmTestId="to-approvals"
	onConfirm={() => goto('/admin/approvals')}
	onCancel={onClose}
/>
