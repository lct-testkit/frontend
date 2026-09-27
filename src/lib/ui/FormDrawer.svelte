<script lang="ts">
	// THE panel of a form: create or edit an entity without leaving the list. The DS Drawer recipe — title and close on top, the fields stacked with a 16 px gap,
	// the footer with the main button first and «Отмена» after it (see FormFooter). What every form of the app gets here:
	//  • Enter in a field saves (`onSave`) when `canSave`; the main button shows a spinner while `saving`;
	//  • `formError` and the 409 banner (`conflict` + `onReload`) stand above the buttons, in the footer, so they are seen wherever the body is scrolled;
	//  • closing with unsaved input asks first (`dirty`, or — when left out — the form's own values against the moment it opened) (✕, Esc, a click beside the panel and «Отмена» all do).
	// The fields go in as children; group them with FormSection / FormRow.
	import type { Snippet } from 'svelte';
	import AppDrawer from './AppDrawer.svelte';
	import FormFooter from './FormFooter.svelte';
	import { mayClose } from './form-close';
	import { watchDirty } from './form-dirty';

	interface Props {
		open: boolean;
		title: string;
		/** px on a desktop */
		width?: number;
		saving?: boolean;
		saveLabel?: string;
		cancelLabel?: string;
		/** false — «Сохранить» is off (the form did not change / has mistakes) */
		canSave?: boolean;
		/** false = only «Отмена» (a step of a form that has nothing to save yet) */
		showSave?: boolean;
		/** the form has input that would be lost on close; left out, the form finds it out itself (its values differ from the moment it opened) */
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
		onSave: () => void;
		onClose: () => void;
		onReload?: () => void;
		children: Snippet;
		/** one more button at the far end of the footer (a destructive «Удалить») */
		extra?: Snippet;
		/** replaces the plain title row (the title with a status chip) */
		header?: Snippet;
	}

	let { open, title, width = 480, saving = false, saveLabel = 'Сохранить', cancelLabel = 'Отмена', canSave = true, showSave = true, danger = false, dirty = undefined, saveTestId, formError = null, conflict = false, conflictText = undefined, reloadLabel = undefined, onSave, onClose, onReload, children, extra, header }: Props = $props();

	const formId = `fd-${Math.random().toString(36).slice(2, 8)}`;

	let autoDirty = $state(false);
	const isDirty = $derived(dirty ?? autoDirty);

	async function close() {
		if (saving) return;
		if (await mayClose(isDirty)) onClose();
	}
</script>

<AppDrawer {open} {title} {width} onClose={close} {header}>
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
		<FormFooter {formId} {saveLabel} {cancelLabel} {saving} {canSave} {showSave} {danger} {saveTestId} {formError} {conflict} {conflictText} {reloadLabel} onCancel={close} {onReload} {extra} />
	{/snippet}
</AppDrawer>
