<script lang="ts">
	// Живая витрина rt-ui в справке (глава «Дизайн-система»): настоящие компоненты дизайн-системы и наши блоки на ней, не картинки.
	// Кнопки нажимаются, поля вводятся, тема переключается на весь интерфейс. Каждый образец подписан именами компонентов rt-ui, которые в нём работают.
	// Данные — выдуманные, в сеть образцы не ходят.
	import type { Snippet } from 'svelte';
	import { Chip, Counter, Loader } from '@lct-testkit/rt-ui';
	import { BarChart, DonutChart, LineChart } from '@lct-testkit/rt-ui/charts';
	import { AddSmall, Download, Settings } from '@lct-testkit/rt-ui/icons';
	import ThemePicker from '$lib/features/identity/ThemePicker.svelte';
	import { Btn, CheckField, DataTable, DateField, IconBtn, Money, Notice, NumberField, Pick, RadioField, StatusChip, TableCell, TextField, Toggle, toast, type Col, type SortState } from '$lib/ui';

	// поля
	let name = $state('Летняя школа Data Science');
	let email = $state('ivanov@');
	let amount = $state<number | null>(210000);
	let when = $state<string | null>('2026-11-12');
	let status = $state<string | null>(null);
	let org = $state<string | null>('kgtu');
	let notify = $state(true);
	let agree = $state(false);
	let kind = $state<string | null>('b2b');
	let chipOn = $state('open');

	const STATUSES = [
		{ key: 'new', value: 'Идентификация вуза' },
		{ key: 'qual', value: 'Квалификация' },
		{ key: 'won', value: 'Выиграна' },
		{ key: 'lost', value: 'Потеряна' }
	];
	const ORGS = [
		{ key: 'kgtu', value: 'КГТУ' },
		{ key: 'moupn', value: 'МОУПН' },
		{ key: 'college', value: 'Колледж связи №5' },
		{ key: 'itu', value: 'Институт технологий' }
	];
	const KINDS = [
		{ key: 'b2b', label: 'Вуз или колледж' },
		{ key: 'b2c', label: 'Физическое лицо' }
	];

	// таблица
	interface Deal {
		id: string;
		title: string;
		org: string;
		status: string;
		tone: 'neutral' | 'info' | 'success' | 'warning' | 'error';
		amount: number;
	}
	const DEALS: Deal[] = [
		{ id: 'D-2026-000081', title: 'Летняя школа Data Science', org: 'КГТУ', status: 'Квалификация', tone: 'info', amount: 210000 },
		{ id: 'D-2026-000080', title: 'Повышение квалификации кафедры', org: 'МОУПН', status: 'Идентификация вуза', tone: 'neutral', amount: 150000 },
		{ id: 'D-2026-000078', title: 'Курс по робототехнике', org: 'Колледж связи №5', status: 'Выиграна', tone: 'success', amount: 480000 },
		{ id: 'D-2026-000075', title: 'DevOps с нуля', org: 'Институт технологий', status: 'Срок подходит', tone: 'warning', amount: 96000 }
	];
	let sort = $state<SortState | null>({ key: 'amount', dir: 'desc' });
	const rows = $derived(
		[...DEALS].sort((a, b) => {
			const k = (sort?.key ?? 'amount') as 'title' | 'amount';
			const cmp = k === 'amount' ? a.amount - b.amount : a.title.localeCompare(b.title, 'ru');
			return sort?.dir === 'desc' ? -cmp : cmp;
		})
	);
	const columns: Col<Deal>[] = [
		{ key: 'title', title: 'Сделка', width: 'minmax(180px, 2fr)', sortable: true, render: titleCell },
		{ key: 'org', title: 'Организация', width: 'minmax(120px, 1.2fr)', drop: 2, render: orgCell },
		{ key: 'status', title: 'Статус', width: 190, render: statusCell },
		{ key: 'amount', title: 'Сумма', width: 130, align: 'right', sortable: true, render: amountCell }
	];

	// графики
	const KINDS_DATA = [
		{ name: 'Вузы', count: 38 },
		{ name: 'Колледжи', count: 17 },
		{ name: 'Физлица', count: 9 }
	];
	const MONTHS = [
		{ name: 'июн', won: 4, lost: 2 },
		{ name: 'июл', won: 6, lost: 3 },
		{ name: 'авг', won: 9, lost: 3 },
		{ name: 'сен', won: 12, lost: 4 }
	];
	const SERIES = [
		{ key: 'won', label: 'Выиграно', y: 'won' as const },
		{ key: 'lost', label: 'Потеряно', y: 'lost' as const }
	];

	// токены
	const SWATCHES = [
		{ name: 'accent', cls: 'bg-accent' },
		{ name: 'info', cls: 'bg-info' },
		{ name: 'success', cls: 'bg-success' },
		{ name: 'warning', cls: 'bg-warning' },
		{ name: 'danger', cls: 'bg-danger' },
		{ name: 'surface', cls: 'bg-surface' },
		{ name: 'surface-2', cls: 'bg-surface-2' },
		{ name: 'surface-3', cls: 'bg-surface-3' },
		{ name: 'fg', cls: 'bg-fg' },
		{ name: 'muted', cls: 'bg-muted' }
	];
	const TYPE_SCALE = [
		{ token: 't-h2', cls: 't-h2', text: 'Воронка продаж' },
		{ token: 't-h3', cls: 't-h3', text: 'Карточка сделки' },
		{ token: 't-h4', cls: 't-h4', text: 'Требуют внимания' },
		{ token: 't-body-m', cls: 't-body-m', text: 'Основной текст интерфейса — таблицы, поля, списки' },
		{ token: 't-body-s', cls: 't-body-s', text: 'Вторичный текст и подписи к данным' },
		{ token: 't-desc-l', cls: 't-desc-l', text: 'Подсказки и метаданные' }
	];
</script>

{#snippet titleCell(row: Deal)}<TableCell><span class="truncate font-medium">{row.title}</span></TableCell>{/snippet}
{#snippet orgCell(row: Deal)}<TableCell><span class="truncate text-muted">{row.org}</span></TableCell>{/snippet}
{#snippet statusCell(row: Deal)}<TableCell><StatusChip label={row.status} tone={row.tone} /></TableCell>{/snippet}
{#snippet amountCell(row: Deal)}<TableCell align="right"><Money value={row.amount} /></TableCell>{/snippet}
{#snippet dealCard(row: Deal)}
	<div class="flex min-w-0 flex-col gap-1">
		<div class="flex items-center justify-between gap-2">
			<span class="t-body-m-strong break-words">{row.title}</span>
			<StatusChip label={row.status} tone={row.tone} />
		</div>
		<span class="t-desc-l text-muted">{row.org}</span>
		<Money value={row.amount} />
	</div>
{/snippet}

<!-- образец: заголовок, справа — какие компоненты rt-ui в нём работают -->
{#snippet specimen(title: string, parts: string, body: Snippet)}
	<section class="flex min-w-0 flex-col gap-3 rounded-lg border border-line p-4 max-md:p-3">
		<header class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
			<h3 class="t-body-m-strong">{title}</h3>
			<span class="t-desc-l text-muted">{parts}</span>
		</header>
		{@render body()}
	</section>
{/snippet}

{#snippet themes()}
	<ThemePicker />
	<p class="t-desc-l text-muted">Тема переключается на весь интерфейс сразу: это один CSS-класс на странице, все токены меняются вместе — как и в четырёх наших темах.</p>
{/snippet}

{#snippet buttons()}
	<div class="flex flex-wrap items-center gap-3">
		<Btn label="Основная" />
		<Btn label="Вторичная" variant="secondary" />
		<Btn label="Контур" variant="outline" />
		<Btn label="Тихая" variant="ghost" />
		<Btn label="Удалить" danger />
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<Btn label="S" size="s" />
		<Btn label="M" size="m" />
		<Btn label="L" size="l" />
		<Btn label="С иконкой" icon={AddSmall} variant="secondary" />
		<Btn label="Загрузка" loading variant="secondary" />
		<Btn label="Недоступна" disabled variant="secondary" />
		<IconBtn icon={Settings} label="Настройки" />
		<IconBtn icon={Download} label="Скачать" variant="secondary" />
	</div>
{/snippet}

{#snippet fields()}
	<div class="grid grid-cols-2 items-start gap-x-3 gap-y-4 max-md:grid-cols-1">
		<TextField label="Название сделки" bind:value={name} hint="Подсказка живёт под полем" />
		<TextField label="E-mail" bind:value={email} error={email.includes('@') && email.split('@')[1] ? undefined : 'Введите корректный e-mail'} />
		<NumberField label="Сумма, ₽" bind:value={amount} />
		<DateField label="Плановая дата закрытия" bind:value={when} />
		<Pick label="Статус" items={STATUSES} bind:value={status} placeholder="Не выбран" clearable />
		<Pick label="Организация" items={ORGS} bind:value={org} search />
	</div>
	<div class="grid grid-cols-2 items-start gap-x-3 gap-y-3 max-md:grid-cols-1">
		<div class="flex flex-col gap-3">
			<Toggle label="Уведомлять руководителя" bind:checked={notify} />
			<CheckField label="Согласен на обработку данных" bind:checked={agree} />
		</div>
		<RadioField label="Тип клиента" items={KINDS} bind:value={kind} />
	</div>
{/snippet}

{#snippet badges()}
	<div class="flex flex-wrap items-center gap-2">
		<StatusChip label="Идентификация вуза" tone="neutral" />
		<StatusChip label="Квалификация" tone="info" />
		<StatusChip label="Выиграна" tone="success" />
		<StatusChip label="Срок подходит" tone="warning" />
		<StatusChip label="Просрочено" tone="error" />
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<Chip size="s" variant="secondary" selected={chipOn === 'open'} label="Открытые" onclick={() => (chipOn = 'open')} />
		<Chip size="s" variant="secondary" selected={chipOn === 'late'} label="Просроченные" onclick={() => (chipOn = 'late')} />
		<Chip size="s" variant="secondary" selected={chipOn === 'done'} label="Выполненные" onclick={() => (chipOn = 'done')} />
		<Counter size="s" colorScheme="accent">12</Counter>
		<Counter size="s" colorScheme="neutral">99+</Counter>
		<Loader size="s" variant="primary" />
	</div>
{/snippet}

{#snippet messages()}
	<div class="flex flex-col gap-2">
		<Notice tone="info" title="Подсказка">Так выглядит информационное сообщение внутри страницы.</Notice>
		<Notice tone="warning" title="Срок подходит">До конца этапа остался один рабочий день.</Notice>
		<Notice tone="error" title="Не удалось сохранить">Проверьте связь и повторите попытку.</Notice>
	</div>
	<div class="flex flex-wrap items-center gap-3">
		<Btn label="Тост: успех" size="s" variant="secondary" colorScheme="neutral" onclick={() => toast.success('Сделка создана', 'D-2026-000082')} />
		<Btn label="Тост: подсказка" size="s" variant="secondary" colorScheme="neutral" onclick={() => toast.info('Это тост', 'Он исчезает сам через пять секунд')} />
		<Btn label="Тост: внимание" size="s" variant="secondary" colorScheme="neutral" onclick={() => toast.warning('Срок подходит', 'Осталось меньше четверти времени')} />
	</div>
{/snippet}

{#snippet table()}
	<DataTable id="help-ds-table" {rows} {columns} card={dealCard} {sort} onSort={(s) => (sort = s)} ariaLabel="Пример таблицы: сделки" />
	<p class="t-desc-l text-muted">На десктопе заголовки «Сделка» и «Сумма» сортируют; на телефоне та же таблица превращается в карточки.</p>
{/snippet}

{#snippet charts()}
	<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-4 max-md:grid-cols-1">
		<div class="flex justify-center"><DonutChart data={KINDS_DATA} name="name" value="count" size={150} label="Сделки по типам клиентов" /></div>
		<BarChart data={MONTHS} x="name" series={SERIES} height={170} label="Сделки по месяцам" />
	</div>
	<LineChart data={MONTHS} x="name" series={SERIES} smooth height={150} label="Динамика по месяцам" />
	<p class="t-desc-l text-muted">Цвета графиков берутся из токенов темы: смените тему выше — диаграммы перекрасятся вместе с интерфейсом.</p>
{/snippet}

{#snippet tokens()}
	<div class="grid grid-cols-5 gap-2 max-md:grid-cols-3">
		{#each SWATCHES as swatch (swatch.name)}
			<div class="flex min-w-0 flex-col gap-1">
				<span class={['h-9 rounded-md border border-line', swatch.cls]}></span>
				<span class="t-desc-m truncate text-muted">{swatch.name}</span>
			</div>
		{/each}
	</div>
	<div class="flex flex-col gap-2">
		{#each TYPE_SCALE as row (row.token)}
			<div class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
				<span class={['min-w-0 break-words', row.cls]}>{row.text}</span>
				<code class="t-desc-m flex-none text-muted">{row.token}</code>
			</div>
		{/each}
	</div>
{/snippet}

<div class="flex min-w-0 flex-col gap-4">
	{@render specimen('Темы', 'SegmentedControl · Segment', themes)}
	{@render specimen('Кнопки', 'Button · IconButton · Loader', buttons)}
	{@render specimen('Поля', 'Input · Select · InputDate · Switch · Checkbox · RadioGroup', fields)}
	{@render specimen('Метки и счётчики', 'Badge · Chip · Counter · Loader', badges)}
	{@render specimen('Сообщения', 'InlineNotification · ToastNotification', messages)}
	{@render specimen('Таблица', 'TableGrid · TableCards', table)}
	{@render specimen('Графики', 'BarChart · LineChart · DonutChart', charts)}
	{@render specimen('Токены', 'цвета и шкала шрифтов темы', tokens)}
</div>
