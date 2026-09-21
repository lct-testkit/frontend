<script lang="ts">
	// Guard for everything behind sign-in: loads the profile, redirects anonymous users to /login, wraps pages in the shell.
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Loader } from '@lct-testkit/rt-ui';
	import { session } from '$lib/auth/session.svelte';
	import AppShell from '$lib/ui/AppShell.svelte';
	import ConsentGate from '$lib/ui/ConsentGate.svelte';

	let { children }: { children?: Snippet } = $props();

	onMount(() => {
		if (session.status === 'loading') void session.load();
	});

	$effect(() => {
		if (session.status === 'anonymous') {
			const next = page.url.pathname + page.url.search;
			void goto(next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`, { replaceState: true });
		}
	});
</script>

{#if session.status === 'authenticated'}
	<AppShell>{@render children?.()}</AppShell>
	<ConsentGate />
{:else}
	<div class="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Загрузка"><Loader size="m" /></div>
{/if}
