<script lang="ts">
	// Разделы отчётов: виды отчётов · мои отчёты · дашборды.
	import SectionTabs from '../shared/SectionTabs.svelte';

	let { active, underline = true }: { active: 'gallery' | 'history' | 'dashboards'; underline?: boolean } = $props();

	const TABS = [
		{ key: 'gallery', label: 'Отчёты', href: '/reports' },
		{ key: 'history', label: 'Мои отчёты', href: '/reports/history' },
		{ key: 'dashboards', label: 'Дашборды', href: '/reports/dashboards' }
	] as const;
</script>

<SectionTabs tabs={TABS} {active} {underline} />
