<script lang="ts">
	// Результат проверки подписи по идентификатору + сверка файла хэшем прямо в браузере (файл на сервер не уходит).
	import type { Component } from 'svelte';
	import { goto } from '$app/navigation';
	import { Loader } from '@lct-testkit/rt-ui';
	import { AttentionMark, CheckLarge, CloseLarge, StopStroke } from '@lct-testkit/rt-ui/icons';
	import { ApiError } from '$lib/api';
	import Btn from '$lib/ui/Btn.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { verifyById } from './api';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import { hashesEqual, sha256HexOfBlob } from './hash';
	import { verifyStatusMeta } from './status';
	import { shortHash } from './urls';
	import type { VerifyResult } from './types';

	let { id }: { id: string } = $props();

	let result = $state<VerifyResult | null>(null);
	let error = $state<unknown>(null);
	let loading = $state(true);

	let fileHash = $state<string | null>(null);
	let hashing = $state(false);

	async function load() {
		loading = true;
		error = null;
		try {
			result = await verifyById(id);
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	$effect(() => {
		void id;
		fileHash = null;
		void load();
	});

	function clearFile() {
		fileHash = null;
	}

	async function check(picked: File) {
		fileHash = null;
		hashing = true;
		try {
			fileHash = await sha256HexOfBlob(picked);
		} finally {
			hashing = false;
		}
	}

	const meta = $derived(result ? verifyStatusMeta(result.status) : null);
	const documentHash = $derived(result?.document_hash ?? null);
	const matches = $derived(fileHash && documentHash ? hashesEqual(fileHash, documentHash) : null);
	const rateLimited = $derived(error instanceof ApiError && error.status === 429);

	type Tone = 'success' | 'danger' | 'warning' | 'neutral';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const HERO: Record<string, { tone: Tone; icon: Component<any> }> = {
		valid: { tone: 'success', icon: CheckLarge },
		disputed: { tone: 'warning', icon: AttentionMark },
		void: { tone: 'neutral', icon: StopStroke },
		not_found: { tone: 'danger', icon: CloseLarge },
		hash_mismatch: { tone: 'danger', icon: CloseLarge }
	};
	const BG: Record<Tone, string> = { success: 'bg-success-soft', danger: 'bg-danger-soft', warning: 'bg-warning-soft', neutral: 'bg-neutral-soft' };
	const FG: Record<Tone, string> = { success: 'fill-success', danger: 'fill-danger', warning: 'fill-warning', neutral: 'fill-muted' };
	const hero = $derived(HERO[result?.status ?? 'not_found'] ?? HERO.not_found);
	const HeroIcon = $derived(hero.icon);

	const METHOD: Record<string, string> = { pep_otp: 'Простая электронная подпись, одноразовый код', pep: 'Простая электронная подпись' };
</script>

{#if loading}
	<div class="rounded-lg border border-line bg-surface p-5" aria-busy="true"><Skeleton kind="lines" rows={5} /></div>
{:else if error}
	<ErrorState {error} onRetry={rateLimited ? undefined : load} />
{:else if result && meta}
	<section class="flex flex-col overflow-hidden rounded-lg border border-line bg-surface" data-testid="verify-result" data-status={result.status}>
		<!-- шапка результата проверки (крупный значок + заголовок H1): страница-результат, а не сообщение — Notice не подходит -->
		<div class={['flex items-center gap-4 p-5 max-md:gap-3 max-md:p-4', BG[hero.tone]]}>
			<span class="inline-flex size-14 flex-none items-center justify-center rounded-full bg-surface max-md:size-12">
				<HeroIcon size={30} class={FG[hero.tone]} />
			</span>
			<div class="min-w-0">
				<h1 class="t-h3 m-0">{meta.title}</h1>
				{#if meta.hint}<p class="t-body-s m-0 mt-1 text-muted">{meta.hint}</p>{/if}
			</div>
		</div>

		{#if result.status !== 'not_found'}
			<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 p-5 max-md:grid-cols-1 max-md:gap-y-1 max-md:p-4">
				{#if result.signer_display}
					<dt class="t-desc-l text-muted">Подписант</dt>
					<dd class="t-body-m m-0 mb-2 break-words md:mb-0">{result.signer_display}</dd>
				{/if}
				{#if result.signed_at}
					<dt class="t-desc-l text-muted">Дата и время</dt>
					<dd class="t-body-m m-0 mb-2 md:mb-0" title={new Date(result.signed_at).toISOString()}>{formatDateTime(result.signed_at)}</dd>
				{/if}
				{#if result.method}
					<dt class="t-desc-l text-muted">Способ</dt>
					<dd class="t-body-m m-0 mb-2 md:mb-0">{METHOD[result.method] ?? result.method}</dd>
				{/if}
				<dt class="t-desc-l text-muted">Подпись</dt>
				<dd class="m-0 mb-2 flex items-center gap-1 md:mb-0">
					<code class="t-desc-l min-w-0 truncate" title={id}>{shortHash(id, 8, 6)}</code>
					<CopyButton value={id} label="Копировать идентификатор" />
				</dd>
				{#if documentHash}
					<dt class="t-desc-l text-muted">Хэш документа</dt>
					<dd class="m-0 flex items-center gap-1">
						<code class="t-desc-l min-w-0 truncate" title={documentHash}>{shortHash(documentHash, 12, 8)}</code>
						<CopyButton value={documentHash} label="Копировать хэш" />
					</dd>
				{/if}
			</dl>
		{/if}
	</section>

	{#if documentHash}
		<section class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3" aria-label="Сверка файла">
			<h2 class="t-body-m-strong m-0">Сверить файл</h2>
			<FileField label="Выберите PDF или перетащите его сюда" disabled={hashing} onPick={check} onClear={clearFile} />
			{#if hashing}
				<p class="t-body-s m-0 flex items-center gap-2 text-muted" role="status"><Loader size="2xs" />Считаем хэш…</p>
			{:else if matches !== null}
				<Notice class="shrink-0" tone={matches ? 'success' : 'error'} role="status" title={matches ? 'Хэш совпадает: это тот самый документ' : 'Хэш не совпадает: файл изменён или это другой документ'} data-testid="hash-result" data-match={matches}>
					{#if !matches}Проверяйте исходный PDF: у копии со штампом другой хэш.<br />{/if}
					Файл не покидает устройство · <code>{shortHash(fileHash ?? '', 8, 6)}</code>
				</Notice>
			{/if}
		</section>
	{/if}

	<div class="flex justify-center">
		<Btn label="Проверить другую подпись" variant="ghost" colorScheme="neutral" onclick={() => goto('/verify')} />
	</div>
{/if}
