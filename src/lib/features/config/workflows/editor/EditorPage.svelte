<script lang="ts">
	// Редактор воронки: холст (десктоп) + панель свойств; на телефоне и планшете — просмотр холста и списки. Черновик → проверка → публикация.
	import { onMount } from 'svelte';
	import { beforeNavigate, goto } from '$app/navigation';
	import { Chip, DropdownMenu } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { AttentionMark, CheckStatistics, MenuKebab } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, ErrorState, IconBtn, Notice, Page, PageHeader, Skeleton, StatusChip, confirm, toast } from '$lib/ui';
	import AppDrawer from '$lib/ui/AppDrawer.svelte';
	import { toServer, type StatusDraft } from '../graph';
	import { dealTypeShort, hasUnpublishedChanges, stateLabel, stateTone } from '../meta';
	import ArchiveWizard from './ArchiveWizard.svelte';
	import Canvas from './Canvas.svelte';
	import { WorkflowEditor } from './editor.svelte';
	import IssuesList from './IssuesList.svelte';
	import MobileLists from './MobileLists.svelte';
	import PublishDialog from './PublishDialog.svelte';
	import SidePanel from './SidePanel.svelte';

	let { id }: { id: string } = $props();

	// svelte-ignore state_referenced_locally
	const editor = new WorkflowEditor(id);
	const bp = useBreakpoint();

	let templates = $state<{ code: string; name: string }[]>([]);
	let archiving = $state<StatusDraft | null>(null);
	let publishWarnings = $state<string[] | null>(null);
	let issuesOpen = $state(false);
	let menuOpen = $state(false);

	onMount(() => {
		void editor.load();
		unwrap(api.GET('/api/signature-templates'))
			.then((r) => (templates = r.items.map((t) => ({ code: t.code, name: t.name }))))
			.catch(() => {});
	});

	// несохранённые правки: и переход по ссылкам приложения, и закрытие вкладки
	let leaving = false;
	beforeNavigate((nav) => {
		if (leaving || !editor.dirty || nav.willUnload || !nav.to) return;
		nav.cancel();
		const to = nav.to.url;
		void confirm({ title: 'Выйти без сохранения?', message: 'Несохранённые правки воронки будут потеряны.', confirmLabel: 'Выйти', danger: true }).then((yes) => {
			if (!yes) return;
			leaving = true;
			void goto(to);
		});
	});
	$effect(() => {
		const warn = (e: BeforeUnloadEvent) => {
			if (editor.dirty) e.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});

	const w = $derived(editor.workflow);
	const unpublished = $derived(w ? hasUnpublishedChanges(w) : false);
	const canPublish = $derived(!editor.readonly && editor.errorCount === 0 && (editor.dirty || unpublished));

	async function check() {
		if (editor.dirty && !(await editor.save())) return;
		const res = await editor.validateOnServer();
		if (!res) return;
		if (res.ok && editor.issues.length === 0) toast.success('Воронка корректна');
		else if (res.ok) toast.info('Ошибок нет', 'Есть советы — они не блокируют публикацию');
		else toast.warning('Найдены ошибки', 'Они отмечены на холсте и в списке проблем');
		editor.select(null);
	}

	async function startPublish() {
		if (!canPublish) return;
		if (editor.dirty && !(await editor.save())) return;
		const res = await editor.validateOnServer();
		if (!res) return;
		if (!res.ok) {
			toast.warning('Публикация невозможна', 'Исправьте ошибки в списке проблем');
			return;
		}
		const local = editor.clientIssues.filter((i) => i.severity === 'warning').map((i) => i.message);
		publishWarnings = [...new Set([...local, ...res.warnings])];
	}

	async function confirmPublish() {
		if (await editor.publish()) publishWarnings = null;
		else if (editor.conflict) publishWarnings = null;
	}

	async function reload() {
		if (editor.dirty && !(await confirm({ title: 'Загрузить с сервера?', message: 'Несохранённые правки будут потеряны.', confirmLabel: 'Загрузить', danger: true }))) return;
		await editor.load(true);
	}

	async function copyJson() {
		try {
			await navigator.clipboard.writeText(JSON.stringify(toServer(editor.draft), null, 2));
			toast.success('JSON графа скопирован');
		} catch {
			toast.error('Не удалось скопировать');
		}
	}

	const menuItems = $derived([
		...(!editor.readonly && bp.isMobile ? [{ key: 'check', value: 'Проверить воронку' }] : []),
		...(!editor.readonly && bp.isDesktop ? [{ key: 'layout', value: 'Расставить статусы автоматически' }] : []),
		{ key: 'reload', value: 'Загрузить с сервера' },
		{ key: 'json', value: 'Копировать JSON графа' }
	]);
	function onMenu(item: { key: string | number }) {
		menuOpen = false;
		if (item.key === 'check') void check();
		else if (item.key === 'layout') editor.autoLayout();
		else if (item.key === 'reload') void reload();
		else if (item.key === 'json') void copyJson();
	}
</script>

<svelte:head><title>{w ? `${w.name} · Воронки` : 'Воронка'} · RTK School</title></svelte:head>

<Page fill wide class="max-lg:h-auto lg:gap-3">
	{#if editor.error}
		<PageHeader title="Воронка" back="/workflows" />
		<ErrorState error={editor.error} onRetry={() => editor.load()} />
	{:else if editor.loading || !w}
		<PageHeader title="Воронка" back="/workflows" />
		<Skeleton kind="tile" rows={1} height={480} />
	{:else}
		{#snippet issueIcon()}<AttentionMark class="size-4 fill-danger" />{/snippet}
		{#snippet chips()}
				<StatusChip label={stateLabel(w.state)} tone={stateTone(w.state)} />
				<StatusChip label={dealTypeShort(w.deal_type)} tone="info" />
				{#if w.is_default}<StatusChip label="По умолчанию" tone="accent" />{/if}
				{#if editor.dirty}
					<StatusChip label="Не сохранено" tone="warning" />
				{:else if unpublished && w.state === 'published'}
					<StatusChip label="Не опубликовано" tone="warning" />
				{/if}
				{#if editor.issues.length}
					<Chip
						size="s"
						variant="secondary"
						selected={false}
						label={`${editor.errorCount ? `${editor.errorCount} ош.` : ''}${editor.errorCount && editor.warningCount ? ' · ' : ''}${editor.warningCount ? `${editor.warningCount} сов.` : ''}`}
						icon={editor.errorCount ? issueIcon : undefined}
						onclick={() => (bp.isDesktop ? editor.select(null) : (issuesOpen = true))}
						aria-label="Проблемы воронки"
					/>
				{/if}
		{/snippet}
		<!-- Сохранить / Опубликовать: на десктопе в шапке справа; на телефоне — отдельным рядом под заголовком, две кнопки поровну на всю ширину (в шапке им не хватало места, «Опубликовать» обрезалось) -->
		{#snippet saveButtons()}
			<Btn
				label="Сохранить"
				variant={editor.dirty ? 'primary' : 'outline'}
				colorScheme={editor.dirty ? 'accent' : 'neutral'}
				disabled={!editor.dirty}
				loading={editor.saving}
				size="auto"
				class="max-md:flex-1"
				onclick={() => editor.save()}
			/>
			<Btn
				label="Опубликовать"
				variant={!editor.dirty && unpublished ? 'primary' : 'outline'}
				colorScheme={!editor.dirty && unpublished ? 'accent' : 'neutral'}
				disabled={!canPublish}
				loading={editor.publishing || editor.validating}
				size="auto"
				class="max-md:flex-1"
				onclick={startPublish}
			/>
		{/snippet}
		<PageHeader title={w.name} back="/workflows">
			{#if bp.isMobile && !editor.readonly}<div class="flex gap-2">{@render saveButtons()}</div>{/if}
			<div class="flex flex-wrap items-center gap-2">{@render chips()}</div>
			{#snippet actions()}
				{#if !editor.readonly && !bp.isMobile}
					<IconBtn icon={CheckStatistics} label="Проверить воронку" disabled={editor.validating || editor.saving} onclick={check} />
					{@render saveButtons()}
				{/if}
				<DropdownMenu class="inline-flex w-auto" items={menuItems} isOpened={menuOpen} placement="bottomRight" onClose={() => (menuOpen = false)} onClickItem={onMenu}>
					<IconBtn icon={MenuKebab} label="Ещё" size={bp.isMobile ? 'l' : 'm'} onclick={() => (menuOpen = !menuOpen)} />
				</DropdownMenu>
			{/snippet}
		</PageHeader>

		{#if w.state === 'archived'}
			<Notice class="shrink-0" tone="info">Воронка в архиве — только просмотр.</Notice>
		{:else if editor.readonly}
			<Notice class="shrink-0" tone="info">Просмотр: редактировать воронки может только администратор.</Notice>
		{/if}
		{#if editor.conflict}
			<Notice class="shrink-0"
				tone="warning"
				role="alert"
				actions={[
					{ label: 'Оставить мои правки', onclick: () => editor.adoptServerVersion() },
					{ label: 'Загрузить заново', onclick: reload }
				]}>Воронку изменил другой пользователь.</Notice
			>
		{/if}

		{#snippet starter()}
			{#if editor.draft.statuses.length === 0 && !editor.readonly}
				<div class="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-5 text-center shadow-m">
					<p class="t-body-l-strong">В воронке пока нет статусов</p>
					<div class="flex flex-wrap justify-center gap-2">
						<Btn label="Типовая заготовка" onclick={() => editor.applyStarter()} />
						<Btn label="Пустой статус" variant="outline" colorScheme="neutral" onclick={() => editor.addStatus()} />
					</div>
				</div>
			{/if}
		{/snippet}

		{#if bp.isDesktop}
			<div class="flex min-h-90 flex-1 gap-3">
				<div class="relative min-w-0 flex-1 overflow-hidden rounded-lg border border-line bg-surface">
					<Canvas {editor} interactive />
					<div class="pointer-events-none absolute inset-0 grid place-items-center"><div class="pointer-events-auto">{@render starter()}</div></div>
				</div>
				<aside class="w-96 flex-none overflow-hidden rounded-lg border border-line bg-surface max-xl:w-80" aria-label="Свойства">
					<SidePanel {editor} {templates} onArchive={(s) => (archiving = s)} />
				</aside>
			</div>
		{:else}
			{@render starter()}
			<div class="h-72 flex-none overflow-hidden rounded-lg border border-line bg-surface max-md:h-64"><Canvas {editor} interactive={false} /></div>
			<MobileLists {editor} />
		{/if}
	{/if}
</Page>

{#if !bp.isDesktop}
	<AppDrawer open={editor.selection !== null} title={editor.selectedStatus?.name || (editor.selectedTransition ? 'Переход' : '')} width={480} onClose={() => editor.select(null)}>
		<SidePanel {editor} {templates} bare onArchive={(s) => (archiving = s)} />
	</AppDrawer>
	<AppDrawer open={issuesOpen} title="Проблемы воронки" onClose={() => (issuesOpen = false)}>
		<IssuesList {editor} issues={editor.issues} onPicked={() => (issuesOpen = false)} />
	</AppDrawer>
{/if}

<ArchiveWizard {editor} status={archiving} onClose={() => (archiving = null)} />
<PublishDialog
	open={publishWarnings !== null}
	name={w?.name ?? ''}
	statuses={editor.liveStatuses.length}
	transitions={editor.draft.transitions.length}
	warnings={publishWarnings ?? []}
	busy={editor.publishing}
	onConfirm={confirmPublish}
	onClose={() => (publishWarnings = null)}
/>
