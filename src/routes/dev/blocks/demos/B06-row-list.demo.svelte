<script module lang="ts">
	export const meta = {
		block: 'B6',
		title: 'Списки-строки',
		note: 'Задачи, уведомления, недавние, история. Строка от 56 px: [начало] название / серая строка ниже [конец]. Кликабельна вся строка, но фокус — один (название), поэтому флажок или ссылка внутри строки работают отдельно. Группа — заголовок со счётчиком в карточке с тонкими разделителями. (В rt-ui у ListItem нет собственной раскладки вне бокового меню.)'
	};
</script>

<script lang="ts">
	import { Checkbox } from '@lct-testkit/rt-ui';
	import { Notification, Task } from '@lct-testkit/rt-ui/icons';
	import { ListRow, RowList, StatusChip } from '$lib/ui';
	import DemoState from '../DemoState.svelte';

	let done = $state<Record<string, boolean>>({ c: true });
	const noop = () => {};
</script>

<DemoState title="Задачи: флажок, название, срок и сделка в серой строке, приоритет справа" bare>
	<div class="flex flex-col gap-4">
		<RowList title="Просрочено" count={2} danger>
			{@render taskRow('a', 'Созвониться с руководителем кафедры', 'Просрочена: 18.09.2026', true, 'Высокий')}
			{@render taskRow('b', 'Отправить коммерческое предложение проректору', 'Просрочена: 18.09.2026', true, '')}
		</RowList>
		<RowList title="На этой неделе" count={3}>
			{@render taskRow('c', 'Подготовить договор для юристов вуза', 'До 23.09.2026', false, '')}
			{@render taskRow('d', 'Уточнить бюджет на 2026/27 учебный год: сверить смету с бухгалтерией, согласовать сумму и сроки оплаты по этапам обучения', 'До 24.09.2026', false, 'Критичный')}
		</RowList>
	</div>
</DemoState>

<DemoState title="Уведомления: значок в начале, непрочитанное — жирным и с точкой" bare>
	<RowList title="Сегодня" count={3}>
		<ListRow title="Сделка D-2026-000071 переведена на «Квалификация»" unread onclick={noop}>
			{#snippet prefix()}<Notification />{/snippet}
			{#snippet description()}<span>Пётр Петров</span><span>10 минут назад</span>{/snippet}
		</ListRow>
		<ListRow title="Вас упомянули в обсуждении сделки D-2026-000070" unread href="/deals">
			{#snippet prefix()}<Notification />{/snippet}
			{#snippet description()}<span>Иван Иванов</span><span>2 часа назад</span>{/snippet}
		</ListRow>
		<ListRow title="Запрос на подпись КП ожидает вашего решения" onclick={noop}>
			{#snippet prefix()}<Task />{/snippet}
			{#snippet description()}<span>Вчера, 18:20</span>{/snippet}
			{#snippet suffix()}<StatusChip label="Ожидает" tone="warning" />{/snippet}
		</ListRow>
	</RowList>
</DemoState>

<DemoState title="Без действий и описаний — строка той же высоты" bare>
	<RowList>
		<ListRow title="Только название" />
		<ListRow title="Название и метка справа">
			{#snippet suffix()}<StatusChip label="Активна" tone="success" />{/snippet}
		</ListRow>
	</RowList>
</DemoState>

{#snippet taskRow(id: string, title: string, when: string, overdue: boolean, priority: string)}
	<ListRow {title} muted={!!done[id]} onclick={noop}>
		{#snippet prefix()}<Checkbox variant="primary" checked={!!done[id]} aria-label="Выполнено" onChange={(v: boolean) => (done[id] = v)} />{/snippet}
		{#snippet description()}
			<span class={overdue ? 'text-danger' : ''}>{when}</span>
			<span class="min-w-0 truncate"><a class="relative z-10" href="/deals">D-2026-000001</a> · Программа «Разработка на Python» для 3 курса</span>
		{/snippet}
		{#snippet suffix()}{#if priority}<StatusChip label={priority} tone={priority === 'Критичный' ? 'error' : 'warning'} />{/if}{/snippet}
	</ListRow>
{/snippet}
