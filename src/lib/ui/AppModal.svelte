<script lang="ts">
	// The dialog every flow uses: title + close, scrolling body, footer with the actions (sticky, so it never leaves the window; left-aligned, the MAIN button first —
	// the DS recipes). Forms use FormModal, which fills the footer.
	// Sizes: s 420 (confirmations, short forms) · m 560 (forms) · l 760 · xl 980. On phones it takes the window width.
	// `centered` for short dialogs; long forms start near the top and scroll inside.
	import type { Snippet } from 'svelte';
	import { Modal } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { CloseLarge } from '@lct-testkit/rt-ui/icons';
	import BtnSizeScope from './BtnSizeScope.svelte';
	import { confirmState } from './confirm.svelte';
	import { mayClose } from './form-close';
	import IconBtn from './IconBtn.svelte';

	interface Props {
		open: boolean;
		title?: string;
		size?: 's' | 'm' | 'l' | 'xl';
		centered?: boolean;
		/** false = no close button / Esc / overlay click (blocking dialogs such as consent) */
		dismissible?: boolean;
		/** a wizard / editor that is not a FormModal: it holds input that would be lost — closing (✕, Esc, a click beside) asks first */
		dirty?: boolean;
		onClose?: () => void;
		children?: Snippet;
		footer?: Snippet;
		/** `header` replaces the plain title row */
		header?: Snippet;
	}

	let { open, title = '', size = 'm', centered = false, dismissible = true, dirty = false, onClose, children, footer, header }: Props = $props();

	const bp = useBreakpoint();
	const WIDTH = { s: 420, m: 560, l: 760, xl: 980 } as const;
	const margin = $derived(bp.isMobile ? 8 : 40);
	// see AppDrawer.svelte: a confirm stacked on top shares this z-index, so letting both react to the same Esc/overlay-click reopens an
	// identical-looking confirm in the same tick instead of dismissing it
	async function attemptClose() {
		if (await mayClose(dirty)) onClose?.();
	}
	const close = () => dismissible && !confirmState.current && void attemptClose();
</script>

<Modal
	isOpened={open}
	maxWidth={bp.isMobile ? 'calc(100vw - 16px)' : `min(${WIDTH[size]}px, calc(100vw - 48px))`}
	isCentered={centered}
	marginTop={margin}
	modalClassName="overflow-hidden rounded-lg"
	modalStyle={{ maxHeight: `calc(100dvh - ${margin * 2}px)` }}
	onClickOverlay={close}
	onEsc={close}
>
	<div class="flex max-h-[inherit] min-h-0 w-full flex-col">
		{#if header}
			{@render header()}
		{:else if title || dismissible}
			<div class="flex flex-none items-center justify-between gap-3 pt-4 pr-4 pb-2 pl-6 max-md:pt-3 max-md:pr-2 max-md:pb-1 max-md:pl-4">
				<h2 class="t-h3 wrap-anywhere">{title}</h2>
				{#if dismissible}<IconBtn icon={CloseLarge} label="Закрыть" onclick={() => void attemptClose()} />{/if}
			</div>
		{/if}
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 pt-2 pb-4 max-md:px-4 max-md:pb-3">{@render children?.()}</div>
		{#if footer}
			<div
				class="flex flex-none flex-wrap justify-start gap-3 border-t border-line bg-elevated px-6 pt-3 pb-4 max-md:flex-col-reverse max-md:px-4 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] max-md:[&_button]:w-full"
			>
				<BtnSizeScope size="auto">{@render footer()}</BtnSizeScope>
			</div>
		{/if}
	</div>
</Modal>
