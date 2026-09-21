<script lang="ts">
	// Список пользователей: поиск и фильтры в URL, курсорная подгрузка, строки ведут в карточку.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import Avatar from '$lib/ui/Avatar.svelte';
	import DateText from '$lib/ui/DateText.svelte';
	import type { Primary } from '$lib/ui/PrimaryAction.svelte';
	import DataTable, { type Col } from '$lib/ui/DataTable.svelte';
	import TableCell from '$lib/ui/TableCell.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';
	import { roleLabel, userStatusMeta } from '../labels';
	import { teams } from '../teams.svelte';
	import type { UserOut } from '../types';
	import UsersFilters from './UsersFilters.svelte';

	/** THE create-action of the page: it stands at the end of the filter row */
	let { primary }: { primary?: Primary } = $props();

	const values = $derived({ q: readQuery('q'), role: readQuery('role'), status: readQuery('status'), team_id: readQuery('team_id') });
	const key = $derived(JSON.stringify(values));

	const pager = createPager<UserOut>((cursor, signal) =>
		unwrap(
			api.GET('/api/admin/users', {
				params: { query: { q: values.q || undefined, role: values.role || undefined, status: values.status || undefined, team_id: values.team_id || undefined, limit: 50, cursor } },
				signal
			})
		)
	);

	onMount(() => void teams.load());
	$effect(() => {
		void key;
		void pager.reload();
	});

	export function reload() {
		void pager.reload();
	}

	const open = (u: UserOut) => goto(`/admin/users/${u.id}`);

	const columns: Col<UserOut>[] = [
		{ key: 'name', title: 'Сотрудник', width: 'minmax(240px, 3fr)', render: person },
		{ key: 'role', title: 'Роль', width: 'minmax(140px, 1.2fr)', drop: 3, render: role },
		{ key: 'team', title: 'Команда', width: 'minmax(140px, 1.2fr)', drop: 2, render: team },
		{ key: 'status', title: 'Статус', render: status },
		{ key: 'last', title: 'Вход', drop: 1, render: last }
	];
</script>

{#snippet person(u: UserOut)}
	<TableCell>
		<span class="flex min-w-0 items-center gap-3 py-1.5">
			<Avatar name={u.full_name} size={32} />
			<span class="flex min-w-0 flex-col">
				<span class="t-body-m-strong block truncate">{u.display_name || u.full_name}</span>
				<span class="t-desc-l block truncate text-muted">{u.email ?? '—'}</span>
			</span>
		</span>
	</TableCell>
{/snippet}
{#snippet role(u: UserOut)}<TableCell><span class="truncate">{roleLabel(u.role)}</span></TableCell>{/snippet}
{#snippet team(u: UserOut)}<TableCell><span class="truncate">{teams.name(u.team_id)}</span></TableCell>{/snippet}
{#snippet status(u: UserOut)}
	<TableCell>
		{@const meta = userStatusMeta(u.status)}
		<StatusChip label={meta.label} tone={meta.tone} />
	</TableCell>
{/snippet}
{#snippet last(u: UserOut)}<TableCell><DateText value={u.last_login_at} relative /></TableCell>{/snippet}
{#snippet card(u: UserOut)}
	{@const meta = userStatusMeta(u.status)}
	<div class="flex items-center gap-3 p-1">
		<Avatar name={u.full_name} size={40} />
		<div class="flex min-w-0 flex-1 flex-col">
			<span class="t-body-m-strong break-words">{u.display_name || u.full_name}</span>
			<span class="t-desc-l truncate text-muted">{u.email ?? '—'}</span>
			<span class="t-desc-l text-muted">{[roleLabel(u.role), u.team_id ? teams.name(u.team_id) : null].filter(Boolean).join(' · ')}</span>
		</div>
		<StatusChip label={meta.label} tone={meta.tone} />
	</div>
{/snippet}

<UsersFilters {values} {primary} onChange={(patch) => void setQuery(patch)} />
<DataTable
	id="admin-users"
	rows={pager.items}
	{columns}
	{card}
	loading={pager.loading}
	error={pager.error}
	onRetry={() => pager.reload()}
	onRowClick={open}
	hasMore={pager.hasMore}
	loadingMore={pager.loadingMore}
	onLoadMore={() => pager.loadMore()}
	emptyText="Никого не нашли"
	ariaLabel="Пользователи"
/>
