<script lang="ts" generics="M = unknown">
	// Зона перетаскивания + кнопка «Выбрать файл» + список очереди загрузки (имя, размер, прогресс, ошибка, «Повторить», «Убрать»).
	// Сама ничего не грузит: выбранные файлы отдаёт наверх через onPick, а очередью (UploadQueue) владеет родитель.
	// compact — для диалога перехода: без большой рамки, одна строка с кнопкой.
	import { CloseSmall, Refresh, Upload } from '@lct-testkit/rt-ui/icons';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import type { UploadQueue } from '$lib/api/upload-queue.svelte';
	import { acceptAttr, allowedLabel, getPolicy } from '$lib/files/policy';
	import { Btn, IconBtn } from '$lib/ui';
	import { formatBytes } from '$lib/utils/format';

	interface Props {
		queue: UploadQueue<M>;
		onPick: (files: File[]) => void;
		/** подпись кнопки */
		label?: string;
		compact?: boolean;
		disabled?: boolean;
		multiple?: boolean;
		/** подсказка рядом с кнопкой; по умолчанию — предел размера */
		hint?: string;
		testid?: string;
	}

	let { queue, onPick, label = 'Выбрать файл', compact = false, disabled = false, multiple = true, hint, testid = 'file-drop' }: Props = $props();

	let dragging = $state(false);
	let input = $state<HTMLInputElement>();

	const limit = $derived(formatBytes(getPolicy().maxBytes));
	const hintText = $derived(hint ?? `до ${limit} · ${allowedLabel()}`);

	function pick(files: FileList | null) {
		if (!files || disabled) return;
		onPick(Array.from(files));
	}
</script>

<div class="flex min-w-0 flex-col gap-2">
	<div
		role="group"
		aria-label="Загрузка файлов"
		data-testid={testid}
		class={[
			'flex items-center gap-3 rounded-lg border-2 border-dashed transition',
			compact ? 'flex-row px-3 py-2' : 'flex-col justify-center p-4 text-center',
			dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface',
			disabled && 'opacity-60'
		]}
		ondragover={(e) => {
			e.preventDefault();
			if (!disabled) dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragging = false;
			pick(e.dataTransfer?.files ?? null);
		}}
	>
		<input
			bind:this={input}
			type="file"
			{multiple}
			class="hidden"
			accept={acceptAttr()}
			{disabled}
			data-testid={`${testid}-input`}
			onchange={(e) => {
				pick(e.currentTarget.files);
				e.currentTarget.value = '';
			}}
		/>
		<Btn {label} icon={Upload} variant="outline" colorScheme="neutral" size={compact ? 's' : 'm'} {disabled} onclick={() => input?.click()} data-testid={`${testid}-pick`} />
		<span class={['t-desc-l min-w-0 text-muted', compact ? 'flex-1' : 'max-md:hidden']}>{compact ? hintText : `или перетащите сюда · ${hintText}`}</span>
	</div>

	{#if queue.rows.length}
		<ul class="m-0 flex list-none flex-col gap-2 p-0" aria-live="polite" data-testid={`${testid}-rows`}>
			{#each queue.rows as row (row.id)}
				<li class="flex flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2" data-state={row.state}>
					<div class="flex items-center gap-2">
						<span class="t-body-m min-w-0 flex-1 truncate" title={row.file.name}>{row.file.name}</span>
						<span class="t-desc-l flex-none text-muted">{formatBytes(row.file.size)}</span>
						{#if row.state === 'error' && !row.rejected}
							<IconBtn icon={Refresh} label="Повторить" size="s" onclick={() => void queue.retry(row.id)} />
						{/if}
						{#if row.state === 'uploading'}
							<IconBtn icon={CloseSmall} label="Отменить загрузку" size="s" onclick={() => queue.cancel(row.id)} />
						{:else}
							<IconBtn icon={CloseSmall} label="Убрать из списка" size="s" onclick={() => queue.remove(row.id)} />
						{/if}
					</div>
					{#if row.state === 'uploading'}<Progress value={Math.round(row.progress * 100)} size="s" />{/if}
					{#if row.state === 'queued'}<span class="t-desc-l text-muted">Ожидает загрузки</span>{/if}
					{#if row.state === 'done'}<span class="t-desc-l text-success">Загружен</span>{/if}
					<!-- ошибка строки очереди: короткая подпись под именем файла, плашка Notice для неё слишком тяжёлая -->
					{#if row.error}<span class="t-desc-l text-danger" role="alert">{row.error}</span>{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
