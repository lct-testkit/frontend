<script lang="ts">
	// Карточка контакта: блоки «Место работы» и «Контактные данные» (телефон, e-mail; глаз в заголовке). Телефон и e-mail сервер отдаёт маскированными;
	// глаз в шапке блока раскрывает их вместе с каналами связи (запрос пишет доступ в журнал) и остаётся на месте: тот же глаз прячет значения обратно
	// без нового запроса. Раскрытые значения живут только на странице: уходишь — снова маски. Сделки и файлы контакта — ниже.
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Edit, PasswordHide, PasswordShow, Refresh } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { createPager } from '$lib/api/pager.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { EmptyState, ErrorState, IconBtn, Notice, Page, PageHeader, Skeleton, StatusChip, toast } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import { formatPhone } from '$lib/utils/format';
	import DealsTable from '../deals/list/DealsTable.svelte';
	import Attachments from '../files/Attachments.svelte';
	import Field from '../shared/Field.svelte';
	import { contactCache, contactFullName, orgCache, orgLabel } from '../shared/entityCache.svelte';
	import { CONTACT_CHANNEL_LABELS, CONTACT_METHOD_LABELS } from '../shared/labels';
	import { pushRecent } from '../recent/localRecent';
	import type { Contact, ContactChannel, Deal } from '../types';
	import ContactEditDrawer from './ContactEditDrawer.svelte';
	import { contactMark } from './contactHints';
	import ContactProductsCard from './ContactProductsCard.svelte';
	import LearnerProfileCard from './LearnerProfileCard.svelte';

	let { id }: { id: string } = $props();

	let contact = $state<Contact | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let editing = $state(false);
	let revealed = $state<{ email: string; phone: string; channels: ContactChannel[] } | null>(null);
	let revealing = $state(false);
	/** показаны ли раскрытые значения: скрыть можно без нового запроса, значения остаются в `revealed` */
	let showing = $state(false);

	async function load() {
		error = null;
		try {
			const c = await unwrap(api.GET('/api/contacts/{contact_id}', { params: { path: { contact_id: id } } }));
			contact = c;
			contactCache.put(c);
			orgCache.ensure([c.organization_id]);
			pushRecent(session.me?.id, { type: 'contact', id: c.id, title: contactFullName(c) });
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function reveal(): Promise<{ email: string; phone: string } | null> {
		if (revealing) return null;
		if (revealed) {
			showing = true;
			return { email: revealed.email, phone: revealed.phone };
		}
		revealing = true;
		try {
			const r = await unwrap(api.POST('/api/contacts/{contact_id}/reveal', { params: { path: { contact_id: id } } }));
			revealed = { email: r.email ?? '', phone: r.phone ?? '', channels: r.channels ?? [] };
			showing = true;
			toast.info('Доступ к данным записан в журнал');
			return { email: revealed.email, phone: revealed.phone };
		} catch (e) {
			toast.error(e);
			return null;
		} finally {
			revealing = false;
		}
	}

	const deals = createPager<Deal>(async (cursor, signal) =>
		unwrap(api.GET('/api/deals', { params: { query: { contact_id: id, limit: 25, cursor: cursor ?? undefined } }, signal }))
	);
	onMount(() => untrack(() => void deals.reload()));

	const canWrite = $derived(session.can('contact:write'));
	const canReveal = $derived(session.can('contact:reveal') && !contact?.is_anonymized);
	const shown = $derived(showing ? revealed : null);
	const mark = $derived(contact ? contactMark(contact) : null);
</script>

<svelte:head><title>{contact ? contactFullName(contact) : 'Контакт'} · RTK School</title></svelte:head>

<Page>
	{#if loading}
		<Skeleton kind="rows" rows={2} />
		<Skeleton kind="rows" rows={4} />
	{:else if error}
		<ErrorState {error} onRetry={load} />
	{:else if contact}
		<PageHeader title={contactFullName(contact)} back="/contacts" primary={session.can('deal:create') ? { label: 'Новая сделка', onclick: () => goto(`/deals?new=1&contact=${contact!.id}${contact!.organization_id ? `&org=${contact!.organization_id}` : ''}`) } : undefined}>
			{#snippet meta()}
				{#if mark}<StatusChip label={mark.label} tone={mark.tone} hint={mark.hint} />{/if}
			{/snippet}
			{#snippet actions()}
				<IconBtn icon={Refresh} label="Обновить" onclick={load} />
				{#if canWrite && !contact!.is_anonymized}<IconBtn icon={Edit} label="Редактировать" onclick={() => (editing = true)} data-testid="contact-edit" />{/if}
			{/snippet}
		</PageHeader>

		{#if contact.is_anonymized}
			<Notice class="shrink-0">Контакт обезличен: персональные данные удалены.</Notice>
		{/if}

		<div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 max-xl:grid-cols-1">
			<div class="flex min-w-0 flex-col gap-4">
				<Card title="Место работы">
					<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-4 max-md:grid-cols-1">
						<Field label="Организация">
							{#if contact.organization_id}<a href="/organizations/{contact.organization_id}">{orgLabel(contact.organization_id)}</a>{:else}—{/if}
						</Field>
						<Field label="Должность">{contact.position ?? '—'}</Field>
					</dl>
				</Card>

				<Card title="Контактные данные">
					{#snippet action()}
						{#if canReveal}
							<IconBtn
								icon={shown ? PasswordHide : PasswordShow}
								label={shown ? 'Скрыть контактные данные' : 'Показать контактные данные'}
								variant="outline"
								disabled={revealing}
								onclick={() => (shown ? (showing = false) : reveal())}
								data-testid="contact-reveal"
							/>
						{/if}
					{/snippet}
					<dl class="m-0 grid grid-cols-2 gap-x-6 gap-y-4 max-md:grid-cols-1">
						<Field label="Телефон">{shown ? formatPhone(shown.phone) : formatPhone(contact.phone)}</Field>
						<Field label="E-mail">{shown ? shown.email || '—' : (contact.email ?? '—')}</Field>
						{#if contact.contact_methods?.length}
							<Field label="Предпочитаемая связь">{contact.contact_methods.map((m) => CONTACT_METHOD_LABELS[m] ?? m).join(', ')}</Field>
						{/if}
						{#if shown}
							{#each shown.channels as ch (ch.id)}
								<Field label={CONTACT_CHANNEL_LABELS[ch.type] ?? ch.type}>{ch.value}{ch.is_primary ? ' · основной' : ''}</Field>
							{/each}
						{/if}
					</dl>
					{#if canReveal}
						<p class="t-desc-l m-0 mt-4 text-muted">
							{shown ? 'Данные показаны полностью. Глаз скроет их снова.' : 'Данные скрыты. Глаз покажет их полностью, обращение записывается в журнал.'}
						</p>
					{/if}
				</Card>
			</div>

			<Card title="Сделки" flush>
				{#if !deals.loading && deals.items.length === 0}
					<EmptyState title="Сделок нет" compact />
				{:else}
					<DealsTable pager={deals} compact embedded />
				{/if}
			</Card>
		</div>

		<ContactProductsCard contactId={contact.id} />
		{#if !contact.is_anonymized}<LearnerProfileCard contactId={contact.id} />{/if}

		<Card title="Файлы">
			<Attachments entityType="contact" entityId={contact.id} canEdit={session.can('file:upload')} about="по контакту" />
		</Card>

		<ContactEditDrawer
			open={editing}
			{contact}
			onReveal={reveal}
			onClose={() => (editing = false)}
			onSaved={(c) => ((contact = c), contactCache.put(c), (editing = false))}
			onConflict={load}
		/>
	{/if}
</Page>
