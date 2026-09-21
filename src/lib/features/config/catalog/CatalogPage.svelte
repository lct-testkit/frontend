<script lang="ts">
	// Рамка страницы справочника: заголовок, вкладки шести справочников, «Создать» (только с правом catalog:write), строка фильтров.
	import type { Snippet } from 'svelte';
	import { Page, PageHeader } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import SectionTabs from '../shared/SectionTabs.svelte';
	import { CATALOG_TABS, type CatalogKey } from './tabs';

	interface Props {
		active: CatalogKey;
		createLabel?: string;
		onCreate?: () => void;
		/** фильтры / поиск над списком */
		toolbar?: Snippet;
		children: Snippet;
	}

	let { active, createLabel = 'Создать', onCreate, toolbar, children }: Props = $props();

	const canWrite = $derived(session.can('catalog:write'));
</script>

<Page>
	<PageHeader title="Справочники" primary={canWrite && onCreate ? { label: createLabel, onclick: onCreate } : undefined}>
		{#snippet tabs(underline)}<SectionTabs tabs={CATALOG_TABS} {active} {underline} />{/snippet}
	</PageHeader>
	{#if toolbar}<div class="flex min-w-0 flex-col gap-2">{@render toolbar()}</div>{/if}
	{@render children()}
</Page>
