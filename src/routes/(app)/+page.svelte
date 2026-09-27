<script lang="ts">
	// Home: what needs attention right now. Roles without a dashboard (auditor) are sent to their first section.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { session } from '$lib/auth/session.svelte';
	import { landingFor } from '$lib/nav';
	import { HomeData } from '$lib/features/home/home.svelte';
	import RecentList from '$lib/features/crm/recent/RecentList.svelte';
	import { formatDateTime, formatMoneyShort, formatNumber } from '$lib/utils/format';
	import Card from '$lib/ui/Card.svelte';
	import { slaHint } from '$lib/features/crm/shared/hints';
	import DateText from '$lib/ui/DateText.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import RowList from '$lib/ui/RowList.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Page from '$lib/ui/Page.svelte';
	import PageHeader from '$lib/ui/PageHeader.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import Tile from '$lib/ui/Tile.svelte';

	const data = new HomeData();
	const dashboard = $derived(session.canAny('deal:read', 'report:read'));

	onMount(() => {
		if (!session.canAny('deal:read', 'report:read')) {
			void goto(landingFor((p) => session.can(p)), { replaceState: true });
			return;
		}
		void data.load();
		return () => data.abort();
	});

	const more = $derived(data.partial ? '+' : '');
	// плитка объединяет «просрочено» и «скоро срок» (`data.attention`) в одно число, а быстрые вкладки списка — только по одной;
	// ведём на то, что ближе к её собственной подсказке «просрочено: N» (просроченные, если они есть, иначе скоро истекающие)
	const attentionHref = $derived(data.attention.some((d) => d.sla_state === 'breached') ? '/deals?quick=breached' : '/deals?quick=warning');
	const SLA = { breached: { tone: 'error', label: 'Просрочено' }, warning: { tone: 'warning', label: 'Скоро срок' } } as const;
	const PRIORITY_DOT: Record<string, string> = { critical: 'bg-danger', high: 'bg-warning', normal: 'bg-soft', low: 'bg-line-strong' };
	let funnelType = $state<string | null>(null);
	const activeType = $derived(funnelType ?? data.mainType);
	const funnel = $derived(data.funnel(activeType));
	const maxFunnel = $derived(Math.max(1, ...funnel.map((f) => f.count)));
</script>

<svelte:head><title>Главная · RTK School</title></svelte:head>

{#if dashboard}
	<Page>
		<PageHeader title="Главная">
			{#snippet actions()}<IconBtn icon={Refresh} label="Обновить" loading={data.loading} onclick={() => data.load()} />{/snippet}
		</PageHeader>

		{#if data.error}
			<ErrorState error={data.error} onRetry={() => data.load()} />
		{:else}
			{#if session.can('deal:read')}
				<div class="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-md:gap-2">
					<Tile label="В работе" value={`${formatNumber(data.active.length)}${more}`} href="/deals" loading={data.loading} />
					<Tile label="Сумма в работе" value={formatMoneyShort(data.activeAmount)} href="/deals" loading={data.loading} />
					<Tile
						label="SLA под угрозой"
						tip="Сделки, у которых срок пребывания в статусе (SLA) почти истёк или уже вышел."
						value={data.attention.length}
						tone={data.attention.length ? 'danger' : 'neutral'}
						hint={data.attention.length ? `просрочено: ${data.attention.filter((d) => d.sla_state === 'breached').length}` : undefined}
						href={attentionHref}
						loading={data.loading}
					/>
					<Tile
						label="Мои задачи"
						value={data.openTasks.length}
						tone={data.overdueTasks.length ? 'danger' : 'neutral'}
						hint={data.overdueTasks.length ? `просрочено: ${data.overdueTasks.length}` : undefined}
						href="/tasks"
						loading={data.loading}
					/>
				</div>
			{/if}

			<div class="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4 max-lg:grid-cols-1">
				<div class="flex min-w-0 flex-col gap-4">
					{#if session.can('deal:read')}
{#if data.loading}
	<Card title="Требуют внимания"><Skeleton kind="lines" rows={4} /></Card>
{:else if data.attention.length === 0}
	<Card title="Требуют внимания"><EmptyState title="Просроченных сделок нет" compact /></Card>
{:else}
	<RowList title="Требуют внимания" count={data.attention.length}>
		{#snippet action()}{#if data.attention.length > 6}<a class="t-body-s-strong text-accent" href={attentionHref}>Все</a>{/if}{/snippet}
		{#each data.attention.slice(0, 6) as deal (deal.id)}
			<ListRow title={deal.title} href="/deals/{deal.id}">
				{#snippet description()}
					<span>{deal.number}</span>
					{#if data.statuses[deal.status_id]}<span>{data.statuses[deal.status_id].name}</span>{/if}
				{/snippet}
				{#snippet suffix()}<StatusChip label={SLA[deal.sla_state as 'breached' | 'warning'].label} tone={SLA[deal.sla_state as 'breached' | 'warning'].tone} hint={slaHint(deal.sla_state, deal.sla_due_at ? formatDateTime(deal.sla_due_at) : null)} />{/snippet}
			</ListRow>
		{/each}
	</RowList>
{/if}

						<Card title="Воронка">
							{#snippet action()}
								<SegmentedControl size="s" value={activeType} onChange={(v: string) => (funnelType = v)}>
									<Segment index="b2b" label="Вузы" />
									<Segment index="b2c" label="Физлица" />
								</SegmentedControl>
							{/snippet}
							{#if data.loading}
								<Skeleton kind="lines" rows={5} />
							{:else if funnel.length === 0}
								<EmptyState title="Активных сделок нет" compact />
							{:else}
								<ul class="m-0 flex list-none flex-col gap-2 p-0">
									{#each funnel as row (row.status.id)}
										<li class="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-3 max-md:grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_1.5rem] max-md:gap-2">
											<span class="t-desc-l truncate text-muted" title={row.status.name}>{row.status.name}</span>
											<span class="h-2.5 overflow-hidden rounded-full bg-surface-3">
												<span class="block h-full rounded-full bg-accent" style:width="{(row.count / maxFunnel) * 100}%" style:background-color={row.status.color}></span>
											</span>
											<span class="t-body-s text-right tabular-nums">{row.count}</span>
										</li>
									{/each}
								</ul>
							{/if}
						</Card>
					{/if}
				</div>

				<div class="flex min-w-0 flex-col gap-4">
					{#if session.can('deal:read')}
{#if data.loading}
	<Card title="Мои задачи"><Skeleton kind="lines" rows={3} /></Card>
{:else if data.openTasks.length === 0}
	<Card title="Мои задачи"><EmptyState title="Открытых задач нет" compact /></Card>
{:else}
	<RowList title="Мои задачи" count={data.openTasks.length}>
		{#snippet action()}<a class="t-body-s -m-3 p-3" href="/tasks">Все</a>{/snippet}
		{#each data.openTasks.slice(0, 6) as task (task.id)}
			<ListRow title={task.title} href="/deals/{task.deal_id}">
				{#snippet description()}
					{#if task.due_at}<span class={new Date(task.due_at).getTime() < Date.now() ? 'text-danger' : ''}><DateText value={task.due_at} /></span>{/if}
				{/snippet}
				{#snippet suffix()}<span class={['size-2 rounded-full', PRIORITY_DOT[task.priority] ?? 'bg-soft']} title="Приоритет" aria-hidden="true"></span>{/snippet}
			</ListRow>
		{/each}
	</RowList>
{/if}
					{/if}

					{#if session.can('signature:sign') && (data.loading || data.pendingSignatures.length > 0)}
						{#if data.loading}
							<Card title="На подпись"><Skeleton kind="lines" rows={2} /></Card>
						{:else}
							<RowList title="На подпись" count={data.pendingSignatures.length}>
								{#snippet action()}<a class="t-body-s -m-3 p-3" href="/signing">Все</a>{/snippet}
								{#each data.pendingSignatures.slice(0, 4) as sign (sign.id)}
									<ListRow title={sign.document_title ?? 'Документ на подпись'} href="/signing">
										{#snippet description()}<span><DateText value={sign.sent_at ?? sign.created_at} relative /></span>{/snippet}
									</ListRow>
								{/each}
							</RowList>
						{/if}
					{/if}

					<Card title="Недавние"><RecentList /></Card>
				</div>
			</div>
		{/if}
	</Page>
{/if}
