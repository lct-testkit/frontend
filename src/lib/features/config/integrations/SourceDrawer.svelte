<script lang="ts">
	// Настройка источника интеграции + «Паспорт»: как внешняя система должна вызывать вебхук (URL, заголовки, тело, curl). Секрета здесь нет.
	import { untrack } from 'svelte';
	import { CopyButton, toast } from '$lib/ui';
	import { api, unwrap } from '$lib/api';
	import { AUTH_TYPES, WEBHOOK_PASSPORTS } from '../labels';
	import type { IntegrationSource } from '../types';
	import { FormDrawer, FormSection } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { toFormFailure } from '../shared/form-errors';

	interface Props {
		open: boolean;
		source: IntegrationSource | null;
		onClose: () => void;
		onSaved: (saved: IntegrationSource) => void;
	}

	let { open, source, onClose, onSaved }: Props = $props();

	let name = $state('');
	let baseUrl = $state('');
	let authType = $state<string | null>(null);
	let credentialsRef = $state('');
	let configText = $state('{}');
	let pullEnabled = $state(false);
	/** интервал забора в минутах (бэкенд хранит секунды, 60…86400) */
	let pullMinutes = $state<number | null>(5);
	let errors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			name = source?.name ?? '';
			baseUrl = source?.base_url ?? '';
			authType = source?.auth_type ?? null;
			credentialsRef = source?.credentials_ref ?? '';
			configText = JSON.stringify(source?.config ?? {}, null, 2);
			pullEnabled = source?.pull_enabled ?? false;
			pullMinutes = Math.round((source?.pull_interval_seconds ?? 300) / 60);
			errors = {};
			formError = null;
		});
	});

	const pullable = $derived(source?.code === 'cms' || source?.code === 'lms');
	const passport = $derived(source ? WEBHOOK_PASSPORTS[source.code] : undefined);
	const url = $derived(passport ? `${location.origin}${passport.path}` : '');
	const curl = $derived(
		passport
			? [`curl -X POST '${url}'`, ...passport.headers.map((h) => `  -H '${h}'`), `  -d '${passport.body}'`].join(' \\\n')
			: ''
	);

	async function save() {
		if (!source) return;
		const next: Record<string, string> = {};
		if (!name.trim()) next.name = 'Укажите название';
		if (pullable && pullEnabled && (pullMinutes === null || pullMinutes < 1 || pullMinutes > 1440)) next.pull_interval_seconds = 'От 1 минуты до 24 часов (1440)';
		let config: Record<string, unknown> = {};
		try {
			const parsed: unknown = JSON.parse(configText || '{}');
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) next.config = 'Ожидается объект вида { "ключ": "значение" }';
			else config = parsed as Record<string, unknown>;
		} catch {
			next.config = 'Некорректный JSON: проверьте скобки и кавычки';
		}
		errors = next;
		if (Object.keys(next).length) return;
		saving = true;
		formError = null;
		try {
			const saved = await unwrap(
				api.PATCH('/api/admin/integrations/sources/{code}', {
					params: { path: { code: source.code } },
					body: { name: name.trim(), base_url: baseUrl.trim() || null, auth_type: authType, credentials_ref: credentialsRef.trim() || null, config, ...(pullable ? { pull_enabled: pullEnabled, pull_interval_seconds: Math.round((pullMinutes ?? 5) * 60) } : {}) }
				})
			);
			toast.success('Источник сохранён');
			onSaved(saved);
			onClose();
		} catch (e) {
			const failure = toFormFailure(e, ['name', 'base_url', 'auth_type', 'credentials_ref', 'config', 'pull_interval_seconds']);
			errors = failure.fields;
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title={source?.name ?? 'Источник'} width={520} {saving} {formError} onSave={save} {onClose}>
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus />
	<TextField label="Адрес (base URL)" bind:value={baseUrl} error={errors.base_url} placeholder="https://…" />
	<Pick label="Авторизация" bind:value={authType} clearable items={AUTH_TYPES.map((a) => ({ key: a.key, value: a.value }))} />
	<TextField label="Ссылка на секрет" bind:value={credentialsRef} error={errors.credentials_ref} placeholder="CMS_WEBHOOK_SECRET" hint="Имя переменной окружения на сервере. Сам секрет здесь не хранится" />
	{#if pullable}
		<FormSection title="Забор по расписанию">
			<Toggle label="Забирать автоматически" bind:checked={pullEnabled} hint="Иначе данные забираются только кнопкой «Забрать сейчас»" />
			{#if pullEnabled}<NumberField label="Раз в … минут" bind:value={pullMinutes} integer min={1} max={1440} error={errors.pull_interval_seconds} />{/if}
		</FormSection>
	{/if}
	<AreaField label="Дополнительные настройки (JSON)" bind:value={configText} error={errors.config} rows={5} maxRows={12} />

	{#if passport}
		<FormSection collapsible title="Как подключить">
			<div class="flex flex-col gap-3">
				<div class="flex flex-col gap-1">
					<span class="t-desc-l text-muted">Адрес вебхука (POST)</span>
					<div class="flex items-center gap-1"><code class="t-body-s min-w-0 flex-1 rounded-sm bg-surface-2 px-2 py-1 break-all">{url}</code><CopyButton value={url} label="Скопировать адрес" /></div>
				</div>
				<div class="flex flex-col gap-1">
					<span class="t-desc-l text-muted">Заголовки</span>
					<ul class="t-desc-l m-0 flex list-none flex-col gap-0.5 p-0 font-mono break-all">
						{#each passport.headers as h (h)}<li>{h}</li>{/each}
					</ul>
				</div>
				<div class="flex flex-col gap-1">
					<span class="t-desc-l flex items-center justify-between text-muted">Пример запроса <CopyButton value={curl} label="Скопировать пример" /></span>
					<pre class="t-desc-m m-0 overflow-x-auto rounded-sm bg-surface-2 p-2 font-mono whitespace-pre">{curl}</pre>
					<span class="t-desc-m text-soft">Подпись — HMAC-SHA256 тела запроса секретом из переменной окружения; секрет из браузера недоступен.</span>
				</div>
			</div>
		</FormSection>
	{/if}
</FormDrawer>
