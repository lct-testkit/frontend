<script lang="ts">
	// Side panel for viewing/editing an entity without leaving the list. Right side, full height; full screen on phones.
	// Same anatomy as AppModal: header (title + close), scrolling body, sticky footer. The footer is left-aligned with the MAIN button first (the DS recipes; a phone:
	// one under another, the main one at the bottom, at the thumb). Forms use FormDrawer, which fills the footer.
	import type { Snippet } from 'svelte';
	import { Drawer } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { CloseLarge } from '@lct-testkit/rt-ui/icons';
	import BtnSizeScope from './BtnSizeScope.svelte';
	import { confirmState } from './confirm.svelte';
	import IconBtn from './IconBtn.svelte';

	interface Props {
		open: boolean;
		title?: string;
		/** px on desktop */
		width?: number;
		position?: 'right' | 'left';
		onClose?: () => void;
		children?: Snippet;
		footer?: Snippet;
		/** replaces the plain title row (e.g. title + status chip) */
		header?: Snippet;
	}

	let { open, title = '', width = 520, position = 'right', onClose, children, footer, header }: Props = $props();

	const bp = useBreakpoint();
	const dimension = $derived(bp.isMobile ? Math.max(bp.width, 320) : Math.min(width, Math.max(bp.width - 64, 360)));

	// a confirm (e.g. "Закрыть без сохранения?") stacked on top of this panel must be the only thing Esc/overlay-click reaches: this panel and the
	// confirm share the DS's own z-index token, so its Esc/overlay-click firing at the same time as the confirm's own would resolve the pending
	// confirm and immediately open an identical-looking one in the same tick — the dialog would look permanently stuck (see app.css, near
	// `.atmr-modal-wrapper`)
	function closeUnlessConfirming() {
		if (!confirmState.current) onClose?.();
	}
</script>

<Drawer fullHeight {position} {dimension} isOpened={open} drawerClassName="p-0!" onClickOverlay={closeUnlessConfirming} onEsc={closeUnlessConfirming}>
	<div class="flex h-full min-h-0 flex-col">
		{#if header}
			{@render header()}
		{:else}
			<div class="flex flex-none items-center justify-between gap-3 pt-4 pr-4 pb-2 pl-6 max-md:pt-3 max-md:pr-2 max-md:pb-1 max-md:pl-4">
				<h2 class="t-h3 wrap-anywhere">{title}</h2>
				<IconBtn icon={CloseLarge} label="Закрыть" onclick={() => onClose?.()} />
			</div>
		{/if}
		<div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-6 pt-2 pb-6 max-md:px-4 max-md:pb-4">{@render children?.()}</div>
		{#if footer}
			<div
				class="flex flex-none flex-wrap justify-start gap-3 border-t border-line px-6 pt-3 pb-4 max-md:flex-col-reverse max-md:px-4 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] max-md:[&_button]:w-full"
			>
				<BtnSizeScope size="auto">{@render footer()}</BtnSizeScope>
			</div>
		{/if}
	</div>
</Drawer>
