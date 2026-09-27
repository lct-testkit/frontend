<script lang="ts">
	const ORG_TABS = [
		{ key: 'reqs', label: 'Реквизиты' },
		{ key: 'contacts', label: 'Контакты' },
		{ key: 'deals', label: 'Сделки' },
		{ key: 'licenses', label: 'Лицензии' },
		{ key: 'files', label: 'Файлы' }
	];
	// Карточка организации: реквизиты (с пометками «из ЕГРЮЛ» / «изменено вручную»), баннер расхождений с реестром, риск ликвидации,
	// вкладки «Реквизиты / Контакты / Сделки / Файлы». Для ИП телефон и e-mail маскированы — «Показать» пишет доступ в журнал.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Refresh } from '@lct-testkit/rt-ui/icons';
	import { ApiError, api, errorMessage, ifMatch, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, ErrorState, IconBtn, Notice, Page, PageHeader, Skeleton, StatusChip, TabsBar, Term, toast } from '$lib/ui';
	import Card from '$lib/ui/Card.svelte';
	import { formatDate } from '$lib/utils/format';
	import { setQuery } from '$lib/utils/query-state.svelte';
	import Attachments from '../files/Attachments.svelte';
	import { pushRecent } from '../recent/localRecent';
	import { orgCache, orgTitle } from '../shared/entityCache.svelte';
	import { registryStatusHint } from '../shared/hints';
	import { ORG_TYPE_LABELS, REGISTRY_STATUS_LABELS, REGISTRY_STATUS_SCHEMES } from '../shared/labels';
	import type { Organization } from '../types';
	import DriftBanner from './DriftBanner.svelte';
	import OrgForm from './OrgForm.svelte';
	import OrgLicenses from './OrgLicenses.svelte';
	import OrgLinked from './OrgLinked.svelte';
	import { emptyOrgForm, formFromOrg, toPatchBody, type OrgFormValues } from './orgUtils';

	let { id }: { id: string } = $props();

	let org = $state<Organization | null>(null);
	let loading = $state(true);
	let error = $state<unknown>(null);
	let base = emptyOrgForm();
	let values = $state<OrgFormValues>(emptyOrgForm());
	let errors = $state<Record<string, string>>({});
	let saving = $state(false);
	let banner = $state<{ text: string; conflict: boolean } | null>(null);
	let hideDrift = $state(false);

	const TABS = ['reqs', 'contacts', 'deals', 'licenses', 'files'] as const;
	const tab = $derived.by(() => {
		const raw = page.url.searchParams.get('tab');
		return (TABS as readonly string[]).includes(raw ?? '') ? (raw as (typeof TABS)[number]) : 'reqs';
	});
	const setTab = (t: string) => setQuery({ tab: t === 'reqs' ? null : t }, { push: true });

	const canWrite = $derived(session.can('organization:write'));
	const dirty = $derived(Object.keys(toPatchBody(base, values)).length > 0);
	const risk = $derived(org?.registry_status === 'liquidating' || org?.registry_status === 'liquidated');

	function adopt(next: Organization, keepEdits = false) {
		const edits = keepEdits ? toPatchBody(base, values) : {};
		org = next;
		base = formFromOrg(next);
		values = { ...base, ...(edits as Partial<OrgFormValues>) };
		orgCache.put(next);
	}

	async function load(keepEdits = false) {
		error = null;
		try {
			const next = await unwrap(api.GET('/api/organizations/{organization_id}', { params: { path: { organization_id: id } } }));
			adopt(next, keepEdits);
			pushRecent(session.me?.id, { type: 'organization', id: next.id, title: orgTitle(next) });
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function save() {
		if (!org || saving || !dirty) return;
		saving = true;
		banner = null;
		errors = {};
		try {
			adopt(await unwrap(api.PATCH('/api/organizations/{organization_id}', { params: { path: { organization_id: id } }, headers: ifMatch(org.version), body: toPatchBody(base, values) })));
			toast.success('Реквизиты сохранены');
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) banner = { text: 'Организация изменена другим пользователем. Обновите данные — введённое сохранится.', conflict: true };
			else if (e instanceof ApiError && e.isValidation && Object.keys(e.fieldErrors()).length) errors = e.fieldErrors();
			else banner = { text: errorMessage(e), conflict: false };
		} finally {
			saving = false;
		}
	}

	async function reveal() {
		try {
			const r = await unwrap(api.POST('/api/organizations/{organization_id}/reveal', { params: { path: { organization_id: id } } }));
			base = { ...base, main_phone: r.main_phone ?? '', main_email: r.main_email ?? '' };
			values = { ...values, main_phone: r.main_phone ?? '', main_email: r.main_email ?? '' };
			toast.info('Доступ к данным записан в журнал');
		} catch (e) {
			toast.error(e);
		}
	}

	const reset = () => (values = { ...base });
</script>

<svelte:head><title>{org ? orgTitle(org) : 'Организация'} · RTK School</title></svelte:head>

<Page>
	{#if loading}
		<Skeleton kind="rows" rows={2} />
		<Skeleton kind="rows" rows={6} />
	{:else if error}
		<ErrorState {error} onRetry={() => load()} />
	{:else if org}
		<PageHeader title={orgTitle(org)} back="/organizations" primary={session.can('deal:create') ? { label: 'Новая сделка', onclick: () => goto(`/deals?new=1&org=${org!.id}`), testid: 'org-new-deal' } : undefined}>
			{#snippet meta()}
				<StatusChip label={ORG_TYPE_LABELS[org!.org_type] ?? org!.org_type} tone="neutral" />
				{#if org!.registry_status}<StatusChip label={REGISTRY_STATUS_LABELS[org!.registry_status!] ?? org!.registry_status!} tone={REGISTRY_STATUS_SCHEMES[org!.registry_status!] ?? 'neutral'} hint={registryStatusHint(org!.registry_status!)} />{/if}
				{#if org!.is_accredited}<StatusChip label={org!.accreditation_until ? `Аккредитация до ${formatDate(org!.accreditation_until)}` : 'Аккредитована'} tone="info" />{/if}
			{/snippet}
			{#snippet actions()}
				<IconBtn icon={Refresh} label="Обновить" onclick={() => load()} />
			{/snippet}
		</PageHeader>
		<p class="t-body-s m-0 -mt-2 flex flex-wrap gap-x-4 text-muted max-md:t-desc-l">
			{#if org.inn}<span><Term term="ИНН" /> {org.inn}</span>{/if}
			{#if org.registry_checked_at}<span>проверено по <Term term="ЕГРЮЛ" /> {formatDate(org.registry_checked_at)}</span>{/if}
		</p>

		{#if risk}
			<Notice class="shrink-0" tone="error" role="alert">
				Юридический риск: организация {org.registry_status === 'liquidated' ? 'ликвидирована' : 'ликвидируется'}. Проверьте активные сделки.
			</Notice>
		{/if}
		{#if org.requisites_drift && !hideDrift}
			<DriftBanner {org} canApply={canWrite} onApplied={(o) => adopt(o, true)} onConflict={() => load(true)} onHide={() => (hideDrift = true)} />
		{/if}

		<TabsBar items={ORG_TABS} value={tab} onChange={setTab} label="Разделы организации" />

		{#if tab === 'reqs'}
			<Card>
				<div class="flex max-w-3xl flex-col gap-4">
					{#if banner}
						<Notice class="shrink-0" tone={banner.conflict ? 'warning' : 'error'} role="alert" actions={banner.conflict ? [{ label: 'Обновить', onclick: () => ((banner = null), load(true)) }] : []}>{banner.text}</Notice>
					{/if}
					<OrgForm bind:values {errors} {org} innReadonly canOwner={session.can('deal:reassign')} disabled={!canWrite || saving} onReveal={reveal} onEnter={save} />
					{#if canWrite && dirty}
						<div class="flex justify-end gap-2">
							<Btn label="Отмена" variant="ghost" colorScheme="neutral" onclick={reset} />
							<Btn label="Сохранить" loading={saving} onclick={save} data-testid="org-save" />
						</div>
					{/if}
				</div>
			</Card>
		{:else if tab === 'contacts'}
			<OrgLinked orgId={org.id} kind="contacts" />
		{:else if tab === 'deals'}
			<OrgLinked orgId={org.id} kind="deals" />
		{:else if tab === 'licenses'}
			<OrgLicenses orgId={org.id} />
		{:else}
			<Attachments entityType="organization" entityId={org.id} canEdit={session.can('file:upload')} about="по организации" />
		{/if}
	{/if}
</Page>
