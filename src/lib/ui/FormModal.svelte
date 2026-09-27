<script lang="ts">
	// THE window of a short form (a few fields, a reason, a choice): the same anatomy and the same rules as FormDrawer — see there — in a dialog of size s / m / l.
	import type { Snippet } from 'svelte';
	import AppModal from './AppModal.svelte';
	import FormFooter from './FormFooter.svelte';
	import { mayClose } from './form-close';
	import { watchDirty } from './form-dirty';

	interface Props {
		open: boolean;
		title: string;
		size?: 's' | 'm' | 'l' | 'xl';
		saving?: boolean;
		saveLabel?: string;
		cancelLabel?: string;
		canSave?: boolean;
		/** false = only «Отмена» (a step of a form that has nothing to save yet) */
		showSave?: boolean;
		/** left out, the form finds it out itself: its values differ from the moment it opened */
		dirty?: boolean;
		saveTestId?: string;
		/** a red main button (a destructive action) */
		danger?: boolean;
		formError?: string | { text: string; actions?: { label: string; onclick: () => void }[] } | null;
		conflict?: boolean;
		/** the words of the 409 banner (default: the general ones) */
		conflictText?: string;
		/** the label of the button of the 409 banner (default: «Загрузить актуальные») */
		reloadLabel?: string;
		/** false = the window cannot be closed by Esc / a click beside it (a form that must be answered) */
		dismissible?: boolean;
		onSave: () => void;
		onClose: () => void;
		onReload?: () => void;
		children: Snippet;
		extra?: Snippet;
		header?: Snippet;
	}

	let { open, title, size = 'm', saving = false, saveLabel = 'Сохранить', cancelLabel = 'Отмена', canSave = true, showSave = true, danger = false, dirty = undefined, saveTestId, formError = null, conflict = false, conflictText = undefined, reloadLabel = undefined, dismissible = true, onSave, onClose, onReload, children, extra, header }: Props = $props();

	const formId = `fm-${Math.random().toString(36).slice(2, 8)}`;

	let autoDirty = $state(false);
	const isDirty = $derived(dirty ?? autoDirty);

	async function close() {
		if (saving) return;
		if (await mayClose(isDirty)) onClose();
	}
</script>

<AppModal {open} {title} {size} {dismissible} onClose={close} {header}>
	<form
		id={formId}
		use:watchDirty={{ open, onChange: (d) => (autoDirty = d) }}
		class="flex flex-col gap-4"
		onsubmit={(e) => {
			e.preventDefault();
			if (canSave && !saving) onSave();
		}}
	>
		{@render children()}
	</form>
	{#snippet footer()}
		<FormFooter {formId} {saveLabel} {cancelLabel} {saving} {canSave} {showSave} {danger} {saveTestId} {formError} {conflict} {conflictText} {reloadLabel} cancelVariant="secondary" onCancel={close} {onReload} {extra} />
	{/snippet}
</AppModal>
