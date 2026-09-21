<script lang="ts">
	// Renders the window of `confirm()` (root layout): the question of the last call, and its answer goes back to the caller.
	import ConfirmModal from './ConfirmModal.svelte';
	import { confirmState } from './confirm.svelte';

	const pending = $derived(confirmState.current);
</script>

<ConfirmModal
	open={pending !== null}
	title={pending?.options.title ?? ''}
	message={pending?.options.message}
	confirmLabel={pending?.options.confirmLabel}
	cancelLabel={pending?.options.cancelLabel}
	danger={pending?.options.danger}
	onConfirm={() => pending?.resolve(true)}
	onCancel={() => pending?.resolve(false)}
/>
