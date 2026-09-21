<script module lang="ts">
	export const meta = {
		block: 'B1',
		title: 'Верхняя панель',
		note: 'Эталон: rt-ui/examples/crm → TopMenu. Слева поиск (на телефоне — бургер и бренд), справа колокольчик, справка, тема, профиль. Ховер и фокус — из самой дизайн-системы (.atmr-top-menu__utilities-icon, кольцо вокруг аватара).'
	};
</script>

<script lang="ts">
	import { DarkTheme, HelpStroke, Menu, Notification, NotificationNew, Search } from '@lct-testkit/rt-ui/icons';
	import Brand from '$lib/ui/Brand.svelte';
	import SearchInput from '$lib/ui/SearchInput.svelte';
	import TopBar from '$lib/ui/TopBar.svelte';
	import TopBarIcon from '$lib/ui/TopBarIcon.svelte';
	import DemoState from '../DemoState.svelte';

	const items = [
		{ key: 'profile', value: 'Профиль' },
		{ key: 'logout', value: 'Выйти' }
	];
	const noop = () => {};
	let query = $state('');
</script>

{#snippet searchField()}
	<div class="w-full max-w-md min-w-0"><SearchInput value={query} shortcut="K" aria-label="Поиск" onChange={(e: Event) => (query = (e.target as HTMLInputElement).value)} /></div>
{/snippet}

{#snippet iconRow(unread: boolean)}
	<TopBarIcon label={unread ? 'Уведомления: есть непрочитанные' : 'Уведомления'}>{#if unread}<NotificationNew />{:else}<Notification />{/if}</TopBarIcon>
	<TopBarIcon icon={HelpStroke} label="Справка" />
	<TopBarIcon icon={DarkTheme} label="Тёмная тема" />
{/snippet}

<DemoState title="Есть непрочитанные: красная точка на колокольчике, без цифры" bare>
	<TopBar user={{ name: 'Иван Иванов', role: 'Менеджер по вузам' }} {items} onItem={noop}>
		{#snippet start()}{@render searchField()}{/snippet}
		{#snippet utilities()}{@render iconRow(true)}{/snippet}
	</TopBar>
</DemoState>

<DemoState title="Всё прочитано; длинные имя и должность обрезаются, панель не ломается" bare>
	<TopBar user={{ name: 'Александра-Мария Константинопольская-Ивановская', role: 'Руководитель отдела по работе с высшими учебными заведениями' }} {items} onItem={noop}>
		{#snippet start()}{@render searchField()}{/snippet}
		{#snippet utilities()}{@render iconRow(false)}{/snippet}
	</TopBar>
</DemoState>

<DemoState title="Телефон: бургер, бренд, поиск-иконка, колокольчик, аватар (смотреть в рамке 390 / 360)" bare>
	<TopBar user={{ name: 'Иван Иванов', role: 'Менеджер по вузам' }} {items} onItem={noop} compact>
		{#snippet start()}
			<TopBarIcon icon={Menu} label="Меню" />
			<Brand short />
		{/snippet}
		{#snippet utilities()}
			<TopBarIcon icon={Search} label="Поиск" />
			<TopBarIcon label="Уведомления: есть непрочитанные"><NotificationNew /></TopBarIcon>
		{/snippet}
	</TopBar>
</DemoState>
