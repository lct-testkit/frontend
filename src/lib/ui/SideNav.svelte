<script lang="ts">
	// Side menu of the shell: the DS `SideMenu` as in its CRM example — brand on top, items, «Свернуть» at the bottom.
	// Sections with a title («Настройка», «Администрирование») show it only while the menu is expanded; collapsed = icons + tooltips.
	import type { Snippet } from 'svelte';
	import { Counter, SideMenu, SideMenuContent, SideMenuFooter, SideMenuHeader, SideMenuHideButton, SideMenuItem, SideMenuTitle } from '@lct-testkit/rt-ui';
	import type { NavItem, NavSection } from '$lib/nav';
	import NavIcon from './NavIcon.svelte';

	interface Props {
		sections: NavSection[];
		/** is this item the current page */
		isActive: (item: NavItem) => boolean;
		/** live counters by item id (`signing` → number of documents waiting for me) */
		counters?: Record<string, number>;
		expanded: boolean;
		onNavigate: (href: string, event?: MouseEvent) => void;
		/** shows the «Свернуть» button (desktop only) */
		onToggle?: () => void;
		/** the product mark */
		brand: Snippet;
		/** extra bottom area (the phone drawer puts the account and the theme here) */
		footer?: Snippet;
		class?: string;
	}

	let { sections, isActive, counters = {}, expanded, onNavigate, onToggle, brand, footer, class: className = '' }: Props = $props();
</script>

<SideMenu class={className} isOpened={expanded}>
	<SideMenuHeader>{@render brand()}</SideMenuHeader>

	<SideMenuContent class="atmr-scroll-bar">
		{#each sections as section (section.id)}
			{#if section.title && expanded}<SideMenuTitle>{section.title}</SideMenuTitle>{/if}
			{#each section.items as item (item.id)}
				{@const count = counters[item.id] ?? 0}
				<SideMenuItem class="cursor-pointer" selected={isActive(item)} title={item.label} onclick={(e: MouseEvent) => onNavigate(item.href, e)} data-nav={item.id}>
					{#snippet prefix()}<NavIcon icon={item.icon} />{/snippet}
					{#snippet suffix()}{#if count > 0}<Counter size="xs" colorScheme="accent">{count}</Counter>{/if}{/snippet}
					{item.label}
				</SideMenuItem>
			{/each}
		{/each}
	</SideMenuContent>

	{#if onToggle}
		<SideMenuFooter><SideMenuHideButton onclick={onToggle} /></SideMenuFooter>
	{:else if footer}
		<SideMenuFooter>{@render footer()}</SideMenuFooter>
	{/if}
</SideMenu>
