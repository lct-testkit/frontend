<script lang="ts">
	// Renders the window of `confirm()` (root layout): the question of the last call, and its answer goes back to the caller.
	import ConfirmModal from './ConfirmModal.svelte';
	import { confirmState } from './confirm.svelte';

	const pending = $derived(confirmState.current);

	// A confirm asked from inside an open Drawer/Modal shares those the DS's own z-index token with them (see app.css, `.atmr-modal-wrapper`) and is
	// mounted once, early, at the layout root (this component), while the panel underneath portals itself fresh each time it opens — the DS's own
	// Esc handling of the confirm can end up unreliable in that nested case (its focus trap is not necessarily the front-most one). Escape is
	// caught here directly, in the capture phase, so the question always answers "Продолжить" (nothing is thrown away by a stray key) — the
	// underlying panel itself ignores Esc while a confirm is pending (`AppDrawer`/`AppModal`), so this is the only handler that can act on it.
	function onKeydownCapture(e: KeyboardEvent) {
		if (e.key !== 'Escape' || !confirmState.current) return;
		e.preventDefault();
		e.stopPropagation();
		confirmState.current.resolve(false);
	}
	$effect(() => {
		window.addEventListener('keydown', onKeydownCapture, true);
		return () => window.removeEventListener('keydown', onKeydownCapture, true);
	});
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
