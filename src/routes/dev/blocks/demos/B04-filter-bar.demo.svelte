<script module lang="ts">
	export const meta = {
		block: 'B4 · B11',
		title: 'Панель фильтров и вкладки',
		note: 'Эталон: rt-ui/examples/crm (Organizations.svelte): вкладки с числом «Все · 34» → поле поиска на всю оставшуюся ширину + фильтры одной строкой БЕЗ подписи над полем (подпись = плейсхолдер: строка той же высоты, что вкладки и кнопки), главная кнопка и значки справа. На телефоне — поиск и кнопка «Фильтры», поля с подписями в панели.'
	};
</script>

<script lang="ts">
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { FilterBar, IconBtn, TabsBar } from '$lib/ui';
	import DemoState from '../DemoState.svelte';
	import { CITY_ITEMS, STATUS_ITEMS } from '../mock';

	let tab = $state('all');
	let search = $state('');
	let status = $state<string | null>(null);
	let city = $state<string | null>(null);
	const active = $derived((status ? 1 : 0) + (city ? 1 : 0));
	function reset() {
		status = null;
		city = null;
	}
	const TABS = [
		{ key: 'all', label: 'Все', count: 34 },
		{ key: 'mine', label: 'Мои', count: 5 },
		{ key: 'attention', label: 'Требуют внимания', count: 18 },
		{ key: 'archive', label: 'Архив', count: 6 }
	];
</script>

<DemoState title="Вкладки и панель фильтров, как на странице списка" bare>
	<div class="flex flex-col gap-4">
		<TabsBar items={TABS} value={tab} onChange={(k) => (tab = k)} label="Список" />
		<FilterBar {search} placeholder="Название или ИНН" onSearch={(v) => (search = v)} {active} onReset={reset} found={34 - active * 7}>
			{#snippet filters()}
				<Pick label="Статус" items={STATUS_ITEMS} value={status} clearable onChange={(v) => (status = v)} />
				<Pick label="Город" items={CITY_ITEMS} value={city} clearable search onChange={(v) => (city = v)} />
			{/snippet}
		</FilterBar>
	</div>
</DemoState>

<DemoState title="Только поиск (справочники) — то же место и высота" bare>
	<div class="flex flex-col gap-4">
		<FilterBar search="" placeholder="Название или код" onSearch={() => {}} />
	</div>
</DemoState>

<DemoState title="Поиск, фильтры и кнопки справа: главная кнопка страницы и значки" bare>
	<div class="flex flex-col gap-4">
		<FilterBar search="" placeholder="Номер или название" onSearch={() => {}} active={1} onReset={() => {}} primary={{ label: 'Новая сделка', onclick: () => {} }}>
			{#snippet filters()}
				<Pick label="Статус" items={STATUS_ITEMS} value="talks" clearable />
			{/snippet}
			{#snippet trailing()}<IconBtn icon={Refresh} label="Обновить" />{/snippet}
		</FilterBar>
	</div>
</DemoState>
