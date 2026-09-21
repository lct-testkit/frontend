<script lang="ts">
	// The footer of every form (in a FormDrawer and in a FormModal), the DS recipe: the MAIN button FIRST, «Отмена» after it, left-aligned. Above the buttons stand the
	// messages about the whole form: what went wrong (`formError`) and the 409 «changed by someone else» banner (`conflict`). `extra` is one more button at the far
	// end (a destructive «Удалить»). On a phone the buttons are as wide as the window, one under another with the MAIN one at the bottom, at the thumb (the DS example does the same).
	import type { Snippet } from 'svelte';
	import Btn from './Btn.svelte';
	import Notice from './Notice.svelte';

	interface Props {
		formId: string;
		saveLabel?: string;
		cancelLabel?: string;
		saving?: boolean;
		canSave?: boolean;
		/** false = only «Отмена» (a step of a form that has nothing to save yet) */
		showSave?: boolean;
		saveTestId?: string;
		/** a red main button (a destructive action) */
		danger?: boolean;
		/** what went wrong with the whole form; an object adds buttons to the message (a link to the place that fixes it) */
		formError?: string | { text: string; actions?: { label: string; onclick: () => void }[] } | null;
		conflict?: boolean;
		/** the words of the 409 banner (default: the general ones) */
		conflictText?: string;
		/** the label of the button of the 409 banner (default: «Загрузить актуальные») */
		reloadLabel?: string;
		/** the cancel button is «outline» in a panel and «secondary» in a window (the DS recipes) */
		cancelVariant?: 'outline' | 'secondary';
		onCancel: () => void;
		onReload?: () => void;
		extra?: Snippet;
	}

	let { formId, saveLabel = 'Сохранить', cancelLabel = 'Отмена', saving = false, canSave = true, showSave = true, saveTestId, danger = false, formError = null, conflict = false, conflictText = 'Данные изменил другой пользователь. Ваш ввод сохранён в форме.', reloadLabel = 'Загрузить актуальные', cancelVariant = 'outline', onCancel, onReload, extra }: Props = $props();
</script>

<div class="flex w-full min-w-0 flex-col gap-3">
	{#if conflict}
		<Notice tone="warning" role="alert" actions={onReload ? [{ label: reloadLabel, onclick: onReload }] : []}>{conflictText}</Notice>
	{/if}
	{#if formError}
		{@const error = typeof formError === 'string' ? { text: formError } : formError}
		<Notice tone="error" actions={error.actions ?? []}>{error.text}</Notice>
	{/if}
	<div class="flex flex-wrap items-center gap-3 max-md:flex-col-reverse max-md:items-stretch max-md:[&_button]:w-full">
		{#if showSave}<Btn label={saveLabel} type="submit" form={formId} loading={saving} {danger} disabled={!canSave} data-testid={saveTestId} />{/if}
		<Btn label={cancelLabel} variant={cancelVariant} colorScheme="neutral" disabled={saving} onclick={onCancel} />
		{#if extra}<div class="ml-auto max-md:ml-0 max-md:w-full">{@render extra()}</div>{/if}
	</div>
</div>
