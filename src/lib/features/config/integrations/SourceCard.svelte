<script lang="ts">
	// Карточка источника: переключатель «Активен», что и откуда забираем, итог последнего забора, курсор и кнопка «Забрать сейчас».
	// Статус (курсоры, итог, очередь) приходит отдельным запросом: в списке источников курсоров нет.
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Switch } from '@lct-testkit/rt-ui';
	import { Settings, Synchronization } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, CopyButton, DateText, IconBtn, Notice, Skeleton, StatusChip, Tip, toast } from '$lib/ui';
	import { AUTH_TYPES, labelOf } from '../labels';
	import type { IntegrationSource, SourceStatus } from '../types';
	import { PullRun } from './pull.svelte';
	import { cursorLines, intervalLabel, parseRun, pullBlocked, runChip, runCounts, triggerLabel } from './sourceState';

	interface Props {
		source: IntegrationSource;
		busy: boolean;
		onToggle: (next: boolean) => void;
		onEdit: () => void;
	}

	let { source, busy, onToggle, onEdit }: Props = $props();

	let status = $state<SourceStatus | null>(null);
	let statusError = $state(false);
	let lastInbound = $state<string | null>(null);

	async function load() {
		statusError = false;
		try {
			const [st, inbound] = await Promise.all([
				unwrap(api.GET('/api/admin/integrations/sources/{code}/status', { params: { path: { code: source.code } } })),
				unwrap(api.GET('/api/admin/integrations/inbound-messages', { params: { query: { source_code: source.code, limit: 1 } } }))
			]);
			status = st;
			lastInbound = inbound[0]?.received_at ?? null;
		} catch {
			statusError = true;
		}
	}
	onMount(() => void load());

	const pull = new PullRun(() => void load());
	onDestroy(() => pull.stop());
	// запрос поставила другая вкладка или другой администратор: следим за статусом, пока он не выполнится
	$effect(() => {
		if (!status?.pull_request || pull.busy) return;
		const t = setInterval(() => void load(), 3000);
		return () => clearInterval(t);
	});

	const run = $derived(parseRun(status?.last_run ?? source.last_run));
	const chip = $derived(runChip(run));
	const counts = $derived(runCounts(run, source.code));
	const cursors = $derived(cursorLines(status?.cursors));
	const pullable = $derived(source.code !== 'bitrix24');
	const queued = $derived(Boolean(status?.pull_request));
	/** запрос поставлен нами или кем-то ещё и итога по нему пока нет */
	const inFlight = $derived(pull.busy || queued);
	const blocked = $derived(pullBlocked(source) ?? (queued && !pull.busy ? 'Запрос на забор уже стоит в очереди' : null));
	const pullLabel = $derived(pull.phase === 'starting' ? 'Запускаем…' : pull.phase === 'queued' || pull.phase === 'running' ? 'Забираем…' : 'Забрать сейчас');
	const schedule = $derived(source.pull_enabled ? `каждые ${intervalLabel(source.pull_interval_seconds)}` : 'только вручную');
	const lastError = $derived(status?.last_error ?? source.last_error);
	const journalHref = $derived(`/admin/integrations?tab=inbound&source=${source.code}`);

	async function start() {
		await pull.start(source.code);
		if (pull.phase === 'failed' && !pull.run) toast.error(pull.error ?? 'Не удалось запустить забор');
		else if (pull.phase === 'done') toast.success(`Забор завершён: получено ${pull.run?.fetched ?? 0}`);
		else if (pull.phase === 'failed') toast.error(`Забор завершился ошибкой: ${pull.error}`);
		else if (pull.phase === 'timeout') toast.info('Забор ещё идёт: результат появится в карточке, когда он завершится');
	}
</script>

<article class="flex w-full min-w-0 flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label={source.name}>
	<header class="flex items-start gap-2">
		<div class="flex min-w-0 flex-1 flex-col gap-1">
			<h3 class="t-body-l-strong wrap-anywhere">{source.name}</h3>
			<span class="flex items-center gap-2"><StatusChip label={source.is_active ? 'Активен' : 'Отключён'} tone={source.is_active ? 'success' : 'neutral'} /><span class="t-desc-m font-mono text-soft">{source.code}</span></span>
		</div>
		<Switch checked={source.is_active} disabled={busy} aria-label={source.is_active ? `Отключить «${source.name}»` : `Включить «${source.name}»`} onChange={(v: boolean) => onToggle(v)} />
	</header>

	<dl class="m-0 grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
		<dt class="t-desc-l text-muted">Адрес</dt>
		<dd class="t-body-s m-0 break-all">{source.base_url ?? '—'}</dd>
		<dt class="t-desc-l text-muted">Авторизация</dt>
		<dd class="t-body-s m-0">{source.auth_type ? labelOf(AUTH_TYPES, source.auth_type) : '—'}</dd>
		{#if pullable}
			<dt class="t-desc-l text-muted">Забор</dt>
			<dd class="t-body-s m-0">{schedule}</dd>
		{/if}
		<dt class="t-desc-l text-muted">Входящие</dt>
		<dd class="t-body-s m-0">{#if lastInbound}<DateText value={lastInbound} time /> <span class="text-soft">· по журналу</span>{:else if status || statusError}не было{:else}…{/if}</dd>
		{#each cursors as c (c.key)}
			<dt class="t-desc-l text-muted">Курсор</dt>
			<dd class="m-0 flex min-w-0 items-center gap-1">
				<span class="t-body-s min-w-0" title={`Курсор: ${c.value}`}>{cursors.length > 1 ? `${c.label} ` : ''}{c.text}</span>
				<CopyButton value={c.value} label="Скопировать курсор" />
			</dd>
		{/each}
	</dl>

	{#if pullable}
		<section class="flex flex-col gap-2 rounded-md bg-surface-2 p-3" aria-label="Последний забор">
			{#if !status && !statusError}
				<Skeleton kind="lines" rows={2} />
			{:else if statusError}
				<span class="t-desc-l text-muted">Не удалось получить статус забора. <button type="button" class="cursor-pointer border-0 bg-transparent p-0 text-accent underline" onclick={load}>Повторить</button></span>
			{:else if inFlight}
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<StatusChip label="Идёт" tone="info" />
					<span class="t-desc-l text-muted">{pull.phase === 'running' ? 'Забираем данные…' : 'Запрос принят, воркер подхватит его в течение минуты'}</span>
				</div>
			{:else if !run}
				<span class="t-body-s text-muted">Забор ещё не запускался</span>
			{:else}
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<StatusChip label={chip.label} tone={chip.tone} />
					{#if run.finishedAt}<span class="t-desc-l text-muted"><DateText value={run.finishedAt} time />{run.trigger ? ` · ${triggerLabel(run.trigger)}` : ''}</span>{/if}
				</div>
				{#if counts.length}
					<ul class="t-desc-l m-0 flex list-none flex-wrap gap-x-3 gap-y-0.5 p-0 text-muted">
						{#each counts as c (c.label)}<li class={c.tone === 'error' ? 'text-danger' : ''}>{c.label}: <span class="tabular-nums">{c.value}</span></li>{/each}
					</ul>
				{/if}
			{/if}
		</section>
	{/if}

	{#if run && !run.error && (run.failed ?? 0) > 0}
		<Notice class="shrink-0" tone="warning"><span class="wrap-anywhere">{run.failed} зап. не принято. Причины — во «Входящих» со статусом «Ошибка».</span></Notice>
	{/if}
	{#if lastError}
		<Notice class="shrink-0" tone="error" actions={[{ label: 'Журнал', onclick: () => goto(journalHref) }]}><span class="line-clamp-3 wrap-anywhere" title={lastError}>{lastError}</span></Notice>
	{/if}

	<footer class="mt-auto flex flex-wrap items-center gap-2">
		<span class="ml-auto flex items-center gap-1">
			{#if pullable}
				{#if blocked}
					<Tip text={blocked} placement="top"><Btn label="Забрать сейчас" icon={Synchronization} size="auto" disabled /></Tip>
				{:else}
					<Btn label={pullLabel} icon={Synchronization} size="auto" loading={pull.busy} onclick={start} />
				{/if}
			{/if}
			<Btn label="Журнал" variant="ghost" colorScheme="neutral" size="auto" onclick={() => goto(journalHref)} />
			<IconBtn icon={Settings} label="Настроить источник" onclick={onEdit} />
		</span>
	</footer>
</article>
