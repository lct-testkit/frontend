<script lang="ts">
	// Вложения сущности (сделка, организация, контакт): список по категориям, загрузка в три шага
	// (upload-intent → PUT в хранилище → commit → привязка), скачивание, отвязка (только тому, у кого право `file:delete`).
	// Имя файла бэкенд во вложении не отдаёт, поэтому кладём его в `description` при привязке (backend-issues A-31).
	import { onMount } from 'svelte';
	import { Download, Trash, Upload } from '@lct-testkit/rt-ui/icons';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { api, errorMessage, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { uploadFile, type AttachmentCategory } from '$lib/api/upload';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, DateText, EmptyState, ErrorState, IconBtn, Skeleton, confirm, toast } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { ATTACHMENT_CATEGORY_LABELS } from '../shared/labels';
	import type { Attachment } from '../types';

	interface Props {
		entityType: string;
		entityId: string;
		canEdit?: boolean;
		/** вложения добавились или пропали — родитель может обновить счётчик */
		onChange?: (count: number) => void;
	}

	let { entityType, entityId, canEdit = false, onChange }: Props = $props();

	const ALLOWED = ['png', 'jpeg', 'jpg', 'pdf', 'zip', 'gz', 'gzip', 'rar', 'doc', 'docx', 'xls', 'xlsx', 'xml', 'csv'];
	const MAX_BYTES = 50 * 1024 * 1024;

	let items = $state<Attachment[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	interface Pending {
		id: number;
		file: File;
		progress: number;
		state: 'ready' | 'uploading' | 'error';
		message?: string;
	}
	let pending = $state<Pending[]>([]);
	let category = $state<string>('other');
	let dragging = $state(false);
	let input = $state<HTMLInputElement>();
	let seq = 0;

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

	const extOf = (name: string) => name.split('.').pop()?.toLowerCase() ?? '';

	function pick(files: FileList | File[] | null) {
		if (!files) return;
		const next: Pending[] = [];
		for (const file of Array.from(files)) {
			const problem = !ALLOWED.includes(extOf(file.name))
				? `Тип «.${extOf(file.name) || '?'}» не поддерживается`
				: file.size > MAX_BYTES
					? 'Файл больше 50 МБ'
					: file.size === 0
						? 'Файл пустой'
						: undefined;
			next.push({ id: (seq += 1), file, progress: 0, state: problem ? 'error' : 'ready', message: problem });
		}
		pending = [...pending, ...next];
	}

	async function send(row: Pending) {
		row.state = 'uploading';
		row.message = undefined;
		row.progress = 0;
		let fileId: string | null = null;
		try {
			const uploaded = await uploadFile(row.file, { category: category as AttachmentCategory, onProgress: (f) => (row.progress = f) });
			fileId = uploaded.id;
			const linked = await unwrap(
				api.POST('/api/attachments', { body: { file_id: uploaded.id, entity_type: entityType, entity_id: entityId, category: category as AttachmentCategory, description: row.file.name } })
			);
			items = [linked, ...items];
			pending = pending.filter((p) => p.id !== row.id);
			onChange?.(items.length);
		} catch (e) {
			row.state = 'error';
			row.message = errorMessage(e);
			// файл загружен, а привязать не вышло: убираем сироту (право есть только у HEAD/ADMIN — backend-issues A-23)
			if (fileId && canRemove) void api.DELETE('/api/files/{file_id}', { params: { path: { file_id: fileId } } });
		}
	}

	async function sendAll() {
		for (const row of pending.filter((p) => p.state === 'ready' || (p.state === 'error' && p.message && ALLOWED.includes(extOf(p.file.name)) && p.file.size <= MAX_BYTES))) await send(row);
		if (!pending.length) toast.success('Файлы загружены');
	}

	async function download(a: Attachment) {
		try {
			const res = await unwrap(api.GET('/api/files/{file_id}/download-url', { params: { path: { file_id: a.file_id }, query: { entity_type: entityType, entity_id: entityId } } }));
			window.open(res.download_url, '_blank', 'noopener');
		} catch (e) {
			toast.error(e);
		}
	}

	async function remove(a: Attachment) {
		if (!(await confirm({ title: `Отвязать «${a.description || 'файл'}»?`, confirmLabel: 'Отвязать', danger: true }))) return;
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
	const busy = $derived(pending.some((p) => p.state === 'uploading'));
</script>

<div class="flex min-w-0 flex-col gap-3">
	{#if canEdit}
		<!-- своя зона перетаскивания: rt-ui FileUpload заменяет список при каждой загрузке и сам хранит файлы, а нам нужны очередь, категория и прогресс; кнопки внутри rt-ui File без aria-label -->
		<div
			role="group"
			aria-label="Загрузка файлов"
			class={['flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition', dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface']}
			ondragover={(e) => {
				e.preventDefault();
				dragging = true;
			}}
			ondragleave={() => (dragging = false)}
			ondrop={(e) => {
				e.preventDefault();
				dragging = false;
				pick(e.dataTransfer?.files ?? null);
			}}
		>
			<input bind:this={input} type="file" multiple class="hidden" accept={ALLOWED.map((e) => `.${e}`).join(',')} onchange={(e) => ((pick(e.currentTarget.files), (e.currentTarget.value = '')))} />
			<Btn label="Загрузить файлы" icon={Upload} variant="outline" colorScheme="neutral" onclick={() => input?.click()} data-testid="attach-pick" />
			<span class="t-desc-l text-muted max-md:hidden">или перетащите сюда · до 50 МБ</span>
		</div>

		{#if pending.length}
			<div class="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3">
				<Pick label="Категория" items={categoryItems} value={category} onChange={(v) => v && (category = v)} />
				<ul class="m-0 flex list-none flex-col gap-2 p-0">
					{#each pending as row (row.id)}
						<li class="flex flex-col gap-1">
							<div class="flex items-center gap-2">
								<span class="t-body-m min-w-0 flex-1 truncate">{row.file.name}</span>
								<span class="t-desc-l flex-none text-muted">{formatBytes(row.file.size)}</span>
								<IconBtn icon={Trash} label="Убрать из очереди" size="s" disabled={row.state === 'uploading'} onclick={() => (pending = pending.filter((p) => p.id !== row.id))} />
							</div>
							{#if row.state === 'uploading'}<Progress value={Math.round(row.progress * 100)} size="s" />{/if}
							<!-- ошибка строки очереди: короткая подпись под именем файла, плашка Notice для неё слишком тяжёлая -->
							{#if row.message}<span class="t-desc-l text-danger" role="alert">{row.message}</span>{/if}
						</li>
					{/each}
				</ul>
				<div class="flex justify-end gap-2">
					<Btn label="Очистить" variant="ghost" colorScheme="neutral" size="s" disabled={busy} onclick={() => (pending = [])} />
					<Btn label="Загрузить" size="s" loading={busy} disabled={!pending.some((p) => p.state !== 'uploading')} onclick={sendAll} data-testid="attach-upload" />
				</div>
			</div>
		{/if}
	{/if}

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
								<span class="t-body-m truncate" title={a.description ?? undefined}>{a.description || 'Файл'}</span>
								<span class="t-desc-l text-muted"><DateText value={a.created_at} time />{#if a.uploaded_by} · {people.name(a.uploaded_by)}{/if}</span>
							</span>
							{#if canDownload}<IconBtn icon={Download} label="Скачать" onclick={() => download(a)} />{/if}
							{#if canRemove}<IconBtn icon={Trash} label="Отвязать" danger onclick={() => remove(a)} />{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/each}
	{/if}
</div>
