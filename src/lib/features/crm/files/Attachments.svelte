<script lang="ts">
	// Вложения сущности (сделка, организация, контакт): список по категориям, загрузка через общую очередь UploadQueue
	// (upload-intent → PUT в хранилище → commit → привязка; форматы и размер — files/policy.ts), скачивание, отвязка (право `file:delete`).
	// Имя, размер и тип файла бэкенд отдаёт в `attachment.file`; у старых вложений без него — имя из `description`, заданное при привязке.
	import { onMount } from 'svelte';
	import { Download, Trash } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import type { AttachmentCategory } from '$lib/api/upload';
	import { UploadQueue } from '$lib/api/upload-queue.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { DateText, EmptyState, ErrorState, IconBtn, Skeleton, confirm, toast } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { ATTACHMENT_CATEGORY_LABELS } from '../shared/labels';
	import { fileKind } from './file-kind';
	import { downloadFile } from './download';
	import FileDrop from './FileDrop.svelte';
	import { linkAttachment } from './link';
	import type { Attachment } from '../types';

	interface Props {
		entityType: string;
		entityId: string;
		canEdit?: boolean;
		/** вложения добавились или пропали — родитель может обновить счётчик */
		onChange?: (count: number) => void;
		/** о чём документы (предложный падеж: «по сделке»); по умолчанию «по этой карточке» */
		about?: string;
	}

	let { entityType, entityId, canEdit = false, onChange, about = 'по этой карточке' }: Props = $props();

	const hint = $derived(`Документы ${about}: договор, акт, отчёт и другое.`);

	let items = $state<Attachment[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	let category = $state<string>('other');

	let batchDone = 0;

	// сирота: файл уложен и прошёл commit, а привязать не вышло и строку убрали — удаляем, если есть право (backend-issues A-23)
	const queue = new UploadQueue<AttachmentCategory>({
		optionsFor: (row) => ({ category: row.meta }),
		onUploaded: async (row, uploaded) => {
			const linked = await linkAttachment({ fileId: uploaded.id, entityType, entityId, category: row.meta ?? 'other', description: row.file.name });
			items = [linked, ...items];
			onChange?.(items.length);
		},
		onDone: (row) => {
			batchDone += 1;
			queue.remove(row.id);
			if (!queue.rows.some((r) => r.state === 'queued' || r.state === 'uploading')) {
				toast.success(batchDone > 1 ? 'Файлы загружены' : 'Файл загружен');
				batchDone = 0;
			}
		},
		onDiscard: (row) => {
			if (row.fileId && canRemove) void api.DELETE('/api/files/{file_id}', { params: { path: { file_id: row.fileId } } });
		}
	});

	function onPick(files: File[]) {
		queue.add(files, category as AttachmentCategory);
		void queue.start();
	}

	const categoryItems = Object.entries(ATTACHMENT_CATEGORY_LABELS).map(([key, value]) => ({ key, value }));
	const canDownload = $derived(session.can('file:download'));
	const canRemove = $derived(session.can('file:delete'));

	async function load() {
		error = null;
		try {
			const all: Attachment[] = [];
			let cursor: string | undefined;
			for (let i = 0; i < 5; i += 1) {
				const page = await unwrap(api.GET('/api/attachments', { params: { query: { entity_type: entityType, entity_id: entityId, limit: 100, cursor } } }));
				all.push(...page.items);
				if (!page.next_cursor) break;
				cursor = page.next_cursor;
			}
			items = all;
			people.ensure(all.map((a) => a.uploaded_by));
			onChange?.(all.length);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	const nameOf = (a: Attachment) => a.file?.original_filename || a.description || 'Файл';

	async function remove(a: Attachment) {
		if (!(await confirm({ title: `Отвязать «${nameOf(a)}»?`, confirmLabel: 'Отвязать', danger: true }))) return;
		try {
			await unwrap(api.DELETE('/api/attachments/{attachment_id}', { params: { path: { attachment_id: a.id } } }));
			items = items.filter((x) => x.id !== a.id);
			onChange?.(items.length);
		} catch (e) {
			toast.error(e);
		}
	}

	const groups = $derived(
		Object.keys(ATTACHMENT_CATEGORY_LABELS)
			.map((key) => ({ key, rows: items.filter((a) => a.category === key) }))
			.filter((g) => g.rows.length)
	);
</script>

<div class="flex min-w-0 flex-col gap-3">
	{#if canEdit}
		<div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)]">
			<Pick label="Категория" {hint} items={categoryItems} value={category} onChange={(v) => v && (category = v)} />
		</div>
		<FileDrop {queue} {onPick} label="Загрузить файлы" testid="attach" />
	{/if}

	{#if !canEdit}<p class="t-body-s m-0 text-muted">{hint}</p>{/if}

	{#if loading}
		<Skeleton kind="rows" rows={3} />
	{:else if error}
		<ErrorState {error} onRetry={load} compact />
	{:else if groups.length === 0}
		<EmptyState title="Файлов пока нет" compact />
	{:else}
		{#each groups as group (group.key)}
			<section class="flex min-w-0 flex-col gap-1.5" aria-label={ATTACHMENT_CATEGORY_LABELS[group.key]}>
				<h3 class="t-body-s-strong m-0 text-muted">{ATTACHMENT_CATEGORY_LABELS[group.key]} · {group.rows.length}</h3>
				<ul class="m-0 list-none overflow-hidden rounded-lg border border-line bg-surface p-0">
					{#each group.rows as a (a.id)}
						<li class="flex min-h-12 items-center gap-3 border-b border-line px-3 py-2 last:border-b-0">
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="t-body-m truncate" title={nameOf(a)}>{nameOf(a)}</span>
								<span class="t-desc-l text-muted">
									{#if a.file}{formatBytes(a.file.size_bytes)} · {fileKind(a.file.mime_type, a.file.original_filename)} · {/if}<DateText value={a.created_at} time />{#if a.uploaded_by} · {people.name(a.uploaded_by)}{/if}
								</span>
							</span>
							{#if canDownload}<IconBtn icon={Download} label="Скачать" onclick={() => downloadFile(a.file_id, entityType, entityId)} />{/if}
							{#if canRemove}<IconBtn icon={Trash} label="Отвязать" danger onclick={() => remove(a)} />{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</div>
