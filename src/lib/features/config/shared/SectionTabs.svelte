<script lang="ts">
	// Вкладки-разделы (каждая — свой маршрут): справочники, отчёты, интеграции. Тот же блок TabsBar, что и везде (размер m, подчёркивание,
	// на телефоне прокручиваются по горизонтали): вкладки в разных разделах не отличаются размером.
	import { goto } from '$app/navigation';
	import { TabsBar } from '$lib/ui';

	export interface SectionTab {
		key: string;
		label: string;
		href?: string;
	}

	interface Props {
		tabs: readonly SectionTab[];
		active: string;
		/** для вкладок без маршрута (внутри страницы) */
		onSelect?: (key: string) => void;
		/** линию под вкладками рисует шапка страницы, когда вкладки стоят в одной строке с кнопками */
		underline?: boolean;
	}

	let { tabs, active, onSelect, underline = true }: Props = $props();

	function change(index: string) {
		const tab = tabs.find((t) => t.key === index);
		if (!tab) return;
		if (onSelect) onSelect(index);
		else if (tab.href) void goto(tab.href);
	}
</script>

<TabsBar items={tabs.map((t) => ({ key: t.key, label: t.label }))} value={active} onChange={change} {underline} label="Разделы" />
