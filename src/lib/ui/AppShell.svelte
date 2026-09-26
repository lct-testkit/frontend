<script lang="ts">
	// Signed-in frame: side menu (desktop: expanded/collapsed, tablet: icons, phone: burger + drawer), top bar, content.
	// The blocks are `SideNav` and `TopBar`; this file only wires them to the session, the router, the theme and the counters.
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Drawer } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { DarkTheme, HelpStroke, Menu, Sun } from '@lct-testkit/rt-ui/icons';
	import { NAV, isActive, isVisible } from '$lib/nav';
	import { session } from '$lib/auth/session.svelte';
	import { theme } from '$lib/stores/theme.svelte';
	import { helpAttention } from '$lib/stores/help-attention.svelte';
	import NotificationBell from '$lib/features/crm/notifications/NotificationBell.svelte';
	import { signatureInbox } from '$lib/features/signing/inbox.svelte';
	import GlobalSearch from './GlobalSearch.svelte';
	import Brand from './Brand.svelte';
	import Notice from './Notice.svelte';
	import SideNav from './SideNav.svelte';
	import TopBar from './TopBar.svelte';
	import TopBarIcon from './TopBarIcon.svelte';

	let { children }: { children?: Snippet } = $props();

	const bp = useBreakpoint();
	const MENU_KEY = 'rtk.menu';

	let menuOpen = $state(true);
	let navOpen = $state(false);

	onMount(() => {
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(MENU_KEY);
		} catch {
			// ignore
		}
		menuOpen = saved ? saved === '1' : window.innerWidth >= 1400;
		helpAttention.init();
		// counter next to «Подписание»: only for those who can sign
		if (session.canAny('signature:sign', 'signature:create')) return signatureInbox.start();
	});

	function toggleMenu() {
		menuOpen = !menuOpen;
		try {
			localStorage.setItem(MENU_KEY, menuOpen ? '1' : '0');
		} catch {
			// ignore
		}
	}

	// tablet is always icons-only: expanding it would squeeze the content
	const expanded = $derived(menuOpen && bp.isDesktop);

	const sections = $derived(NAV.map((s) => ({ ...s, items: s.items.filter((i) => isVisible(i, (p) => session.can(p))) })).filter((s) => s.items.length > 0));
	const counters = $derived({ signing: signatureInbox.count });
	// «Справка» просит внимания, пока её не открыли (после обновления глав — снова)
	const attention = $derived({ help: helpAttention.show });

	function go(href: string, event?: MouseEvent) {
		if (event && (event.ctrlKey || event.metaKey || event.button === 1)) {
			window.open(href, '_blank');
			return;
		}
		navOpen = false;
		void goto(href);
	}

	const userItems = $derived([
		{ key: 'profile', value: 'Профиль' },
		...(session.mode === 'demo' ? [{ key: 'switch', value: 'Сменить учётную запись' }] : []),
		{ key: 'logout', value: 'Выйти' }
	]);

	async function onUserItem(key: string) {
		if (key === 'profile') void goto('/profile');
		else if (key === 'switch' || key === 'logout') {
			await session.logout();
			void goto('/login');
		}
	}

	const themeLabel = $derived(theme.mode === 'dark' ? 'Светлая тема' : 'Тёмная тема');
</script>

{#snippet brandLink(compact: boolean, logoOnNarrow = false)}
	<a class="flex min-w-0 items-center text-fg no-underline hover:no-underline max-md:min-h-11" href="/" onclick={(e) => { e.preventDefault(); go('/'); }} aria-label="RTK School CRM — на главную">
		<Brand {compact} short={bp.isMobile} {logoOnNarrow} />
	</a>
{/snippet}

<div class="flex h-dvh overflow-hidden bg-page text-fg">
	{#if !bp.isMobile}
		<SideNav class="h-full flex-none" {sections} isActive={(item) => isActive(item, page.url.pathname)} {counters} {attention} {expanded} onNavigate={go} onToggle={bp.isDesktop ? toggleMenu : undefined}>
			{#snippet brand()}{@render brandLink(!expanded)}{/snippet}
		</SideNav>
	{/if}

	<div class="flex min-w-0 flex-1 flex-col">
		<TopBar user={{ name: session.fullName, role: session.roleLabel }} items={userItems} onItem={onUserItem} compact={bp.isMobile}>
			{#snippet start()}
				{#if bp.isMobile}
					<TopBarIcon icon={Menu} label="Меню" onclick={() => (navOpen = true)} data-testid="burger" />
					{@render brandLink(false, true)}
				{:else}
					<GlobalSearch />
				{/if}
			{/snippet}
			{#snippet utilities()}
				{#if bp.isMobile}<GlobalSearch />{/if}
				<NotificationBell />
				<TopBarIcon icon={HelpStroke} label="Справка" attention={helpAttention.show} onclick={() => goto('/help')} data-testid="help" />
				{#if !bp.isMobile}<TopBarIcon icon={theme.mode === 'dark' ? Sun : DarkTheme} label={themeLabel} onclick={() => theme.toggleMode()} />{/if}
			{/snippet}
		</TopBar>

		{#if session.passwordChangeRequired}
			<div class="flex-none px-4 pt-3 max-md:px-3">
				<Notice tone="warning" actions={[{ label: 'Сменить пароль', onclick: () => goto('/profile?tab=security') }]}>Пока вы не смените пароль, часть действий недоступна.</Notice>
			</div>
		{/if}

		<main class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto outline-none" id="content" tabindex="-1">{@render children?.()}</main>
	</div>
</div>

{#if bp.isMobile}
	<Drawer position="left" fullHeight dimension={Math.min(320, Math.max(240, bp.width - 56))} isOpened={navOpen} drawerClassName="p-0!" onClickOverlay={() => (navOpen = false)} onClose={() => (navOpen = false)}>
		<SideNav class="h-full w-full border-r-0" {sections} isActive={(item) => isActive(item, page.url.pathname)} {counters} {attention} expanded onNavigate={go}>
			{#snippet brand()}{@render brandLink(false)}{/snippet}
			{#snippet footer()}
				<div class="box-border flex w-full items-center justify-between gap-3 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
					<span class="t-body-s truncate">{session.fullName}</span>
					<TopBarIcon icon={theme.mode === 'dark' ? Sun : DarkTheme} label={themeLabel} onclick={() => theme.toggleMode()} />
				</div>
			{/snippet}
		</SideNav>
	</Drawer>
{/if}
