<script lang="ts">
	// Guard for everything behind sign-in: loads the profile, redirects anonymous users to /login, wraps pages in the shell.
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Loader } from '@lct-testkit/rt-ui';
	import { ApiError } from '$lib/api/errors';
	import { session } from '$lib/auth/session.svelte';
	import AppShell from '$lib/ui/AppShell.svelte';
	import ConsentGate from '$lib/ui/ConsentGate.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import { isActive, isVisible, NAV } from '$lib/nav';

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

	// A section the side menu would hide (no permission) must say so by a direct link too (USERFLOWS §0.6), instead of rendering its
	// tabs/buttons and letting every request underneath answer 403 one at a time. Left out: «Главная» redirects a role without its own
	// permission elsewhere (`landingFor`); «Справочники»/«Воронки» hide their nav item behind the *write* permission on purpose (a KAM/HEAD
	// without it can still open the page and read — only editing is disabled inline), so gating them here would take that reading away.
	const NOT_GATED = new Set(['home', 'catalog', 'workflows']);
	const deniedItem = $derived.by(() => {
		if (session.status !== 'authenticated') return null;
		for (const section of NAV) {
			for (const item of section.items) {
				if (NOT_GATED.has(item.id)) continue;
				if (isActive(item, page.url.pathname) && !isVisible(item, (p) => session.can(p))) return item;
			}
		}
		return null;
	});
</script>

{#if session.status === 'authenticated'}
	<AppShell>
		{#if deniedItem}
			<Page>
				<PageHeader title={deniedItem.label} />
				<ErrorState error={new ApiError({ status: 403, detail: 'Этот раздел недоступен вашей роли.' })} />
			</Page>
		{:else}
			{@render children?.()}
		{/if}
	</AppShell>
	<ConsentGate />
{:else}
	<div class="flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Загрузка"><Loader size="m" /></div>
{/if}
