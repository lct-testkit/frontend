<script lang="ts">
	// Зона загрузки файла в диалоге перехода: сжатая зона FileDrop (категория зафиксирована или выбирается) и список файлов, приложенных
	// в этом окне. Файл сразу грузится, привязывается к сделке (`POST /api/attachments`) и попадает в `files` диалога — переход отправит
	// его id в `attachments`, сервер привяжет файл к записи истории. «Отвязать» удаляет вложение (`DELETE /api/attachments/{id}`).
	import { Trash } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import type { AttachmentCategory } from '$lib/api/upload';
	import { UploadQueue } from '$lib/api/upload-queue.svelte';
	import { IconBtn, toast } from '$lib/ui';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { formatBytes } from '$lib/utils/format';
	import FileDrop from '../../files/FileDrop.svelte';
	import { linkAttachment } from '../../files/link';
	import { ATTACHMENT_CATEGORY_LABELS } from '../../shared/labels';
	import type { DraftFile } from './transitionDrafts';

	interface Props {
		dealId: string;
		/** категория зафиксирована (файловое условие перехода); без неё показывается выбор категории */
		category?: string;
		/** файлы этой зоны (родитель отбирает по категории) */
		files: DraftFile[];
		onAdd: (file: DraftFile) => void;
		onRemove: (attachmentId: string) => void;
		testid?: string;
	}

	let { dealId, category, files, onAdd, onRemove, testid = 'tr-files' }: Props = $props();

	let picked = $state('other');
	const effective = $derived(category ?? picked);
	const mine = $derived(files);
	const categoryItems = Object.entries(ATTACHMENT_CATEGORY_LABELS).map(([key, value]) => ({ key, value }));

	const queue = new UploadQueue<AttachmentCategory>({
		optionsFor: (row) => ({ category: row.meta }),
		onUploaded: async (row, uploaded) => {
			const cat = row.meta ?? 'other';
			const linked = await linkAttachment({ fileId: uploaded.id, entityType: 'deal', entityId: dealId, category: cat, description: row.file.name });
			onAdd({ attachmentId: linked.id, fileId: uploaded.id, name: row.file.name, size: row.file.size, category: cat });
		},
		onDone: (row) => queue.remove(row.id),
		// убрали строку, а файл уже загружен и не привязан — удаляем «сироту» (удалить свой файл может его автор)
		onDiscard: (row) => {
			if (row.fileId) void api.DELETE('/api/files/{file_id}', { params: { path: { file_id: row.fileId } } });
		}
	});

	function onPick(list: File[]) {
		queue.add(list, effective as AttachmentCategory);
		void queue.start();
	}

	async function detach(file: DraftFile) {
		try {
			await unwrap(api.DELETE('/api/attachments/{attachment_id}', { params: { path: { attachment_id: file.attachmentId } } }));
			onRemove(file.attachmentId);
		} catch (e) {
			toast.error(e, 'Не удалось отвязать файл');
		}
	}
</script>

<div class="flex min-w-0 flex-col gap-2" data-testid={testid}>
	{#if !category}
		<Pick label="Категория" items={categoryItems} value={picked} onChange={(v) => v && (picked = v)} />
	{/if}
	<FileDrop {queue} {onPick} compact label="Выбрать файл" testid={`${testid}-drop`} hint={category ? undefined : 'сохранится в сделке, во вкладке «Файлы»'} />
	{#if mine.length}
		<ul class="m-0 flex list-none flex-col gap-1 p-0" data-testid={`${testid}-list`}>
			{#each mine as file (file.attachmentId)}
				<li class="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-1.5">
					<span class="t-body-m min-w-0 flex-1 truncate" title={file.name}>{file.name}</span>
					<span class="t-desc-l flex-none text-muted">{category ? '' : `${ATTACHMENT_CATEGORY_LABELS[file.category] ?? file.category} · `}{formatBytes(file.size)}</span>
					<IconBtn icon={Trash} label="Отвязать" size="s" onclick={() => detach(file)} />
				</li>
			{/each}
		</ul>
	{/if}
</div>
