<script lang="ts">
	// System settings (key → JSON value). Secrets are never shown: the backend sends a mask and the UI never sends it back.
	import { onMount } from 'svelte';
	import { Lock } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, errorMessage, type components } from '$lib/api';
	import { AreaField, DataTable, DateText, ErrorState, FormDrawer, Skeleton, TableCell, TextField, Toggle, toast, type Col } from '$lib/ui';
	import { PDN_POLICY_KEY, isSecretPlaceholder, parseSettingValue, settingKind, stringifySettingValue } from '../settings';

	type Setting = components['schemas']['SystemSettingOut'] & { id: string };

	let rows = $state<Setting[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let editing = $state<Setting | null>(null);

	// drawer form
	let text = $state('');
	let flag = $state(false);
	let description = $state('');
	let saving = $state(false);
	let failure = $state<string | null>(null);

	const current = $derived(JSON.stringify([text, flag, description]));
	let initial = $state('');
	const kind = $derived(editing ? settingKind(editing.value, editing.is_secret) : 'json');
	const readonly = $derived(editing?.key === PDN_POLICY_KEY);

	async function load() {
		loading = true;
		error = null;
		try {
			const data = await unwrap(api.GET('/api/admin/system-settings'));
			rows = data.items.map((s) => ({ ...s, id: s.key }));
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	function open(row: Setting) {
		editing = row;
		failure = null;
		description = row.description ?? '';
		const k = settingKind(row.value, row.is_secret);
		flag = k === 'boolean' ? row.value === true : false;
		text = k === 'secret' || k === 'boolean' ? '' : k === 'json' ? JSON.stringify(row.value, null, 2) : stringifySettingValue(row.value);
		initial = current;
	}

	async function save() {
		if (!editing) return;
		failure = null;
		let value: unknown;
		if (kind === 'boolean') value = flag;
		else if (kind === 'secret') {
			if (!text || isSecretPlaceholder(text)) return void (failure = 'Введите новое значение');
			value = text;
		} else if (kind === 'number') {
			value = Number(text);
			if (text.trim() === '' || Number.isNaN(value)) return void (failure = 'Нужно число');
		} else if (kind === 'json') {
			const parsed = parseSettingValue(text);
			if (!parsed.ok) return void (failure = parsed.error);
			value = parsed.value;
		} else value = text;
		saving = true;
		try {
			await unwrap(api.PUT('/api/admin/system-settings/{key}', { params: { path: { key: editing.key } }, body: { value: value as never, description: description || null } }));
			toast.success('Настройка сохранена');
			editing = null;
			await load();
		} catch (e) {
			failure = errorMessage(e);
		} finally {
			saving = false;
		}
	}

	const preview = (row: Setting) => (row.is_secret ? '••••••••' : typeof row.value === 'string' ? row.value : JSON.stringify(row.value));

	const columns: Col<Setting>[] = [
		{ key: 'key', title: 'Ключ', width: 'minmax(180px, 1fr)', render: keyCell },
		{ key: 'value', title: 'Значение', width: 'minmax(180px, 2fr)', render: valueCell },
		{ key: 'updated_at', title: 'Изменено', drop: 1, render: dateCell }
	];
</script>

{#snippet keyCell(row: Setting)}
	<TableCell>
		<span class="flex min-w-0 flex-col py-2">
			<span class="t-body-s truncate font-mono">{row.key}</span>
			{#if row.description}<span class="t-desc-m truncate text-muted">{row.description}</span>{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet valueCell(row: Setting)}
	<TableCell>
		<span class="block truncate py-2 text-muted">
			{#if row.is_secret}<span class="inline-flex items-center gap-1"><Lock />секрет</span>{:else}{preview(row)}{/if}
		</span>
	</TableCell>
{/snippet}
{#snippet dateCell(row: Setting)}<TableCell><span class="block py-2"><DateText value={row.updated_at} relative /></span></TableCell>{/snippet}
{#snippet card(row: Setting)}
	<div class="flex min-w-0 flex-col gap-1">
		<span class="t-body-s font-mono break-all">{row.key}</span>
		<span class="t-desc-l truncate text-muted">{row.is_secret ? 'секрет' : preview(row)}</span>
	</div>
{/snippet}

{#if loading}
	<Skeleton kind="rows" rows={5} />
{:else if error}
	<ErrorState {error} onRetry={load} />
{:else}
	<DataTable {rows} {columns} {card} onRowClick={open} emptyText="Настроек нет" ariaLabel="Системные настройки" />
{/if}

<FormDrawer
	open={editing !== null}
	title={editing?.key ?? ''}
	width={520}
	saveTestId="setting-save"
	showSave={!readonly}
	cancelLabel={readonly ? 'Закрыть' : 'Отмена'}
	{saving}
	dirty={editing !== null && !readonly && current !== initial}
	formError={failure}
	onSave={save}
	onClose={() => (editing = null)}
>
	{#if editing}
		{#if readonly}
			<p class="t-body-m text-muted">Редакция политики обработки персональных данных задаётся вместе с её текстом в клиенте и меняется релизом.</p>
			<pre class="t-desc-l m-0 overflow-x-auto rounded-md bg-surface-3 p-3">{JSON.stringify(editing.value, null, 2)}</pre>
		{:else}
			{#if kind === 'boolean'}
				<Toggle label="Включено" bind:checked={flag} />
			{:else if kind === 'secret'}
				<TextField type="password" autocomplete="new-password" label="Новое значение секрета" bind:value={text} />
				<p class="t-desc-l text-muted">Текущее значение не показывается. Чтобы оставить его прежним, просто закройте окно.</p>
			{:else if kind === 'number'}
				<TextField label="Значение" inputmode="decimal" bind:value={text} />
			{:else}
				<AreaField label="Значение" rows={kind === 'json' ? 10 : 3} maxRows={16} bind:value={text} />
			{/if}
			{#if editing.description}<p class="t-desc-l text-muted">{editing.description}</p>{/if}
		{/if}
	{/if}
</FormDrawer>
