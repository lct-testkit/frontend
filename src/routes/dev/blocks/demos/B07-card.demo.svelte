<script module lang="ts">
	export const meta = {
		block: 'B7 · B11',
		title: 'Карточка объекта: шапка, шаги воронки, вкладки, секции',
		note: 'Эталон: rt-ui/examples/crm (OrganizationCard: заголовок + статус, вкладки, поля). Порядок сверху вниз: шапка страницы (назад, номер, статусы, действия) → шаги воронки (одна строка с названиями: сама прокручивается так, что текущий шаг в середине, видны по три шага до и после; полосы прокрутки нет) → вкладки с числами → секции-карточки. Действия перехода — в шапке: главное оранжевое, остальные контурные, всё лишнее — в меню.'
	};
</script>

<script lang="ts">
	import { Refresh, Edit } from '@lct-testkit/rt-ui/icons';
	import { Btn, Card, IconBtn, KeyValue, KeyValueList, PageHeader, StatusChip, StatusSteps, TabsBar, type Step } from '$lib/ui';
	import DemoState from '../DemoState.svelte';

	const NAMES = ['Идентификация вуза', 'Первичный контакт', 'Квалификация', 'Назначение встречи', 'Проведение встречи', 'Сбор требований', 'Формирование КП', 'Согласование КП', 'Юридическое согласование', 'Подписание договора', 'Передача материалов в LMS', 'Запуск обучения', 'Мониторинг успеваемости', 'Закрытие периода'];
	const build = (at: number, stopped = false, allDone = false): Step[] =>
		NAMES.map((name, i) => ({
			id: String(i),
			name,
			state: allDone ? 'done' : i < at ? 'done' : i === at ? (stopped ? 'stopped' : 'current') : 'future',
			onclick: i === at + 1 || i === 0 ? () => {} : undefined
		}));

	let tab = $state('overview');
	const TABS = [
		{ key: 'overview', label: 'Обзор' },
		{ key: 'comments', label: 'Обсуждение', count: 3 },
		{ key: 'files', label: 'Файлы' },
		{ key: 'tasks', label: 'Задачи', count: 2 },
		{ key: 'history', label: 'История' },
		{ key: 'signing', label: 'Подписание', dot: true }
	];
	const noop = () => {};
</script>

<DemoState title="Сделка на 2-м шаге из 14: главное действие оранжевое, «Отказ» и «Заморозить» контурные" bare>
	<div class="flex flex-col gap-4">
		<PageHeader title="Летняя школа Data Science для студентов" subtitle="D-2026-000071 · МОУПН · Пётр Петров" back="/deals">
			{#snippet meta()}<StatusChip label="Первичный контакт" tone="info" /><StatusChip label="просрочено 11 ч" tone="error" />{/snippet}
			{#snippet actions()}
				<IconBtn icon={Refresh} label="Обновить" />
				<IconBtn icon={Edit} label="Редактировать" />
				<Btn label="Отказ" variant="outline" colorScheme="neutral" danger />
				<Btn label="Заморозить" variant="outline" colorScheme="neutral" />
				<Btn label="Далее: Квалификация" onclick={noop} />
			{/snippet}
		</PageHeader>
		<StatusSteps steps={build(1)} />
		<TabsBar items={TABS} value={tab} onChange={(k) => (tab = k)} label="Разделы сделки" />
		<Card title="Сделка">
			<KeyValueList columns={3}>
				<KeyValue label="Сумма" value="210 000 ₽" />
				<KeyValue label="Организация" value="МОУПН" />
				<KeyValue label="Ответственный" value="Пётр Петров" />
			</KeyValueList>
		</Card>
	</div>
</DemoState>

<DemoState title="Шаг 6 из 14: одна строка, текущий в середине, видны три до и три после (первый и последний вне экрана)" bare>
	<StatusSteps steps={build(5)} />
</DemoState>

<DemoState title="Шаг 1: строка начинается с первого" bare>
	<StatusSteps steps={build(0)} />
</DemoState>

<DemoState title="Закрыта с отказом: лента остановилась на шаге, откуда ушла, справа — итоговый статус" bare>
	<StatusSteps steps={build(4, true)}>
		{#snippet end()}<StatusChip label="Отказ" tone="error" />{/snippet}
	</StatusSteps>
</DemoState>

<DemoState title="Закрыта успешно: строка показывает конец пути" bare>
	<StatusSteps steps={build(13, false, true)}>
		{#snippet end()}<StatusChip label="Успешно закрыта" tone="success" />{/snippet}
	</StatusSteps>
</DemoState>
