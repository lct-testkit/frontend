<script module lang="ts">
	export const meta = {
		block: 'B5',
		title: 'Таблица',
		note: 'Эталон: rt-ui/examples/crm (TableGrid) и сторис TableGrid. Каждая строка — одна высота, одна строка текста; вторая величина — в своей колонке. Отступ пользовательских ячеек — TableCell. Заголовки сортируются, выбор строк с панелью действий, «Показать ещё» в подвале, состояния: загрузка, пусто, ошибка. На телефоне — карточки.'
	};
</script>

<script lang="ts">
	import { ActionBar } from '@lct-testkit/rt-ui/components/TableGrid';
	import { ApiError } from '$lib/api/errors';
	import { Btn, DataTable, StatusChip, TableCell, type Col, type SortState } from '$lib/ui';
	import DemoState from '../DemoState.svelte';
	import { CONTACTS, LONG_NAME_CONTACT, type MockContact } from '../mock';

	let sort = $state<SortState | null>({ key: 'name', dir: 'asc' });
	let selected = $state<string[]>([]);

	const rows = $derived(
		[...CONTACTS].sort((a, b) => {
			const k = (sort?.key ?? 'name') as 'name';
			return (sort?.dir === 'desc' ? -1 : 1) * a[k].localeCompare(b[k], 'ru');
		})
	);

	const columns: Col<MockContact>[] = [
		{ key: 'name', title: 'Контакт', width: 'minmax(220px, 2fr)', sortable: true, render: nameCell },
		{ key: 'position', title: 'Должность', width: 'minmax(180px, 1.6fr)', showFrom: 'desktop', render: textCell },
		{ key: 'org', title: 'Организация', width: 'minmax(140px, 1.2fr)', showFrom: 'tablet', render: orgCell },
		{ key: 'email', title: 'E-mail', width: 220, showFrom: 'wide', render: mutedCell },
		{ key: 'phone', title: 'Телефон', width: 170, showFrom: 'desktop', render: phoneCell },
		{ key: 'dm', title: 'ЛПР', width: 100, render: dmCell }
	];
</script>

{#snippet nameCell(row: MockContact)}<TableCell><span class="truncate font-medium">{row.name}</span></TableCell>{/snippet}
{#snippet textCell(row: MockContact)}<TableCell><span class="truncate">{row.position}</span></TableCell>{/snippet}
{#snippet orgCell(row: MockContact)}<TableCell><span class="truncate">{row.org}</span></TableCell>{/snippet}
{#snippet mutedCell(row: MockContact)}<TableCell><span class="truncate text-muted">{row.email}</span></TableCell>{/snippet}
{#snippet phoneCell(row: MockContact)}<TableCell><span class="whitespace-nowrap text-muted">{row.phone}</span></TableCell>{/snippet}
{#snippet dmCell(row: MockContact)}<TableCell>{#if row.decisionMaker}<StatusChip label="ЛПР" tone="info" />{:else}<span class="text-soft">—</span>{/if}</TableCell>{/snippet}

{#snippet card(row: MockContact)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-center justify-between gap-2">
			<span class="t-body-m-strong break-words">{row.name}</span>
			{#if row.decisionMaker}<StatusChip label="ЛПР" tone="info" />{/if}
		</div>
		<span class="t-desc-l text-muted">{row.position}</span>
		<span class="t-desc-l truncate text-muted">{row.org}</span>
		<span class="t-desc-l text-muted">{row.phone}</span>
	</div>
{/snippet}

{#snippet bar()}
	<ActionBar onDelete={() => (selected = [])} onCancel={() => (selected = [])}>
		<Btn label="Назначить ответственного" variant="secondary" colorScheme="neutral" size="s" />
	</ActionBar>
{/snippet}

<DemoState title="Норма: сортировка по «Контакт», выбор строк, подвал со счётчиком и «Показать ещё»" bare>
	<DataTable id="demo-contacts" {rows} {columns} {card} {sort} onSort={(s) => (sort = s)} selectable {selected} onSelectionChange={(k) => (selected = k)} actionBar={bar} hasMore onLoadMore={() => {}} onRowClick={() => {}} ariaLabel="Контакты" />
</DemoState>

<DemoState title="Очень длинные значения: обрезаются многоточием, высота строки та же" bare>
	<DataTable id="demo-long" rows={[LONG_NAME_CONTACT, ...CONTACTS.slice(0, 2)]} {columns} {card} onRowClick={() => {}} />
</DemoState>

<DemoState title="Загрузка первой страницы" bare>
	<DataTable id="demo-loading" rows={[]} {columns} {card} loading />
</DemoState>

<DemoState title="Пусто (по умолчанию)" bare>
	<DataTable id="demo-empty" rows={[]} {columns} {card} emptyText="Контактов нет" />
</DemoState>

<DemoState title="Ошибка загрузки" bare>
	<DataTable id="demo-error" rows={[]} {columns} {card} error={new ApiError({ status: 500, detail: 'Сервис временно недоступен' })} onRetry={() => {}} />
</DemoState>
