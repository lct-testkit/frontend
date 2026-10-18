<script lang="ts">
	// Меню глав справки: группы сворачиваются, группа открытой главы раскрыта. Пункты — SideMenu дизайн-системы как есть.
	import { SideMenu, SideMenuContent, SideMenuItem } from '@lct-testkit/rt-ui';
	import { ChevronDown, ChevronUp } from '@lct-testkit/rt-ui/icons';
	import { groupChapters, type Chapter } from './chapters';

	interface Props {
		chapters: Chapter[];
		current: string | undefined;
		onOpen: (slug: string) => void;
	}

	let { chapters, current, onOpen }: Props = $props();

	const groups = $derived(groupChapters(chapters));
	const currentGroup = $derived(chapters.find((c) => c.slug === current)?.group);
	// группы, которые человек открыл или закрыл сам; пока он их не трогал, открыта группа текущей главы
	let touched = $state<Record<string, boolean>>({});
	const isOpen = (key: string) => touched[key] ?? key === currentGroup;
</script>

<SideMenu isOpened class="h-auto w-full rounded-lg border border-line" data-testid="help-nav">
	<SideMenuContent class="flex-none">
		{#each groups as group (group.key)}
			{@const open = isOpen(group.key)}
			<SideMenuItem
				class="cursor-pointer"
				variant="truncate"
				aria-expanded={open}
				onclick={() => (touched = { ...touched, [group.key]: !open })}
				data-help-group={group.key}
			>
				{#snippet suffix()}{#if open}<ChevronUp />{:else}<ChevronDown />{/if}{/snippet}
				<span class="t-body-m-strong">{group.title}</span>
			</SideMenuItem>
			{#if open}
				{#each group.chapters as chapter (chapter.slug)}
					<SideMenuItem class="cursor-pointer" variant="truncate" selected={chapter.slug === current} aria-current={chapter.slug === current ? 'page' : undefined} onclick={() => onOpen(chapter.slug)} data-help-chapter={chapter.slug}>
						{chapter.title}
					</SideMenuItem>
				{/each}
			{/if}
		{/each}
	</SideMenuContent>
</SideMenu>
