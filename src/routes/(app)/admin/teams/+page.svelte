<script lang="ts">
	// Команды: дерево (родитель → дочерние), руководитель, регион. От дерева зависит область видимости руководителя.
	// Правка — по актуальной карточке (`GET /admin/teams/{id}`, не по строке из уже загрученного списка) и с `If-Match`: конфликт (409, CRM-1002)
	// обрабатывается так же, как в ProductDrawer.svelte и редакторах справочников (catalog/*Drawer.svelte) — перечитать, оставить введённое.
	import { onMount, untrack } from 'svelte';
	import { api, ifMatch, unwrap, type components } from '$lib/api';
	import { teams } from '$lib/features/identity/teams.svelte';
	import { toFormFailure } from '$lib/features/config/shared/form-errors';
	import { Btn, DataTable, DateText, EmptyState, ErrorState, FilterBar, FormDrawer, Page, PageHeader, Pick, Skeleton, TableCell, TextField, UserName, UserPicker, toast, type Col } from '$lib/ui';
	import { people } from '$lib/api/people.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { readQuery, setQuery } from '$lib/utils/query-state.svelte';

	type Team = components['schemas']['TeamOut'];
	type Row = Team & { depth: number };

	let regions = $state<{ key: string; value: string }[]>([]);
	onMount(async () => {
		void teams.load();
		try {
			const data = (await unwrap(api.GET('/api/regions'))) as { items?: { id: string; name: string }[] };
			regions = (data.items ?? []).map((r) => ({ key: r.id, value: r.name }));
		} catch {
			regions = [];
		}
	});

	const q = $derived(readQuery('q').trim());
	$effect(() => people.ensure(teams.items.map((t) => t.head_id)));

	/** flat list in tree order: roots by name, children under their parent */
	const tree = $derived.by<Row[]>(() => {
		const byParent = new Map<string | null, Team[]>();
		for (const t of teams.items) byParent.set(t.parent_id ?? null, [...(byParent.get(t.parent_id ?? null) ?? []), t]);
		const out: Row[] = [];
		const seen = new Set<string>();
		const walk = (parent: string | null, depth: number) => {
			for (const t of (byParent.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name, 'ru'))) {
				if (seen.has(t.id)) continue;
				seen.add(t.id);
				out.push({ ...t, depth });
				walk(t.id, depth + 1);
			}
		};
		walk(null, 0);
		for (const t of teams.items) if (!seen.has(t.id)) out.push({ ...t, depth: 0 });
		return out;
	});
	const regionName = (id: string | null | undefined) => regions.find((r) => r.key === id)?.value ?? '—';

	/** the search looks at the name, the head and the region; the parents of a match stay, so the tree still reads */
	const rows = $derived.by<Row[]>(() => {
		if (!q) return tree;
		const needle = q.toLowerCase();
		const byId = new Map(tree.map((r) => [r.id, r]));
		const keep = new Set<string>();
		for (const r of tree) {
			if (![r.name, regionName(r.region_id), people.name(r.head_id, '')].some((text) => text.toLowerCase().includes(needle))) continue;
			for (let cur: Row | undefined = r; cur && !keep.has(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined) keep.add(cur.id);
		}
		return tree.filter((r) => keep.has(r.id));
	});

	// drawer
	let open = $state(false);
	let editing = $state<Team | null>(null);
	let name = $state('');
	let parentId = $state<string | null>(null);
	let headId = $state<string | null>(null);
	let regionId = $state<string | null>(null);
	let version = $state(0);
	let saving = $state(false);
	let fieldErrors = $state<Record<string, string>>({});
	let failure = $state<string | null>(null);
	let conflict = $state(false);
	/** обновляем версию/время правки в фоне сразу после открытия — тише, чем крутить скелетон в панели, которая уже показывает данные из списка */
	let refreshing = $state(false);

	function show(team: Team | null) {
		untrack(() => {
			editing = team;
			name = team?.name ?? '';
			parentId = team?.parent_id ?? null;
			headId = team?.head_id ?? null;
			regionId = team?.region_id ?? null;
			version = team?.version ?? 0;
			fieldErrors = {};
			failure = null;
			conflict = false;
			open = true;
		});
		if (team) void refreshTeam(team.id);
	}

	/** Актуальная карточка по id — и сразу при открытии панели (строка в списке могла устареть), и после конфликта версий. */
	async function refreshTeam(id: string): Promise<Team | null> {
		refreshing = true;
		try {
			const fresh = await unwrap(api.GET('/api/admin/teams/{team_id}', { params: { path: { team_id: id } } }));
			teams.put(fresh);
			if (editing?.id === id) {
				editing = fresh;
				version = fresh.version;
			}
			return fresh;
		} catch {
			return null; // список уже показывал те же данные; сохранение и конфликт версий всё равно проверяются на сервере
		} finally {
			refreshing = false;
		}
	}

	/** После конфликта версий (409, CRM-1002): берём актуальную версию, введённое остаётся в форме — тот же приём, что в ProductDrawer.svelte. */
	async function reloadVersion() {
		if (!editing) return;
		const fresh = await refreshTeam(editing.id);
		if (fresh) {
			conflict = false;
			toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз');
		} else {
			toast.error('Не удалось загрузить актуальную версию');
		}
	}

	/** a team cannot become a child of itself or of its own descendants */
	const parentOptions = $derived.by(() => {
		const banned = new Set<string>();
		if (editing) {
			banned.add(editing.id);
			for (let grew = true; grew; ) {
				grew = false;
				for (const t of teams.items) {
					if (t.parent_id && banned.has(t.parent_id) && !banned.has(t.id)) {
						banned.add(t.id);
						grew = true;
					}
				}
			}
		}
		return teams.options.filter((o) => !banned.has(String(o.key)));
	});

	async function save() {
		if (!name.trim()) return void (fieldErrors = { name: 'Укажите название' });
		saving = true;
		fieldErrors = {};
		failure = null;
		conflict = false;
		const body = { name: name.trim(), parent_id: parentId, head_id: headId, region_id: regionId };
		try {
			const team = editing
				? await unwrap(api.PATCH('/api/admin/teams/{team_id}', { params: { path: { team_id: editing.id } }, body, headers: ifMatch(version) }))
				: await unwrap(api.POST('/api/admin/teams', { body }));
			teams.put(team);
			toast.success(editing ? 'Команда сохранена' : 'Команда создана');
			open = false;
		} catch (e) {
			const result = toFormFailure(e, ['name', 'head_id', 'parent_id', 'region_id']);
			fieldErrors = result.fields;
			failure = result.form;
			conflict = result.conflict;
		} finally {
			saving = false;
		}
	}

	const columns: Col<Row>[] = [
		{ key: 'name', title: 'Команда', width: 'minmax(200px, 2fr)', render: nameCell },
		{ key: 'head_id', title: 'Руководитель', width: 'minmax(160px, 1fr)', render: headCell },
		{ key: 'region_id', title: 'Регион', width: 'minmax(120px, 1fr)', drop: 2, render: regionCell },
		{ key: 'created_at', title: 'Создана', drop: 1, render: dateCell }
	];
</script>

{#snippet nameCell(t: Row)}<TableCell><span class="block truncate py-2 t-body-s-strong" style:padding-left="{t.depth * 20}px">{t.depth ? '↳ ' : ''}{t.name}</span></TableCell>{/snippet}
{#snippet headCell(t: Row)}<TableCell><span class="block truncate py-2"><UserName id={t.head_id} /></span></TableCell>{/snippet}
{#snippet regionCell(t: Row)}<TableCell><span class="block truncate py-2 text-muted">{regionName(t.region_id)}</span></TableCell>{/snippet}
{#snippet dateCell(t: Row)}<TableCell><span class="block py-2"><DateText value={t.created_at} /></span></TableCell>{/snippet}
{#snippet card(t: Row)}
	<div class="flex min-w-0 flex-col gap-1" style:padding-left="{t.depth * 12}px">
		<span class="t-body-s-strong">{t.name}</span>
		<span class="t-desc-l text-muted">Руководитель: <UserName id={t.head_id} /></span>
	</div>
{/snippet}

<svelte:head><title>Команды · RTK School</title></svelte:head>

<Page>
	<PageHeader title="Команды" />
	<FilterBar search={q} placeholder="Название, руководитель или регион" onSearch={(v) => setQuery({ q: v || null })} primary={{ label: 'Новая команда', onclick: () => show(null), testid: 'team-create' }} />

	{#if teams.loading && !teams.loaded}
		<Skeleton kind="rows" rows={4} />
	{:else if teams.error}
		<ErrorState error={teams.error} onRetry={() => teams.load(true)} />
	{:else if teams.items.length === 0}
		<EmptyState title="Команд пока нет" hint="Команда определяет, чьи сделки видит руководитель.">
			{#snippet action()}<Btn label="Создать команду" variant="outline" colorScheme="neutral" onclick={() => show(null)} />{/snippet}
		</EmptyState>
	{:else if rows.length === 0}
		<EmptyState title="Ничего не найдено" compact />
	{:else}
		<DataTable {rows} {columns} {card} onRowClick={(t) => show(t)} ariaLabel="Команды" />
	{/if}
</Page>

<FormDrawer
	{open}
	title={editing ? 'Команда' : 'Новая команда'}
	saveTestId="team-save"
	{saving}
	dirty={open && (name.trim() !== (editing?.name ?? '') || parentId !== (editing?.parent_id ?? null) || headId !== (editing?.head_id ?? null) || regionId !== (editing?.region_id ?? null))}
	formError={failure && !Object.keys(fieldErrors).length ? failure : null}
	{conflict}
	onReload={reloadVersion}
	onSave={save}
	onClose={() => (open = false)}
>
	<TextField label="Название" required autofocus value={name} error={fieldErrors.name} onInput={(v) => (name = v)} />
	<Pick label="Родительская команда" placeholder="Нет" items={parentOptions} value={parentId} clearable onChange={(v) => (parentId = v)} />
	<UserPicker label="Руководитель" value={headId} roles={['HEAD', 'ADMIN']} error={fieldErrors.head_id} onChange={(id) => (headId = id)} />
	<Pick label="Регион" placeholder="Не задан" items={regions} value={regionId} clearable search onChange={(v) => (regionId = v)} />
	{#if editing}
		<p class="t-desc-l m-0 text-muted">Создана {formatDateTime(editing.created_at)} · изменена {formatDateTime(editing.updated_at)}{refreshing ? ' · обновляем…' : ''}</p>
	{/if}
</FormDrawer>
