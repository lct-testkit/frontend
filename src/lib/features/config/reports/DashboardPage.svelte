<script lang="ts">
	// Дашборд: сетка виджетов (12 колонок на десктопе, 6 на планшете, одна на телефоне). Данные — по кнопке «Обновить данные».
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { DropdownMenu } from '@lct-testkit/rt-ui';
	import { AddLarge, Edit, MenuKebab, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, EmptyState, ErrorState, IconBtn, Page, PageHeader, Skeleton, StatusChip, confirm, toast } from '$lib/ui';
	import { formatTime } from '$lib/utils/format';
	import type { Dashboard, DashboardWidget, ReportTemplate } from '../types';
	import { createResource } from '../shared/resource.svelte';
	import DashboardDrawer from './DashboardDrawer.svelte';
	import { DashboardData } from './dashboard-data.svelte';
	import type { WorkflowOption } from './ParamsForm.svelte';
	import { normalizePosition } from './params';
	import WidgetCard from './WidgetCard.svelte';
	import WidgetDrawer from './WidgetDrawer.svelte';
	import { readConfig, type WidgetConfig } from './widgets';

	let { id }: { id: string } = $props();

	// svelte-ignore state_referenced_locally
	const data = new DashboardData(id);
	const dashboard = createResource<Dashboard>((signal) => unwrap(api.GET('/api/dashboards/{dashboard_id}', { params: { path: { dashboard_id: id } }, signal })));
	const widgetsRes = createResource<DashboardWidget[]>((signal) => unwrap(api.GET('/api/dashboards/{dashboard_id}/widgets', { params: { path: { dashboard_id: id } }, signal })).then((r) => r.items));
	const templatesRes = createResource<ReportTemplate[]>((signal) => unwrap(api.GET('/api/report-templates', { signal })).then((r) => r.items));
	let workflows = $state<WorkflowOption[]>([]);

	onMount(async () => {
		void templatesRes.reload();
		unwrap(api.GET('/api/workflows', { params: { query: { state: 'published', limit: 100 } } })).then((r) => (workflows = r.items.map((w) => ({ id: w.id, name: w.name, deal_type: w.deal_type })))).catch(() => {});
		await Promise.all([dashboard.reload(), widgetsRes.reload()]);
		data.hydrate(configs);
	});
	onDestroy(() => data.dispose());

	const d = $derived(dashboard.data);
	const canEdit = $derived(Boolean(d && (d.owner_id === session.me?.id || session.isRole('ADMIN'))));
	const widgets = $derived(
		[...(widgetsRes.data ?? [])].sort((a, b) => normalizePosition(a.position).y - normalizePosition(b.position).y || a.created_at.localeCompare(b.created_at))
	);
	const configs = $derived(widgets.map((w) => readConfig(w.config)).filter((c): c is WidgetConfig => c !== null));
	const templateName = (code: string) => templatesRes.data?.find((t) => t.code === code)?.name ?? code;
	const oldest = $derived(data.oldest(configs));

	let editing = $state(false);
	let widgetOpen = $state(false);
	let editingWidget = $state<DashboardWidget | null>(null);
	let dashboardOpen = $state(false);
	let menuOpen = $state(false);

	const SPAN: Record<number, string> = { 4: 'md:col-span-3 lg:col-span-4', 6: 'md:col-span-6 lg:col-span-6', 12: 'md:col-span-6 lg:col-span-12' };
	const spanOf = (w: DashboardWidget) => {
		const width = normalizePosition(w.position).w;
		return SPAN[width <= 4 ? 4 : width <= 6 ? 6 : 12];
	};

	function openWidget(w: DashboardWidget | null) {
		editingWidget = w;
		widgetOpen = true;
	}

	async function reloadWidgets() {
		await widgetsRes.reload();
		data.hydrate(configs);
	}

	async function removeWidget(w: DashboardWidget) {
		const name = readConfig(w.config)?.title || templateName(readConfig(w.config)?.template_code ?? '');
		if (!(await confirm({ title: `Удалить виджет «${name}»?`, confirmLabel: 'Удалить', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/dashboards/{dashboard_id}/widgets/{widget_id}', { params: { path: { dashboard_id: id, widget_id: w.id } } }));
			await reloadWidgets();
		} catch (e) {
			toast.error(e);
		}
	}

	async function move(index: number, dir: -1 | 1) {
		const a = widgets[index];
		const b = widgets[index + dir];
		if (!a || !b) return;
		const pa = normalizePosition(a.position);
		const pb = normalizePosition(b.position);
		const [ya, yb] = pa.y === pb.y ? [index + dir, index] : [pb.y, pa.y];
		try {
			await Promise.all([
				unwrap(api.PATCH('/api/dashboards/{dashboard_id}/widgets/{widget_id}', { params: { path: { dashboard_id: id, widget_id: a.id } }, body: { position: { ...pa, y: ya } } })),
				unwrap(api.PATCH('/api/dashboards/{dashboard_id}/widgets/{widget_id}', { params: { path: { dashboard_id: id, widget_id: b.id } }, body: { position: { ...pb, y: yb } } }))
			]);
			await reloadWidgets();
		} catch (e) {
			toast.error(e);
		}
	}

	async function removeDashboard() {
		if (!d || !(await confirm({ title: `Удалить дашборд «${d.name}»?`, message: 'Виджеты будут удалены вместе с ним.', confirmLabel: 'Удалить', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/dashboards/{dashboard_id}', { params: { path: { dashboard_id: id } } }));
			toast.success('Дашборд удалён');
			void goto('/reports/dashboards');
		} catch (e) {
			toast.error(e);
		}
	}

	const menuItems = $derived([
		{ key: 'edit', value: 'Название и доступ' },
		{ key: 'delete', value: 'Удалить дашборд' }
	]);
</script>

<Page wide>
	<PageHeader title={d?.name ?? 'Дашборд'} back="/reports/dashboards">
		{#snippet meta()}{#if d?.is_shared}<StatusChip label="Общий" tone="info" />{/if}{/snippet}
		{#snippet actions()}
			{#if canEdit && editing}<Btn label="Виджет" icon={AddLarge} onclick={() => openWidget(null)} />{/if}
			<Btn label="Обновить данные" icon={Refresh} variant={editing ? 'outline' : 'primary'} colorScheme={editing ? 'neutral' : 'accent'} loading={data.refreshing} disabled={configs.length === 0} onclick={() => data.refresh(configs)} />
			{#if canEdit}
				<IconBtn icon={Edit} label={editing ? 'Готово' : 'Изменить дашборд'} variant={editing ? 'secondary' : 'ghost'} aria-pressed={editing} onclick={() => (editing = !editing)} />
				<DropdownMenu
					class="inline-flex w-auto"
					items={menuItems}
					isOpened={menuOpen}
					placement="bottomRight"
					onClose={() => (menuOpen = false)}
					onClickItem={(item: { key: string | number }) => {
						menuOpen = false;
						if (item.key === 'edit') dashboardOpen = true;
						else void removeDashboard();
					}}
				>
					<IconBtn icon={MenuKebab} label="Ещё" onclick={() => (menuOpen = !menuOpen)} />
				</DropdownMenu>
			{/if}
		{/snippet}
	</PageHeader>

	{#if dashboard.error}
		<ErrorState error={dashboard.error} onRetry={() => dashboard.reload()} />
	{:else if dashboard.loading || widgetsRes.loading}
		<div class="grid grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
			{#each [0, 1, 2] as i (i)}<div class="md:col-span-3 lg:col-span-4"><Skeleton kind="tile" rows={1} height={220} /></div>{/each}
		</div>
	{:else if widgets.length === 0}
		<EmptyState title="На дашборде пока нет виджетов">
			{#snippet action()}{#if canEdit}<Btn label="Добавить виджет" icon={AddLarge} onclick={() => openWidget(null)} />{/if}{/snippet}
		</EmptyState>
	{:else}
		<div class="grid grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
			{#each widgets as w, i (w.id)}
				<div class={['min-w-0', spanOf(w)]}>
					<WidgetCard
						widget={w}
						{data}
						{templateName}
						{editing}
						first={i === 0}
						last={i === widgets.length - 1}
						onMove={(dir) => move(i, dir)}
						onEdit={() => openWidget(w)}
						onDelete={() => removeWidget(w)}
					/>
				</div>
			{/each}
		</div>
		<p class="t-desc-l text-soft">{oldest ? `Данные на ${formatTime(oldest)}. ` : ''}Каждое обновление запускает отчёты заново.</p>
	{/if}
</Page>

<WidgetDrawer
	open={widgetOpen}
	dashboardId={id}
	widget={editingWidget}
	templates={templatesRes.data ?? []}
	{workflows}
	nextIndex={widgets.length}
	onClose={() => (widgetOpen = false)}
	onSaved={reloadWidgets}
/>
<DashboardDrawer open={dashboardOpen} item={d} onClose={() => (dashboardOpen = false)} onSaved={(saved) => dashboard.set(saved)} />
