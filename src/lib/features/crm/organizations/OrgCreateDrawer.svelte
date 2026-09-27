<script lang="ts">
	// Новая организация: «ИНН или название» → выбор из реестра → форма с подставленными данными → создание.
	// Дубли по ИНН/названию проверяются по мере ввода; создание защищено Idempotency-Key.
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { api, ApiError, errorMessage, idem, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, FormDrawer, Notice, toast } from '$lib/ui';
	import { debounce } from '$lib/utils/debounce';
	import OrgLookup from '../lookup/OrgLookup.svelte';
	import type { OrgLookupEntry } from '../lookup/lookupState.svelte';
	import { normalizeRequisite, validateInn, validateKpp, validateOgrnAny } from '../requisites/validators';
	import type { DuplicateCandidate, Organization } from '../types';
	import OrgForm from './OrgForm.svelte';
	import { emptyOrgForm, formFromDetails, guessOrgType, toCreateBody, type OrgFormValues } from './orgUtils';

	interface Props {
		open: boolean;
		onClose: () => void;
		onCreated: (org: Organization) => void;
		/** ИНН из ссылки (`?new=1&inn=…`) — сразу ищем */
		prefillInn?: string;
	}

	let { open, onClose, onCreated, prefillInn = '' }: Props = $props();

	let step = $state<'lookup' | 'form'>('lookup');
	let values = $state<OrgFormValues>(emptyOrgForm());
	let errors = $state<Record<string, string>>({});
	let busy = $state(false);
	let failure = $state<string | null>(null);
	let fromRegistry = $state(false);
	let duplicates = $state<DuplicateCandidate[]>([]);
	/** гонка: другой пользователь успел создать организацию с этим ИНН (409 CRM-1302) */
	let conflict = $state<{ id: string; deleted: boolean } | null>(null);
	let lookupKey = $state(0);
	let key = crypto.randomUUID();
	let keySig = '';

	$effect(() => {
		if (!open) return;
		untrack(() => {
			step = prefillInn ? 'form' : 'lookup';
			values = { ...emptyOrgForm(), inn: prefillInn, owner_id: null };
			errors = {};
			failure = null;
			fromRegistry = false;
			duplicates = [];
			conflict = null;
			lookupKey += 1;
			key = crypto.randomUUID();
			keySig = '';
		});
	});

	let dupSeq = 0;
	const check = debounce(async (inn: string, name: string) => {
		const mine = ++dupSeq;
		try {
			const res = await unwrap(api.GET('/api/organizations/check-duplicate', { params: { query: { inn: inn || undefined, name: name || undefined } } }));
			if (mine === dupSeq) duplicates = res.candidates ?? [];
		} catch {
			if (mine === dupSeq) duplicates = [];
		}
	}, 400);

	$effect(() => {
		if (!open || step !== 'form') return;
		const inn = normalizeRequisite(values.inn);
		const name = values.name.trim();
		const validInn = (inn.length === 10 || inn.length === 12) && validateInn(inn).ok;
		if (validInn || name.length >= 4) check(validInn ? inn : '', name);
		else duplicates = [];
	});

	const sameInn = $derived(duplicates.find((c) => c.match === 'inn'));
	// Без ИНН сервер отказывает при полном совпадении названия (409 CRM-1301, `match: same_name`): создать вторую карточку нельзя
	const sameName = $derived(duplicates.find((c) => (c.match as string) === 'same_name'));
	const similar = $derived(duplicates.filter((c) => c.match === 'similar_name'));
	const blocked = $derived(!!sameInn || !!sameName || !!conflict);
	const dirty = $derived(open && step === 'form' && JSON.stringify(values) !== JSON.stringify({ ...emptyOrgForm(), inn: prefillInn, owner_id: null }));

	function picked(entry: OrgLookupEntry) {
		values = entry.details
			? { ...values, ...formFromDetails(entry.details) }
			: { ...values, inn: entry.inn, name: entry.name, org_type: guessOrgType(entry.name, entry.inn) };
		fromRegistry = !!entry.details;
		step = 'form';
	}

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (!values.name.trim() && !values.inn.trim()) next.name = 'Введите название или ИНН';
		if (values.inn.trim()) {
			const r = validateInn(values.inn);
			if (!r.ok) next.inn = r.reason ?? 'Неверный ИНН';
		}
		if (values.kpp.trim()) {
			const r = validateKpp(values.kpp);
			if (!r.ok) next.kpp = r.reason ?? 'Неверный КПП';
		}
		if (values.ogrn.trim()) {
			const r = validateOgrnAny(values.ogrn);
			if (!r.ok) next.ogrn = r.reason ?? 'Неверный ОГРН';
		}
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function submit() {
		if (busy || blocked || !validate()) return;
		const body = toCreateBody(values);
		const sig = JSON.stringify(body);
		if (sig !== keySig) {
			key = crypto.randomUUID();
			keySig = sig;
		}
		busy = true;
		failure = null;
		try {
			const org = await unwrap(api.POST('/api/organizations', { body, headers: idem(key) }));
			toast.success('Организация создана');
			onCreated(org);
		} catch (e) {
			if (e instanceof ApiError && e.code === 'CRM-1301' && Array.isArray(e.extra.candidates)) {
				duplicates = e.extra.candidates as DuplicateCandidate[];
			} else if (e instanceof ApiError && e.code === 'CRM-1302') {
				conflict = { id: String(e.extra.organization_id ?? ''), deleted: e.extra.deleted === true };
			} else if (e instanceof ApiError && e.isValidation) {
				errors = { ...errors, ...e.fieldErrors() };
				failure = errors.name || errors.inn ? null : errorMessage(e);
			} else {
				failure = errorMessage(e);
			}
		} finally {
			busy = false;
		}
	}

	const open_ = (id: string) => {
		onClose();
		void goto(`/organizations/${id}`);
	};
</script>

<FormDrawer {open} title="Новая организация" width={560} saveLabel="Создать" saveTestId="org-create-submit" showSave={step === 'form'} canSave={!blocked} saving={busy} {dirty} formError={failure} onSave={submit} {onClose}>
	{#key lookupKey}
		<OrgLookup autofocus={!prefillInn} onPick={picked} />
	{/key}

	{#if step === 'lookup'}
		<div><Btn label="Заполнить вручную" variant="ghost" onclick={() => (step = 'form')} /></div>
	{:else}
		{#if fromRegistry}<p class="t-desc-l m-0 text-muted">Данные подставлены из реестра ЕГРЮЛ — проверьте и создайте.</p>{/if}

		{#if sameInn || sameName || conflict}
			{@const hit = sameInn ?? sameName}
			{@const id = hit?.id ?? conflict?.id ?? ''}
			{@const noOpen = (hit && !hit.accessible) || conflict?.deleted}
			<Notice class="shrink-0"
				tone="warning"
				role="alert"
				actions={noOpen
					? []
					: [
							{ label: 'Открыть карточку', onclick: () => open_(id) },
							...(session.can('deal:create') ? [{ label: 'Новая сделка', onclick: () => (onClose(), goto(`/deals?new=1&org=${id}`)) }] : [])
						]}
			>
				{#if hit && !hit.accessible}
					Организация с {sameInn ? 'таким ИНН' : 'таким названием'} уже есть в системе, но недоступна вам. Обратитесь к руководителю.
				{:else if conflict?.deleted}
					Карточка с таким ИНН была удалена. Восстановить её может администратор.
				{:else}
					Организация уже в системе{hit?.name ? `: ${hit.name}` : ''}.
				{/if}
			</Notice>
		{:else if similar.length}
			<Notice class="shrink-0">
				Есть похожие названия — возможно, это филиал:
				<span class="mt-1 flex flex-col gap-1">
					{#each similar as c (c.id)}
						<a href="/organizations/{c.id}" target="_blank" rel="noopener">{c.name ?? c.inn}</a>
					{/each}
				</span>
			</Notice>
		{/if}

		{#if !blocked}<p class="t-desc-l text-muted">Обязательно указать название или ИНН.</p>
			<OrgForm bind:values {errors} canOwner={session.can('deal:reassign')} disabled={busy} />{/if}
	{/if}
</FormDrawer>
