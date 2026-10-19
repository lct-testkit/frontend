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
	import { REF_MAX, mergeConfig, signedCurl, splitConfig, validateRef } from './sourceForm';

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
	/** остальные ключи `config` (без двух, вынесенных в поля) — JSON в блоке «Дополнительно» */
	let configText = $state('{}');
	let signingRef = $state('');
	let requireTs = $state(false);
	/** пример в «Как подключить»: с меткой времени или без */
	let exampleTs = $state(false);
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
			const parts = splitConfig(source?.config);
			configText = JSON.stringify(parts.rest, null, 2);
			signingRef = parts.signingSecretRef;
			requireTs = parts.requireTimestamp;
			exampleTs = parts.requireTimestamp;
			pullEnabled = source?.pull_enabled ?? false;
			pullMinutes = Math.round((source?.pull_interval_seconds ?? 300) / 60);
			errors = {};
			formError = null;
		});
	});

	const pullable = $derived(source?.code === 'cms' || source?.code === 'lms');
	const passport = $derived(source ? WEBHOOK_PASSPORTS[source.code] : undefined);
	const url = $derived(passport ? `${location.origin}${passport.path}` : '');
	const secretVar = $derived(signingRef.trim() || credentialsRef.trim() || passport?.secretVar || 'WEBHOOK_SECRET');
	const curl = $derived(passport ? signedCurl({ origin: location.origin, path: passport.path, body: passport.example, secretVar, timestamp: exampleTs || requireTs, idempotencyKey: 'demo-1' }) : '');

	async function save() {
		if (!source) return;
		const next: Record<string, string> = {};
		if (!name.trim()) next.name = 'Укажите название';
		if (pullable && pullEnabled && (pullMinutes === null || pullMinutes < 1 || pullMinutes > 1440)) next.pull_interval_seconds = 'От 1 минуты до 24 часов (1440)';
		const refError = validateRef(credentialsRef);
		if (refError) next.credentials_ref = refError;
		const signError = validateRef(signingRef);
		if (signError) next.signing_secret_ref = signError;
		let rest: Record<string, unknown> = {};
		try {
			const parsed: unknown = JSON.parse(configText || '{}');
			if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) next.config = 'Ожидается объект вида { "ключ": "значение" }';
			else rest = parsed as Record<string, unknown>;
		} catch {
			next.config = 'Некорректный JSON: проверьте скобки и кавычки';
		}
		errors = next;
		if (Object.keys(next).length) return;
		const config = mergeConfig({ signingSecretRef: signingRef, requireTimestamp: requireTs, rest });
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
			const failure = toFormFailure(e, ['name', 'base_url', 'auth_type', 'credentials_ref', 'config', 'pull_interval_seconds', 'signing_secret_ref']);
			errors = failure.fields;
			formError = failure.form;
		} finally {
			saving = false;
		}
	}
</script>

<FormDrawer {open} title={source?.name ?? 'Источник'} width={560} {saving} {formError} onSave={save} {onClose}>
	<TextField label="Название" required bind:value={name} error={errors.name} maxlength={255} autofocus />
	<TextField label="Адрес системы" bind:value={baseUrl} error={errors.base_url} placeholder="https://…" />
	<Pick label="Способ входа" bind:value={authType} clearable placeholder="Не выбран" hint="Как эта система подтверждает свои запросы" items={AUTH_TYPES.map((a) => ({ key: a.key, value: a.value }))} />
	<TextField label="Секрет: имя переменной" bind:value={credentialsRef} error={errors.credentials_ref ?? validateRef(credentialsRef) ?? undefined} placeholder="Имя переменной" maxlength={REF_MAX} hint="Например: CMS_WEBHOOK_SECRET. Это имя переменной окружения на сервере, сам секрет здесь не хранится" />
	{#if pullable}
		<FormSection title="Забор по расписанию">
			<Toggle label="Забирать автоматически" bind:checked={pullEnabled} hint="Иначе данные забираются только кнопкой «Забрать сейчас»" />
			{#if pullEnabled}<NumberField label="Раз в … минут" bind:value={pullMinutes} integer min={1} max={1440} error={errors.pull_interval_seconds} />{/if}
		</FormSection>
	{/if}
	{#if passport}
		<FormSection title="Подпись входящих запросов">
			<TextField label="Секрет подписи (имя переменной)" bind:value={signingRef} error={errors.signing_secret_ref ?? validateRef(signingRef) ?? undefined} maxlength={REF_MAX} hint="Если пусто, берётся секрет из поля «Секрет: имя переменной» выше" />
			<Toggle label="Проверять время запроса" bind:checked={requireTs} hint="Запрос без заголовка X-Timestamp отклоняется, а перехваченный запрос нельзя повторить через 5 минут" />
		</FormSection>
	{/if}
	<FormSection collapsible title="Дополнительно" open={configText.trim() !== '{}'} summary="Дополнительные настройки">
		<AreaField label="Дополнительные настройки (JSON)" bind:value={configText} error={errors.config} rows={4} maxRows={12} hint="Ключи, которые не вынесены в поля выше" />
	</FormSection>

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
					<Toggle label="Пример с меткой времени" bind:checked={exampleTs} disabled={requireTs} />
					<span class="t-desc-m text-soft">Подпись — HMAC-SHA256 секретом из переменной окружения терминала ({secretVar}). С меткой X-Timestamp подписывается строка «метка.тело», допуск — 5 минут. Секрет из браузера недоступен.</span>
				</div>
			</div>
		</FormSection>
	{/if}
</FormDrawer>
