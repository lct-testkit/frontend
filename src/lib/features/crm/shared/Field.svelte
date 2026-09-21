<script lang="ts">
	// Пара «подпись — значение» карточек. Пустое значение показывается как «—».
	import type { Snippet } from 'svelte';

	let { label, children, class: className = '' }: { label: string; children?: Snippet; class?: string } = $props();
</script>

<div class={['flex min-w-0 flex-col gap-0.5', className]}>
	<dt class="t-desc-l text-muted">{label}</dt>
	<dd class="t-body-m m-0 min-w-0 break-words">{#if children}{@render children()}{:else}—{/if}</dd>
</div>
