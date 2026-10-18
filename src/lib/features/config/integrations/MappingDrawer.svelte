<script lang="ts">
	// «Поля заявки»: какие ключи запроса принимает источник и куда они ложатся в CRM (маппинг «утверждённых полей»). Справа от правил — результат на примере запроса:
	// его считает сервер (черновик правил уходит в предпросмотр), поэтому «что получится» совпадает с тем, что примет приём заявок.
	import { untrack } from 'svelte';
	import { AddLarge } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap, ApiError, errorMessage } from '$lib/api';
	import { Btn, DateText, ErrorState, FormDrawer, FormSection, Notice, RadioField, Skeleton, StatusChip, UserName, confirm, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import type { FieldMapping, IntegrationSource, MappingPreview, MappingTarget } from '../types';
	import MappingRuleRow from './MappingRuleRow.svelte';
	import { MODES, TYPICAL_SAMPLE, emptyDraft, lacksContact, mapServerIssues, parseSample, ruleToDraft, suggestSources, toMapping, unusedKeys, validateDrafts, type MappingMode, type RuleDraft, type RuleErrors } from './mapping';

	interface Props {
		open: boolean;
		source: IntegrationSource | null;
		onClose: () => void;
		/** число правил после сохранения или сброса (0 — встроенное поведение) */
		onSaved: (rules: number) => void;
	}

	let { open, source, onClose, onSaved }: Props = $props();

	let loading = $state(false);
	let loadError = $state<unknown>(null);
	let targets = $state<MappingTarget[]>([]);
	let saved = $state<FieldMapping | null>(null);
	let mode = $state<MappingMode>('strict');
	let drafts = $state<RuleDraft[]>([]);
	let sample = $state('');
	let serverErrors = $state<Record<number, RuleErrors>>({});
	let formIssues = $state<string[]>([]);
	let saving = $state(false);
	let formError = $state<string | null>(null);
	let attempted = $state(false);

	async function load() {
		if (!source) return;
		loading = true;
		loadError = null;
		try {
			const r = await unwrap(api.GET('/api/admin/integrations/sources/{code}/mapping', { params: { path: { code: source.code } } }));
			targets = r.targets;
			saved = r.mapping ?? null;
			mode = r.mapping?.mode ?? 'strict';
			drafts = (r.mapping?.rules ?? []).map(ruleToDraft);
			serverErrors = {};
			formIssues = [];
			formError = null;
			attempted = false;
		} catch (e) {
			loadError = e;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (!open) return;
		untrack(() => {
			sample = '';
			preview = null;
			previewError = null;
			void load();
		});
	});

	const clientErrors = $derived(validateDrafts(drafts));
	const hasClientErrors = $derived(clientErrors.some((e) => Object.keys(e).length > 0));
	const rowErrors = (i: number): RuleErrors => ({ ...(attempted || serverErrors[i] ? clientErrors[i] : {}), ...(serverErrors[i] ?? {}) });
	const labelOf = (code: string) => targets.find((t) => t.code === code)?.label ?? code;

	// --- пример запроса и предпросмотр на сервере ---
	const parsed = $derived(parseSample(sample));
	const sampleKeys = $derived(parsed.state === 'ok' ? Object.keys(parsed.record) : []);
	const unused = $derived(unusedKeys(sampleKeys, drafts));
	let preview = $state<MappingPreview | null>(null);
	let previewError = $state<string | null>(null);
	let previewing = $state(false);
	let seq = 0;

	async function runPreview() {
		if (!source || parsed.state !== 'ok') return;
		const mine = ++seq;
		previewing = true;
		try {
			const body = { from_remote: false, record: parsed.record, mapping: drafts.length ? toMapping(drafts, mode) : null };
			const r = await unwrap(api.POST('/api/admin/integrations/sources/{code}/mapping/preview', { params: { path: { code: source.code } }, body }));
			if (mine !== seq) return;
			preview = r;
			previewError = null;
		} catch (e) {
			if (mine !== seq) return;
			preview = null;
			previewError = e instanceof ApiError && e.errors.length ? e.errors.map((x) => x.reason).join('; ') : errorMessage(e);
		} finally {
			if (mine === seq) previewing = false;
		}
	}

	// после паузы в правке пересчитываем сами; кнопка «Проверить на сервере» — немедленно
	$effect(() => {
		if (!open || parsed.state !== 'ok' || hasClientErrors) {
			untrack(() => {
				seq++;
				preview = null;
				previewing = false;
			});
			return;
		}
		void [JSON.stringify(toMapping(drafts, mode)), sample];
		const t = setTimeout(() => untrack(() => void runPreview()), 600);
		return () => clearTimeout(t);
	});

	async function fromRemote() {
		if (!source) return;
		try {
			const r = await unwrap(api.POST('/api/admin/integrations/sources/{code}/mapping/preview', { params: { path: { code: source.code } }, body: { from_remote: true, mapping: null } }));
			sample = JSON.stringify(r.record, null, 2);
			toast.success('Взята первая запись с сайта (телефон и email скрыты)');
		} catch (e) {
			toast.error(e);
		}
	}

	// --- правила ---
	const add = (key?: string) => {
		const d = emptyDraft();
		if (key) d.source = key;
		drafts = [...drafts, d];
	};
	const remove = (i: number) => {
		drafts = drafts.filter((_, k) => k !== i);
		serverErrors = {};
	};
	function move(i: number, delta: -1 | 1) {
		const j = i + delta;
		if (j < 0 || j >= drafts.length) return;
		const next = [...drafts];
		[next[i], next[j]] = [next[j], next[i]];
		drafts = next;
		serverErrors = {};
	}
	const dirtyKey = $derived(JSON.stringify([mode, drafts.map(({ uid: _u, ...rest }) => rest)]));
	let baseKey = $state('');
	$effect(() => {
		if (!loading && !loadError && open) {
			void saved;
			untrack(() => (baseKey = JSON.stringify([mode, drafts.map(({ uid: _u, ...rest }) => rest)])));
		}
	});
	const dirty = $derived(!loading && baseKey !== '' && dirtyKey !== baseKey);

	async function save() {
		if (!source || saving) return;
		attempted = true;
		formError = null;
		formIssues = [];
		serverErrors = {};
		if (!drafts.length) return void (formError = 'Добавьте хотя бы одно правило или нажмите «Вернуть встроенное»');
		if (hasClientErrors) return void (formError = 'Исправьте подсвеченные поля');
		saving = true;
		try {
			// другой администратор мог сохранить маппинг, пока панель была открыта: версия растёт на сервере на 1 при каждом сохранении
			const current = await unwrap(api.GET('/api/admin/integrations/sources/{code}/mapping', { params: { path: { code: source.code } } }));
			if ((current.mapping?.version ?? 0) !== (saved?.version ?? 0)) {
				const go = await confirm({ title: 'Поля уже изменил другой администратор', message: `Сейчас сохранена версия ${current.mapping?.version ?? 0}, вы правили версию ${saved?.version ?? 0}. Перезаписать вашими правилами?`, confirmLabel: 'Перезаписать', danger: true });
				if (!go) return;
			}
			if (source.is_active && !(await confirm({ title: 'Сохранить поля для включённого источника?', message: 'Новые правила начнут действовать сразу: заявки, не подходящие под них, будут отклоняться.', confirmLabel: 'Сохранить' }))) return;
			const out = await unwrap(api.PUT('/api/admin/integrations/sources/{code}/mapping', { params: { path: { code: source.code } }, body: toMapping(drafts, mode) }));
			toast.success('Поля заявки сохранены');
			onSaved((out.rules ?? []).length);
			onClose();
		} catch (e) {
			if (e instanceof ApiError && e.errors.length) {
				const issues = mapServerIssues(e.errors, drafts);
				serverErrors = issues.byRule;
				formIssues = issues.form;
				formError = 'Сервер не принял правила';
			} else formError = errorMessage(e);
		} finally {
			saving = false;
		}
	}

	async function reset() {
		if (!source) return;
		if (!(await confirm({ title: 'Вернуть встроенное поведение?', message: 'Настроенные правила будут удалены: источник снова разбирает запрос по встроенным названиям полей.', confirmLabel: 'Вернуть', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/admin/integrations/sources/{code}/mapping', { params: { path: { code: source.code } } }));
			toast.success('Правила удалены, действуют встроенные названия');
			onSaved(0);
			onClose();
		} catch (e) {
			toast.error(e);
		}
	}

	const previewRows = $derived(
		preview
			? Object.entries(preview.payload).flatMap(([k, v]) =>
					v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>).map(([ck, cv]) => ({ label: `${k}.${ck}`, value: cv })) : [{ label: labelOf(k), value: v }]
				)
			: []
	);
	const show = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
</script>

{#snippet extra()}
	{#if saved}<Btn label="Вернуть встроенное" variant="ghost" colorScheme="neutral" danger onclick={reset} />{/if}
{/snippet}

<FormDrawer {open} title={`Поля заявки: ${source?.name ?? ''}`} width={760} {saving} {formError} {dirty} onSave={save} {onClose} {extra}>
	{#if loadError}
		<ErrorState error={loadError} onRetry={load} compact />
	{:else if loading}
		<Skeleton kind="tile" rows={1} height={220} />
	{:else}
		<Notice tone="info">
			Правила говорят, какой ключ запроса сайта куда ложится в CRM. Пока правил нет, работают встроенные названия: английские и русские, как в выгрузке «Данные оплат». Для сайта обязательны email или телефон.
			{#if saved}<span class="mt-1 block"><StatusChip label={`Версия ${saved.version}`} tone="neutral" />{#if saved.approved_at}<span class="t-desc-l ml-2 text-muted">утвердил <UserName id={saved.approved_by} fallback="администратор" />, <DateText value={saved.approved_at} time /></span>{/if}</span>{/if}
		</Notice>

		<RadioField label="Что делать с остальными ключами запроса" bind:value={mode} items={MODES.map((m) => ({ key: m.key, label: m.label, hint: m.hint }))} />

		<FormSection title="Правила">
			{#if formIssues.length}<Notice tone="error"><ul class="m-0 pl-4">{#each formIssues as m (m)}<li>{m}</li>{/each}</ul></Notice>{/if}
			{#if drafts.length && lacksContact(drafts)}<Notice tone="warning">Нет правила для email или телефона: сервер не сохранит такие правила, а заявки без контакта отклоняются при приёме.</Notice>{/if}
			{#if drafts.length === 0}
				<p class="t-body-s m-0 text-muted">Правил нет — действуют встроенные названия. Добавьте правило, чтобы задать свои.</p>
			{:else}
				<ol class="m-0 flex list-none flex-col gap-3 p-0">
					{#each drafts as rule, i (rule.uid)}
						<MappingRuleRow bind:rule={drafts[i]} index={i} {targets} errors={rowErrors(i)} suggestions={suggestSources(sampleKeys, rule.target, targets.find((t) => t.code === rule.target)?.label)} first={i === 0} last={i === drafts.length - 1} onRemove={() => remove(i)} onMove={(d) => move(i, d)} />
					{/each}
				</ol>
			{/if}
			<div><Btn label="Добавить правило" icon={AddLarge} variant="outline" colorScheme="neutral" onclick={() => add()} /></div>
			{#if drafts.length > 1}<p class="t-desc-l m-0 text-muted">Два правила с одним полем CRM работают по очереди: берётся первое непустое значение.</p>{/if}
		</FormSection>

		<FormSection title="Пример запроса">
			<AreaField label="Тело запроса (JSON)" bind:value={sample} rows={6} maxRows={14} error={parsed.state === 'error' ? parsed.message : undefined} hint="Не больше 20 КБ. Ничего не сохраняется и не создаётся" />
			<div class="flex flex-wrap gap-2">
				<Btn label="Вставить типовой" variant="outline" colorScheme="neutral" onclick={() => (sample = JSON.stringify(TYPICAL_SAMPLE, null, 2))} />
				<Btn label="Взять с сайта" variant="outline" colorScheme="neutral" onclick={fromRemote} />
				{#if sample}<Btn label="Очистить" variant="ghost" colorScheme="neutral" onclick={() => (sample = '')} />{/if}
			</div>
			{#if unused.length}
				<p class="t-desc-l m-0 flex flex-wrap items-center gap-1.5 text-muted">
					Нет в правилах:
					{#each unused as key (key)}<button type="button" class="t-desc-l cursor-pointer rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-body" onclick={() => add(key)} title="Добавить правило для этого ключа">{key}</button>{/each}
				</p>
			{/if}
		</FormSection>

		<FormSection title="Что получится">
			{#if parsed.state === 'empty'}
				<p class="t-body-s m-0 text-muted">Вставьте пример запроса, чтобы увидеть результат.</p>
			{:else if parsed.state === 'error'}
				<p class="t-body-s m-0 text-muted">Результат появится, когда пример станет корректным JSON.</p>
			{:else if hasClientErrors}
				<p class="t-body-s m-0 text-muted">Исправьте подсвеченные поля правил, чтобы увидеть результат.</p>
			{:else if previewing && !preview}
				<Skeleton kind="rows" rows={3} />
			{:else if previewError}
				<Notice tone="error">{previewError}</Notice>
			{:else if preview}
				<div class="flex flex-col gap-3" aria-busy={previewing}>
					<span class="t-desc-l text-muted">Как примет сервер, по текущим правилам{drafts.length ? '' : ' (встроенные названия)'}.</span>
					{#if preview.errors?.length}
						<Notice tone="error" title="Сервер отклонил бы такую заявку"><ul class="m-0 pl-4">{#each preview.errors as er (er.field + er.reason)}<li>{er.field}: {er.reason}</li>{/each}</ul></Notice>
					{/if}
					{#if previewRows.length}
						<dl class="m-0 grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-1.5 rounded-lg border border-line p-3 max-md:grid-cols-1">
							{#each previewRows as r (r.label)}<dt class="t-desc-l text-muted">{r.label}</dt><dd class="t-body-s m-0 wrap-anywhere max-md:mb-1.5">{show(r.value)}</dd>{/each}
						</dl>
					{:else}<p class="t-body-s m-0 text-muted">Ни одно поле не заполнено.</p>{/if}
					{#if preview.product}<span class="t-body-s">Продукт найден: <strong>{show(preview.product.name)}</strong> ({show(preview.product.code)})</span>
					{:else if !preview.errors?.length}<span class="t-desc-l text-muted">Продукт по курсу не найден: сделка создастся без продукта.</span>{/if}
					{#if preview.warnings?.length}<Notice tone="warning"><ul class="m-0 pl-4">{#each preview.warnings as w (w)}<li>{w}</li>{/each}</ul></Notice>{/if}
					{#if preview.ignored_keys?.length}<p class="t-desc-l m-0 text-muted">Не использованы: {preview.ignored_keys.join(', ')}</p>{/if}
				</div>
			{/if}
		</FormSection>
	{/if}
</FormDrawer>
