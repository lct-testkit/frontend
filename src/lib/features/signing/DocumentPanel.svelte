<script lang="ts">
	// Документ на подписи: статус, подписанты, действия по статусу и правам. Один вид для карточки сделки (`compact`)
	// и для страницы документа.
	import { goto } from '$app/navigation';
	import { Download, Pen, Send, Stop, ArrowRight } from '@lct-testkit/rt-ui/icons';
	import { session } from '$lib/auth/session.svelte';
	import { roleLabel } from '../identity/labels';
	import ReasonModal from '../identity/ReasonModal.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { toast } from '$lib/ui/toast.svelte';
	import { formatDate, formatDateTime } from '$lib/utils/format';
	import { protocolLink, sendDocument, signedContainerLink, voidDocument } from './api';
	import { putDocument } from './known';
	import SignLinkModal from './SignLinkModal.svelte';
	import SignerList from './SignerList.svelte';
	import { docStatusMeta, docTypeLabel, documentActions, requestStatusMeta } from './status';
	import { DOC_STATUS_HINTS } from './hints';
	import type { SignLink, SignatureDocument } from './types';

	interface Props {
		doc: SignatureDocument;
		/** в карточке сделки: заголовок ведёт на страницу документа, без хэша и хронологии */
		compact?: boolean;
		onChange?: (doc: SignatureDocument) => void;
		/** «Отправить заново» — создаёт новый документ; форму открывает родитель */
		onRecreate?: (doc: SignatureDocument) => void;
	}

	let { doc, compact = false, onChange, onRecreate }: Props = $props();

	let voidOpen = $state(false);
	let links = $state<SignLink[]>([]);
	let linksOpen = $state(false);
	let sending = $state(false);

	const status = $derived(docStatusMeta(doc.status));
	const requests = $derived(doc.requests ?? []);
	const meId = $derived(session.me?.id ?? null);
	const act = $derived(documentActions(doc.status, { create: session.can('signature:create'), void: session.can('signature:void') }));
	const mine = $derived(requests.find((r) => r.signer_user_id === meId && (r.status === 'sent' || r.status === 'viewed')));
	const externalContact = $derived(requests.find((r) => r.signer_type === 'external')?.signer_contact_id ?? null);
	const rejected = $derived(requests.filter((r) => r.status === 'rejected' && r.reject_reason));
	const meta = $derived(
		[docTypeLabel(doc.doc_type), `создан ${formatDate(doc.created_at)}`, !status.terminal && doc.deadline_at ? `до ${formatDate(doc.deadline_at)}` : null].filter(Boolean).join(' · ')
	);

	const signers = $derived(
		requests.map((r) => ({
			name: r.signer_name_snapshot,
			sign_order: r.sign_order,
			status: r.status,
			is_me: !!meId && r.signer_user_id === meId,
			hint: [r.signer_type === 'external' ? 'Контрагент' : r.signer_role_code ? roleLabel(r.signer_role_code) : null, r.signer_identifier_masked].filter(Boolean).join(' · ')
		}))
	);

	function apply(next: SignatureDocument) {
		putDocument(next);
		onChange?.(next);
	}

	async function send() {
		sending = true;
		try {
			const next = await sendDocument(doc.id);
			apply(next);
			const fresh = (next.requests ?? []).filter((r) => r.sign_url).map((r) => ({ name: r.signer_name_snapshot, url: r.sign_url! }));
			if (next.status === 'blocked_no_agreement') toast.warning('Нет соглашения об ЭДО', 'Оформите его и отправьте документ снова');
			else toast.success('Отправлено на подпись');
			if (fresh.length) {
				links = fresh;
				linksOpen = true;
			}
		} catch (e) {
			toast.error(e);
		} finally {
			sending = false;
		}
	}

	async function protocol() {
		try {
			window.open(await protocolLink(doc.id), '_blank', 'noopener');
		} catch (e) {
			toast.error(e, 'Протокол недоступен');
		}
	}

	// Отдельная от протокола кнопка: это единственный файл на странице, который проходит
	// «Найти подпись по файлу» (см. `signedContainerLink`) — без неё пользователь видел только
	// протокол и детерминированно получал hash_mismatch, пытаясь проверить именно им.
	async function signedContainer() {
		try {
			window.open(await signedContainerLink(doc), '_blank', 'noopener');
		} catch (e) {
			toast.error(e, 'Файл недоступен');
		}
	}

	async function doVoid(reason: string) {
		apply(await voidDocument(doc.id, reason));
		voidOpen = false;
		toast.success('Документ аннулирован');
	}
</script>

<article class="flex flex-col gap-3 rounded-lg border border-line bg-surface p-4 max-md:p-3" data-testid="document-panel" data-status={doc.status}>
	<header class="flex flex-wrap items-start gap-x-3 gap-y-1">
		<div class="min-w-0 flex-1">
			{#if compact}
				<a class="t-body-m-strong block break-words text-fg hover:text-accent" href="/signing/{doc.id}">{doc.title}</a>
			{:else}
				<h2 class="t-h4 m-0 break-words">{doc.title}</h2>
			{/if}
			<p class="t-desc-l m-0 text-muted">{meta}</p>
		</div>
		<StatusChip label={status.label} tone={status.tone} hint={DOC_STATUS_HINTS[doc.status as keyof typeof DOC_STATUS_HINTS]} />
	</header>

	{#if doc.status === 'blocked_no_agreement'}
		<Notice class="shrink-0"
			tone="warning"
			actions={session.can('edm:admin') && externalContact ? [{ label: 'Оформить соглашение', onclick: () => void goto(`/admin/edm?party_type=contact&party_id=${externalContact}&new=1`) }] : []}
			>Нет соглашения об ЭДО с контрагентом: без него внешняя подпись заблокирована.</Notice
		>
	{:else if doc.status === 'void' && doc.void_reason}
		<Notice class="shrink-0" tone="info">Причина аннулирования: {doc.void_reason}</Notice>
	{/if}
	{#each rejected as r (r.id)}
		<Notice class="shrink-0" tone="error">{r.signer_name_snapshot} отклонил(а): {r.reject_reason}</Notice>
	{/each}

	{#if signers.length}<SignerList {signers} />{/if}

	{#if !compact}
		<dl class="m-0 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 border-t border-line pt-3 max-md:grid-cols-1">
			<dt class="t-desc-l text-muted">SHA-256</dt>
			<dd class="m-0 flex items-center gap-1">
				<code class="t-desc-l min-w-0 flex-1 break-all">{doc.content_hash}</code>
				<CopyButton value={doc.content_hash} label="Копировать хэш" />
			</dd>
			{#each requests.filter((r) => r.sent_at) as r (r.id)}
				<dt class="t-desc-l text-muted">{r.signer_name_snapshot}</dt>
				<dd class="t-desc-l m-0 mb-1 md:mb-0">
					{requestStatusMeta(r.status).label}{#if r.decided_at}, {formatDateTime(r.decided_at)}{:else if r.viewed_at}, открыл {formatDateTime(r.viewed_at)}{:else if r.sent_at}, отправлено {formatDateTime(r.sent_at)}{/if}
				</dd>
			{/each}
			{#if doc.entity_type === 'deal'}
				<dt class="t-desc-l text-muted">Сделка</dt>
				<dd class="t-desc-l m-0"><a href="/deals/{doc.entity_id}">Открыть сделку</a></dd>
			{/if}
		</dl>
	{/if}

	{#if act.canSend || mine || act.canProtocol || act.canSignedContainer || act.canVoid || act.canRecreate || compact}
		<footer class="flex flex-wrap items-center gap-2">
			{#if mine}
				<Btn label="Подписать" icon={Pen} onclick={() => goto(`/signing/requests/${mine.id}`)} data-testid="doc-sign" />
			{/if}
			{#if act.canSend}
				<Btn label={doc.status === 'blocked_no_agreement' ? 'Отправить повторно' : 'Отправить'} icon={Send} loading={sending} onclick={send} data-testid="doc-send" />
			{/if}
			{#if act.canRecreate && onRecreate}
				<Btn label="Отправить заново" variant="secondary" colorScheme="neutral" onclick={() => onRecreate(doc)} />
			{/if}
			<span class="ml-auto flex items-center gap-1">
				{#if act.canSignedContainer}<IconBtn icon={Download} label="Контейнер подписи (для проверки)" onclick={signedContainer} />{/if}
				{#if act.canProtocol}<IconBtn icon={Download} label="Протокол подписания" onclick={protocol} />{/if}
				{#if act.canVoid}<IconBtn icon={Stop} label="Аннулировать" danger onclick={() => (voidOpen = true)} />{/if}
				{#if compact}<IconBtn icon={ArrowRight} label="Открыть документ" onclick={() => goto(`/signing/${doc.id}`)} />{/if}
			</span>
		</footer>
	{/if}
</article>

<ReasonModal
	open={voidOpen}
	title="Аннулировать документ"
	confirmLabel="Аннулировать"
	danger
	note="Подписи и запросы будут закрыты, документ останется в истории."
	onSubmit={doVoid}
	onClose={() => (voidOpen = false)}
/>
<SignLinkModal open={linksOpen} {links} onClose={() => (linksOpen = false)} />
