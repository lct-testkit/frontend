<script lang="ts">
	// Экран подписи документа: сведения → просмотр PDF → подписанты → «Подписать» (код) / «Отклонить».
	// Один компонент для внешнего подписанта (/sign/[token]) и сотрудника (/signing/requests/[id]).
	import { onMount, tick } from 'svelte';
	import { TimeStroke } from '@lct-testkit/rt-ui/icons';
	import { errorMessage } from '$lib/api';
	import { AreaField, FormModal } from '$lib/ui';
	import Btn from '$lib/ui/Btn.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import ErrorState from '$lib/ui/ErrorState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { formatDate } from '$lib/utils/format';
	import OtpPanel from './OtpPanel.svelte';
	import PdfViewer from './PdfViewer.svelte';
	import SignOutcome from './SignOutcome.svelte';
	import SignerList from './SignerList.svelte';
	import type { SignSession } from './sign-session.svelte';
	import { docTypeLabel, signerProgress } from './status';
	import { shortHash } from './urls';

	let { session, backHref }: { session: SignSession; backHref?: string } = $props();

	let rejectOpen = $state(false);
	let reason = $state('');
	let rejectError = $state<string | null>(null);
	let panel = $state<HTMLElement>();

	onMount(() => void session.load());

	const page = $derived(session.page);
	const progress = $derived(page ? signerProgress(page.signers) : null);
	const deadlineSoon = $derived(!!page?.document.deadline_at && new Date(page.document.deadline_at).getTime() - Date.now() < 48 * 3_600_000);

	// панель кода растёт, когда приходит ответ (появляется демо-подсказка): подводим экран к ней после каждого изменения
	$effect(() => {
		if (session.phase !== 'otp') return;
		void session.challenge;
		void tick().then(() => panel?.scrollIntoView({ behavior: 'smooth', block: 'end' }));
	});

	async function reject() {
		if (reason.trim().length < 3) {
			rejectError = 'Укажите причину (не короче 3 символов)';
			return;
		}
		try {
			await session.reject(reason);
			rejectOpen = false;
		} catch (e) {
			rejectError = errorMessage(e);
			toast.error(e);
		}
	}
</script>

{#if session.phase === 'loading'}
	<div class="flex flex-col gap-4" aria-busy="true" aria-label="Загрузка документа">
		<div class="rounded-lg border border-line bg-surface p-4"><Skeleton kind="lines" rows={3} /></div>
		<Skeleton kind="tile" rows={1} height={420} />
	</div>
{:else if session.phase === 'failed'}
	<ErrorState error={session.loadError} onRetry={() => session.load()} />
{:else if (session.phase === 'done' || session.phase === 'closed') && session.outcome}
	<SignOutcome outcome={session.outcome} title={page?.document.title} note={session.note} signature={session.signature} {backHref} />
{:else if page}
	<div class="flex flex-col gap-4 max-md:gap-3" data-testid="sign-flow">
		<header class="flex flex-col gap-1 rounded-lg border border-line bg-surface p-4 max-md:p-3">
			<span class="t-desc-l text-muted">{docTypeLabel(page.document.doc_type)}</span>
			<h1 class="t-h2 max-md:t-h3 m-0 break-words">{page.document.title}</h1>
			{#if page.document.deadline_at}
				<span class={['t-desc-l inline-flex items-center gap-1', deadlineSoon ? 'text-warning' : 'text-muted']}>
					<TimeStroke size={16} class="fill-current" />
					Подписать до {formatDate(page.document.deadline_at)}
				</span>
			{/if}
		</header>

		<PdfViewer url={page.document.preview_url} />

		<section class="flex flex-col rounded-lg border border-line bg-surface px-4 py-2 max-md:px-3" aria-label="Подписанты">
			<div class="flex items-baseline gap-2 py-1">
				<h2 class="t-body-m-strong m-0">Подписанты</h2>
				{#if progress}<span class="t-desc-l text-muted">подписали {progress.signed} из {progress.total}</span>{/if}
			</div>
			<SignerList signers={page.signers} />
		</section>

		<details open class="rounded-lg border border-line bg-surface px-4 py-3 max-md:px-3">
			<summary class="t-body-m cursor-pointer text-muted select-none">Условия подписания</summary>
			<div class="mt-3 flex flex-col gap-3">
				<p class="t-body-s m-0 whitespace-pre-line text-muted">{page.agreement_text}</p>
				<div class="flex items-center gap-2 border-t border-line pt-3">
					<span class="t-desc-l text-muted">SHA-256</span>
					<code class="t-desc-l min-w-0 flex-1 truncate" title={page.document.content_hash}>{shortHash(page.document.content_hash, 12, 8)}</code>
					<CopyButton value={page.document.content_hash} label="Копировать хэш" />
				</div>
			</div>
		</details>

		{#if session.phase === 'otp'}
			<div bind:this={panel} class="max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mx-3 max-md:-mb-3"><OtpPanel {session} /></div>
		{:else}
			<!-- the MAIN button first (as in every form), on the left; on a phone the bar sticks to the bottom and the main button is on the right, at the thumb -->
			<div class="sticky bottom-0 z-10 flex gap-3 border-t border-line bg-page px-3 py-3 max-md:-mx-3 max-md:flex-row-reverse md:static md:border-0 md:bg-transparent md:p-0">
				<Btn label="Подписать" size="l" class="max-md:flex-1" loading={session.busy} onclick={() => session.start()} data-testid="sign-start" />
				<Btn label="Отклонить" variant="outline" colorScheme="neutral" size="l" onclick={() => ((reason = ''), (rejectError = null), (rejectOpen = true))} />
			</div>
		{/if}
	</div>

	<FormModal open={rejectOpen} title="Отклонить документ" size="s" saveLabel="Отклонить" danger saveTestId="reject-confirm" saving={session.busy} dirty={rejectOpen && reason.trim().length > 0} onSave={reject} onClose={() => (rejectOpen = false)}>
		<AreaField label="Причина" rows={3} value={reason} error={rejectError ?? undefined} onInput={(v) => ((reason = v), (rejectError = null))} />
	</FormModal>
{/if}
