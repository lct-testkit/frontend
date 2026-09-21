<script lang="ts">
	// Must be rendered INSIDE <ToastNotificationsProvider> (root layout): hands the stack's addNotification to toast.svelte.ts.
	import { onMount } from 'svelte';
	import { useNotificationsStack } from '@lct-testkit/rt-ui/components/Notifications/hooks.svelte.js';
	import { registerToastAdder } from './toast.svelte';

	const stack = useNotificationsStack();

	onMount(() => {
		registerToastAdder((props) => stack.addNotification(props));
		return () => registerToastAdder(null);
	});
</script>
