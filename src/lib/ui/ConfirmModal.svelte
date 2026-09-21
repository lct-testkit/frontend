<script lang="ts">
	// THE confirmation window — the DS recipe of the CRM example: a small centred dialog, the title (heading h2) and the explanation (body m, soft) with the close cross in the
	// corner, then TWO buttons of one width (size l): the main one first, «Отмена» (secondary) after it. On a phone the window is as wide as the screen minus 16 px on
	// each side, padding 20 instead of 32, and the buttons stand one under another with the MAIN one at the bottom (at the thumb).
	// `children` — what else the person must see before answering (a list of warnings). `dismissible={false}`: no cross, no Esc, no click beside (a step that must be answered).
	import type { Snippet } from 'svelte';
	import { Modal } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { CloseLarge } from '@lct-testkit/rt-ui/icons';
	import Btn from './Btn.svelte';
	import IconBtn from './IconBtn.svelte';

	interface Props {
		open: boolean;
		title: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		/** a red main button (a destructive action) */
		danger?: boolean;
		/** the answer is being sent: the main button spins, the rest is off */
		busy?: boolean;
		dismissible?: boolean;
		confirmTestId?: string;
		onConfirm: () => void;
		onCancel: () => void;
		children?: Snippet;
	}

	let { open, title, message, confirmLabel = 'Подтвердить', cancelLabel = 'Отмена', danger = false, busy = false, dismissible = true, confirmTestId, onConfirm, onCancel, children }: Props = $props();

	const bp = useBreakpoint();
	const cancel = () => {
		if (dismissible && !busy) onCancel();
	};
</script>

<Modal isOpened={open} maxWidth={bp.isMobile ? 'calc(100vw - 32px)' : '520px'} isCentered modalClassName="rounded-lg p-8 max-md:p-5" onClickOverlay={cancel} onEsc={cancel}>
	<div class="relative flex flex-col gap-3 {dismissible ? 'pr-10' : ''}">
		<h2 class="t-h2 wrap-anywhere">{title}</h2>
		{#if message}<p class="t-body-m text-soft">{message}</p>{/if}
		{#if dismissible}<IconBtn class="absolute -top-1 right-0" icon={CloseLarge} label="Закрыть" disabled={busy} onclick={cancel} />{/if}
	</div>
	{#if children}<div class="mt-4 flex flex-col gap-3">{@render children()}</div>{/if}
	<div class="mt-8 flex gap-3 max-md:mt-6 max-md:flex-col-reverse [&>*]:flex-1 max-md:[&>*]:flex-none">
		<Btn size="l" label={confirmLabel} {danger} loading={busy} data-testid={confirmTestId} onclick={onConfirm} />
		<Btn size="l" label={cancelLabel} variant="secondary" colorScheme="neutral" disabled={busy} onclick={onCancel} />
	</div>
</Modal>
