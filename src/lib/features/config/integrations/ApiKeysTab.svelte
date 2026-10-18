<script lang="ts">
	// API-ключи для внешних систем: список (таблица, на телефоне карточки), выпуск (ключ виден один раз) и отзыв. Создание — кнопка страницы (`create()`).
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { Btn, DataTable, DateText, EmptyState, Notice, StatusChip, TableCell, confirm, toast, type Col } from '$lib/ui';
	import { createResource } from '../shared/resource.svelte';
	import type { ApiKey } from '../types';
	import ApiKeyDrawer from './ApiKeyDrawer.svelte';
	import SecretModal from './SecretModal.svelte';
	import { API_KEY_STATES, INTEGRATION_CAPABILITIES, apiKeyCurl, apiKeyState } from './apiKeys';

	const list = createResource((signal) => unwrap(api.GET('/api/admin/integrations/api-keys', { signal })).then((r) => r as ApiKey[]));
	// служебные учётки роли «Интеграция» не входят в справочник сотрудников (UserName их не знает) — берём их списком
	const accounts = createResource((signal) =>
		unwrap(api.GET('/api/admin/users', { params: { query: { role: 'INTEGRATION', limit: 100 } }, signal })).then((r) => r.items.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email ?? '', status: u.status })))
	);
	onMount(() => {
		void list.reload();
		void accounts.reload();
	});
	const accountName = (id: string) => accounts.data?.find((a) => a.id === id)?.full_name ?? '—';

	let open = $state(false);
	let issued = $state<string | null>(null);
	let busy = $state<string | null>(null);

	export function create() {
		open = true;
	}

	async function revoke(k: ApiKey) {
		if (busy) return;
		if (!(await confirm({ title: `Отозвать ключ «${k.name}»?`, message: 'Система, которая им пользуется, сразу перестанет проходить проверку. Вернуть ключ нельзя: понадобится выпустить новый.', confirmLabel: 'Отозвать', danger: true }))) return;
		busy = k.id;
		try {
			const saved = await unwrap(api.DELETE('/api/admin/integrations/api-keys/{api_key_id}', { params: { path: { api_key_id: k.id } } }));
			list.set((list.data ?? []).map((x) => (x.id === saved.id ? saved : x)));
			toast.success('Ключ отозван');
		} catch (e) {
			toast.error(e);
		} finally {
			busy = null;
		}
	}

	const stateOf = (k: ApiKey) => API_KEY_STATES[apiKeyState(k)];
	const columns: Col<ApiKey>[] = [
		{ key: 'name', title: 'Название', width: 'minmax(220px, 1.4fr)', render: nameCell },
		{ key: 'user', title: 'Учётка', width: 'minmax(220px, 1fr)', drop: 3, render: userCell },
		{ key: 'prefix', title: 'Начало ключа', drop: 2, render: prefixCell },
		{ key: 'used', title: 'Использован', drop: 1, render: usedCell },
		{ key: 'expires', title: 'Действует до', render: expiresCell },
		{ key: 'state', title: 'Состояние', render: stateCell },
		{ key: 'act', title: '', width: 132, align: 'right', render: actionCell }
	];
</script>

{#snippet nameCell(k: ApiKey)}<TableCell><span class="t-body-m-strong wrap-anywhere">{k.name}</span></TableCell>{/snippet}
{#snippet userCell(k: ApiKey)}<TableCell><span class="t-body-s text-muted wrap-anywhere">{accountName(k.user_id)}</span></TableCell>{/snippet}
{#snippet prefixCell(k: ApiKey)}<TableCell><span class="t-body-s font-mono text-muted">{k.key_prefix}…</span></TableCell>{/snippet}
{#snippet usedCell(k: ApiKey)}<TableCell>{#if k.last_used_at}<span class="t-body-s"><DateText value={k.last_used_at} time /></span>{:else}<span class="t-body-s text-soft">не использовался</span>{/if}</TableCell>{/snippet}
{#snippet expiresCell(k: ApiKey)}<TableCell><span class="t-body-s"><DateText value={k.expires_at} /></span></TableCell>{/snippet}
{#snippet stateCell(k: ApiKey)}<TableCell><StatusChip label={stateOf(k).label} tone={stateOf(k).tone} hint={stateOf(k).hint} /></TableCell>{/snippet}
{#snippet revokeBtn(k: ApiKey)}
	{#if apiKeyState(k) === 'active'}<Btn label="Отозвать" aria-label="Отозвать ключ «{k.name}»" variant="ghost" colorScheme="neutral" danger size="auto" disabled={busy !== null} onclick={() => revoke(k)} />{/if}
{/snippet}
{#snippet actionCell(k: ApiKey)}<TableCell align="right">{@render revokeBtn(k)}</TableCell>{/snippet}
{#snippet card(k: ApiKey)}
	<div class="flex min-w-0 flex-col gap-1.5">
		<div class="flex items-start justify-between gap-2"><span class="t-body-m-strong min-w-0 wrap-anywhere">{k.name}</span><StatusChip label={stateOf(k).label} tone={stateOf(k).tone} hint={stateOf(k).hint} /></div>
		<span class="t-desc-l flex flex-wrap gap-x-1 text-muted"><span class="font-mono">{k.key_prefix}…</span><span aria-hidden="true">·</span><span>{accountName(k.user_id)}</span></span>
		<span class="t-desc-l flex flex-wrap gap-x-1 text-muted">
			<span>До <DateText value={k.expires_at} /></span><span aria-hidden="true">·</span>
			{#if k.last_used_at}<span>использован <DateText value={k.last_used_at} time /></span>{:else}<span>не использовался</span>{/if}
		</span>
		{#if apiKeyState(k) === 'active'}<div class="flex justify-end">{@render revokeBtn(k)}</div>{/if}
	</div>
{/snippet}

<Notice class="shrink-0" tone="info">
	Ключ заменяет токен Keycloak для внешней системы: она передаёт его в заголовке <span class="font-mono">X-API-Key</span> и действует с правами роли «Интеграция» ({INTEGRATION_CAPABILITIES.join(', ')}). Сам ключ показывается один раз при выпуске, потом виден только его начало.
</Notice>
<DataTable rows={list.data ?? []} {columns} {card} loading={list.loading} error={list.error} onRetry={() => list.reload()} ariaLabel="API-ключи">
	{#snippet empty()}<EmptyState title="Ключей нет" hint="Выпустите первый, чтобы внешняя система могла вызывать API без входа через Keycloak" />{/snippet}
</DataTable>

<ApiKeyDrawer
	{open}
	accounts={(accounts.data ?? []).filter((a) => a.status === 'active')}
	accountsLoading={accounts.loading}
	accountsError={Boolean(accounts.error)}
	onReloadAccounts={() => accounts.reload()}
	onClose={() => (open = false)}
	onCreated={(created, key) => {
		list.set([created, ...(list.data ?? [])]);
		issued = key;
	}}
/>
<SecretModal value={issued} title="API-ключ" label="Ключ" note="Передайте его внешней системе и храните в её секретнице." example={apiKeyCurl(location.origin)} onClose={() => (issued = null)} />
