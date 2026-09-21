<script lang="ts">
	import '@lct-testkit/rt-ui/themes/rtk_default_light.min.css';
	import '@lct-testkit/rt-ui/themes/rtk_default_dark.min.css';
	import '@lct-testkit/rt-ui/themes/rtk_purple_light.min.css';
	import '@lct-testkit/rt-ui/themes/rtk_purple_dark.min.css';
	import '$lib/styles/fonts.css';
	import '../app.css';
	import { onMount, type Snippet } from 'svelte';
	import { ToastNotificationsProvider } from '@lct-testkit/rt-ui';
	import { ExtMotionProvider } from '@lct-testkit/rt-ui/ext';
	import { theme } from '$lib/stores/theme.svelte';
	import ConfirmHost from '$lib/ui/ConfirmHost.svelte';
	import ToastHost from '$lib/ui/ToastHost.svelte';

	let { children }: { children?: Snippet } = $props();

	onMount(() => {
		theme.init();
		document.body.setAttribute('data-theme-ready', '');
	});
</script>

<!-- the DS motion layer, ON for the whole app: windows, drawers, menus, tabs, tables and toasts move on a spring (prefers-reduced-motion still switches it off) -->
<ExtMotionProvider mode="svelte" type="spring">
	<ToastNotificationsProvider position="topRight" maxCount={3}>
		<ToastHost />
		{@render children?.()}
		<ConfirmHost />
	</ToastNotificationsProvider>
</ExtMotionProvider>
