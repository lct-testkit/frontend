<script lang="ts">
	// Copies `value` to the clipboard and confirms with a short toast. Icon-only.
	import { Copy } from '@lct-testkit/rt-ui/icons';
	import IconBtn from './IconBtn.svelte';
	import { toast } from './toast.svelte';

	let { value, label = 'Копировать', done = 'Скопировано', size = 's' }: { value: string; label?: string; done?: string; size?: 's' | 'm' | 'l' } = $props();

	async function copy() {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(done);
		} catch {
			toast.error('Не удалось скопировать');
		}
	}
</script>

<IconBtn icon={Copy} {label} {size} onclick={copy} />
