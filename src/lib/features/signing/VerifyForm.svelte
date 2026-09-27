<script lang="ts">
	// Проверка без готовой ссылки: ввод идентификатора подписи или поиск по файлу (последнее — только для вошедших).
	import { goto } from '$app/navigation';
	import { Loader } from '@lct-testkit/rt-ui';
	import { ApiError } from '$lib/api';
	import Btn from '$lib/ui/Btn.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import { verifyByFile } from './api';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { verifyStatusMeta } from './status';
	import { isUuid } from './urls';
	import type { VerifyResult } from './types';

	let value = $state('');
	let error = $state<string | null>(null);

	let found = $state<VerifyResult | null>(null);
	let fileError = $state<string | null>(null);
	let needLogin = $state(false);
	let busy = $state(false);

	function submit() {
		const id = value.trim();
		if (!isUuid(id)) {
			error = 'Идентификатор выглядит так: 0192a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b';
			return;
		}
		void goto(`/verify/${id}`);
	}

	function clearFile() {
		found = null;
		fileError = null;
		needLogin = false;
	}

	async function byFile(picked: File) {
		found = null;
		fileError = null;
		needLogin = false;
		busy = true;
		try {
			found = await verifyByFile(picked);
		} catch (e) {
			if (e instanceof ApiError && (e.status === 401 || e.status === 403)) needLogin = true;
			else fileError = e instanceof ApiError ? e.detail : 'Не удалось проверить файл';
		} finally {
			busy = false;
		}
	}
</script>

<section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 max-md:p-4">
	<h1 class="t-h3 m-0">Проверка подписи</h1>
	<form
		class="flex flex-col gap-3"
		onsubmit={(e) => {
			e.preventDefault();
			submit();
		}}
	>
		<TextField label="Идентификатор подписи" required size="l" bind:value error={error ?? undefined} autocomplete="off" onInput={() => (error = null)} />
		<Btn type="submit" label="Проверить" size="l" block />
	</form>
</section>

<section class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-5 max-md:p-4" aria-label="Поиск по файлу">
	<h2 class="t-body-m-strong m-0">Найти подпись по файлу</h2>
	<FileField label="Выберите исходный PDF" disabled={busy} onPick={byFile} onClear={clearFile} />
	{#if busy}
		<p class="t-body-s m-0 flex items-center gap-2 text-muted" role="status"><Loader size="2xs" />Проверяем…</p>
	{:else if found}
		{@const meta = verifyStatusMeta(found.status)}
		<Notice class="shrink-0" tone={found.status === 'valid' ? 'success' : 'info'} title={meta.title}>
			{#if found.signer_display}{found.signer_display}<br />{/if}
			{#if found.signature_id}
				<a href="/verify/{found.signature_id}">Открыть результат</a>
			{:else if meta.hint}
				{meta.hint}
			{/if}
		</Notice>
	{:else if needLogin}
		<Notice class="shrink-0" tone="warning" role="alert">Поиск по файлу доступен после входа. <a href="/login?next=/verify">Войти</a></Notice>
	{:else if fileError}
		<Notice class="shrink-0" tone="error">{fileError}</Notice>
	{/if}
</section>
