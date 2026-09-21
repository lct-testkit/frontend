<script module lang="ts">
	export const meta = {
		block: 'B3',
		title: 'Шапка страницы',
		note: 'Эталон: rt-ui/examples/crm (.orgs__head) и сторис Page Title Status. Высота строки не меньше одного контрола (40 px) — заголовок не прыгает, есть в строке кнопки или нет. «Создать» — всегда primary: кнопка от 768 px, плавающая кнопка на телефоне. Дополнительные действия — иконки или контурные кнопки.'
	};
</script>

<script lang="ts">
	import { Download, Refresh } from '@lct-testkit/rt-ui/icons';
	import { Btn, IconBtn, PageHeader, StatusChip } from '$lib/ui';
	import DemoState from '../DemoState.svelte';

	const noop = () => {};
</script>

<DemoState title="Список: заголовок, действия-иконки и «Создать»" bare>
	<div class="flex flex-col gap-4">
		<PageHeader title="Контакты" primary={{ label: 'Новый контакт', onclick: noop }}>
			{#snippet actions()}<IconBtn icon={Refresh} label="Обновить" />{/snippet}
		</PageHeader>
	</div>
</DemoState>

<DemoState title="Список с описанием и контурной кнопкой" bare>
	<div class="flex flex-col gap-4">
		<PageHeader title="Организации" subtitle="Вузы-партнёры и потенциальные клиенты" primary={{ label: 'Добавить организацию', onclick: noop }}>
			{#snippet actions()}<Btn label="Экспорт списка" icon={Download} variant="outline" colorScheme="neutral" />{/snippet}
		</PageHeader>
	</div>
</DemoState>

<DemoState title="Карточка: назад, номер сделки, статусы, действия" bare>
	<div class="flex flex-col gap-4">
		<PageHeader title="D-2026-000431" subtitle="Программа «Разработка на Python» для 3 курса · КГТУ" back="/deals">
			{#snippet meta()}<StatusChip label="Согласование КП" tone="info" /><StatusChip label="Просрочено" tone="error" />{/snippet}
			{#snippet actions()}
				<IconBtn icon={Refresh} label="Обновить" />
				<Btn label="Отправить на подпись" variant="outline" colorScheme="neutral" />
			{/snippet}
		</PageHeader>
	</div>
</DemoState>

<DemoState title="Очень длинный заголовок: переносится, кнопки остаются на месте" bare>
	<div class="flex flex-col gap-4">
		<PageHeader title="Федеральное государственное автономное образовательное учреждение высшего образования «Национальный исследовательский университет»" back="/organizations" primary={{ label: 'Новая сделка', onclick: noop }}>
			{#snippet meta()}<StatusChip label="Действует" tone="success" />{/snippet}
		</PageHeader>
	</div>
</DemoState>

<DemoState title="Без действий: строка той же высоты, что и с кнопками" bare>
	<div class="flex flex-col gap-4"><PageHeader title="Справочники" /></div>
</DemoState>
