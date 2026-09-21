<script lang="ts">
	// Top bar of the shell, built like the design system's CRM example (rt-ui/src/routes/examples/crm/CrmApp.svelte):
	//   [ start: search (desktop) | burger + brand (phone) ]   [ utilities: bell, help, theme ]   [ profile ▾ ]
	// The profile is the DS `TopMenuProfileContainer`: its hover ring is drawn by the DS around the avatar, and is round only when the
	// avatar carries `atmr-top-menu__profile-avatar--round` (which `Avatar` gets from `profile`).
	import type { Snippet } from 'svelte';
	import { DropdownMenu, TopMenu, TopMenuProductContainer, TopMenuProfileContainer, TopMenuUtilitiesContainer } from '@lct-testkit/rt-ui';
	import { ChevronDown } from '@lct-testkit/rt-ui/icons';
	import Avatar from './Avatar.svelte';

	interface Props {
		/** desktop: the global search; phone: burger + brand */
		start?: Snippet;
		/** icon buttons before the profile (`TopBarIcon`) */
		utilities?: Snippet;
		user: { name: string; role: string };
		/** the profile drop-down */
		items: { key: string; value: string }[];
		onItem: (key: string) => void;
		/** phone: the profile is the avatar alone */
		compact?: boolean;
	}

	let { start, utilities, user, items, onItem, compact = false }: Props = $props();
	let open = $state(false);
</script>

{#snippet avatar()}<Avatar name={user.name} size={36} profile />{/snippet}
{#snippet chevron()}<ChevronDown />{/snippet}

<!-- name and role are cut at 16rem: a long full name must not push the icons around (the DS text has no ellipsis of its own) -->
<TopMenu class="h-14 flex-none px-6 max-lg:px-4 max-md:px-3 [&_.atmr-top-menu__profile-text]:max-w-64 [&_.atmr-top-menu__profile-text>*]:truncate">
	<TopMenuProductContainer align="left">{@render start?.()}</TopMenuProductContainer>

	<TopMenuUtilitiesContainer>{@render utilities?.()}</TopMenuUtilitiesContainer>

	<!-- the DS drop-down root is `width: 100%`: without `w-auto` it would take the whole row -->
	<DropdownMenu class="w-auto flex-none" {items} isOpened={open} placement="bottomRight" onClose={() => (open = false)} onClickItem={(item) => ((open = false), onItem(String(item.key)))}>
		{#if compact}
			<TopMenuProfileContainer prefix={avatar} onclick={() => (open = !open)} aria-label={user.name} aria-haspopup="menu" aria-expanded={open} data-testid="user-menu" />
		{:else}
			<TopMenuProfileContainer prefix={avatar} title={user.name} hint={user.role} suffix={chevron} onclick={() => (open = !open)} aria-haspopup="menu" aria-expanded={open} data-testid="user-menu" />
		{/if}
	</DropdownMenu>
</TopMenu>
