<script lang="ts">
	// Новая сделка: минимум полей (название, тип, организация или клиент, сумма, приоритет), остальное — в «Дополнительно» и в карточке.
	// Enter отправляет, Esc закрывает; создание защищено Idempotency-Key (новый ключ — при изменении данных).
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { Segment, SegmentedControl } from '@lct-testkit/rt-ui';
	import { api, ApiError, errorMessage, idem, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, FormDrawer, FormRow, FormSection, MultiPick, UserPicker, toast } from '$lib/ui';
	import ContactCreateDrawer from '../../contacts/ContactCreateDrawer.svelte';
	import OrgCreateDrawer from '../../organizations/OrgCreateDrawer.svelte';
	import DateField from '$lib/ui/fields/DateField.svelte';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import ContactPicker from '../../shared/pickers/ContactPicker.svelte';
	import OrgPicker from '../../shared/pickers/OrgPicker.svelte';
	import { contactCache, orgCache } from '../../shared/entityCache.svelte';
	import { PRIORITY_LABELS } from '../../shared/labels';
	import { products } from '../../shared/refs.svelte';
	import type { DealCreate, DealType } from '../../types';
	import { workflows } from '../workflows.svelte';

	interface Props {
		open: boolean;
		onClose: () => void;
		/** из карточки организации / контакта: сразу выбранная сторона сделки */
		prefill?: { organizationId?: string | null; contactId?: string | null };
	}

	let { open, onClose, prefill }: Props = $props();

	let title = $state('');
	let type = $state<DealType>('b2b');
	let orgId = $state<string | null>(null);
	let contactId = $state<string | null>(null);
	let amount = $state<number | null>(null);
	let priority = $state('normal');
	let owner = $state<string | null>(null);
	let workflowId = $state<string | null>(null);
	let closeDate = $state<string | null>(null);
	let students = $state<number | null>(null);
	let picked = $state<string[]>([]);
	let errors = $state<Record<string, string>>({});
	let failure = $state<{ text: string; link?: string } | null>(null);
	let busy = $state(false);
	let orgDrawer = $state(false);
	let contactDrawer = $state(false);
	let key = crypto.randomUUID();
	let keySig = '';

	$effect(() => {
		if (!open) return;
		untrack(() => {
			title = '';
			type = prefill?.contactId && !prefill.organizationId ? 'b2c' : 'b2b';
			orgId = prefill?.organizationId ?? null;
			contactId = prefill?.contactId ?? null;
			amount = null;
			priority = 'normal';
			owner = null;
			workflowId = null;
			closeDate = null;
			students = null;
			picked = [];
			errors = {};
			failure = null;
			key = crypto.randomUUID();
			keySig = '';
		});
		void workflows.published.ensure().catch(() => {});
		void products.ensure().catch(() => {});
	});

	$effect(() => {
		if (orgId) orgCache.ensure([orgId]);
		if (contactId) contactCache.ensure([contactId]);
	});

	const candidates = $derived((workflows.published.value ?? []).filter((w) => w.deal_type === type));
	const flowItems = $derived(candidates.map((w) => ({ key: w.id, value: w.name })));
	const productItems = $derived((products.value ?? []).map((p) => ({ key: p.id, value: p.name, hint: p.base_price ?? undefined })));
	const priorityItems = Object.entries(PRIORITY_LABELS).map(([k, value]) => ({ key: k, value }));
	const canPickOwner = $derived(session.can('deal:reassign'));
	/** something was typed or chosen that a prefill did not put there */
	const dirty = $derived(!!title.trim() || amount !== null || !!owner || !!workflowId || !!closeDate || students !== null || picked.length > 0 || (!prefill?.organizationId && !!orgId) || (!prefill?.contactId && !!contactId));

	function validate(): boolean {
		const next: Record<string, string> = {};
		if (!title.trim()) next.title = 'Введите название';
		if (type === 'b2b' && !orgId) next.organization_id = 'Выберите организацию';
		if (type === 'b2c' && !contactId) next.contact_id = 'Выберите клиента';
		errors = next;
		return Object.keys(next).length === 0;
	}

	async function submit() {
		if (busy || !validate()) return;
		const body: DealCreate = {
			title: title.trim(),
			deal_type: type,
			workflow_id: workflowId ?? (candidates.length > 1 ? undefined : undefined),
			organization_id: type === 'b2b' ? orgId : null,
			contact_id: contactId,
			owner_id: canPickOwner ? owner : undefined,
			amount: amount === null ? undefined : String(amount),
			currency: 'RUB',
			priority: priority as DealCreate['priority'],
			students_planned: students ?? undefined,
			expected_close_date: closeDate ?? undefined,
			products: picked.map((id) => {
				const product = products.value?.find((x) => x.id === id);
				return { product_id: id, quantity: 1, price: product?.base_price ?? null, discount_pct: 0 };
			})
		};
		const sig = JSON.stringify(body);
		if (sig !== keySig) {
			key = crypto.randomUUID();
			keySig = sig;
		}
		busy = true;
		failure = null;
		try {
			const deal = await unwrap(api.POST('/api/deals', { body, headers: idem(key) }));
			toast.success('Сделка создана');
			onClose();
			await goto(`/deals/${deal.id}`);
		} catch (e) {
			if (e instanceof ApiError && e.isValidation) {
				const fields = e.fieldErrors();
				errors = { ...errors, ...fields };
				if (!Object.keys(fields).length) failure = { text: errorMessage(e) };
			} else if (e instanceof ApiError && e.status === 409 && e.code === 'CRM-1001') {
				failure = { text: 'Для этого типа сделок нет опубликованной воронки.', link: session.can('workflow:write') ? '/workflows' : undefined };
			} else {
				failure = { text: errorMessage(e) };
			}
		} finally {
			busy = false;
		}
	}

	function setType(next: string) {
		type = next === 'b2c' ? 'b2c' : 'b2b';
		workflowId = null;
		errors = {};
	}
</script>

<FormDrawer
	{open}
	title="Новая сделка"
	saveLabel="Создать сделку"
	saveTestId="deal-create-submit"
	saving={busy}
	{dirty}
	formError={failure ? { text: failure.text, actions: failure.link ? [{ label: 'Открыть воронки', onclick: () => goto(failure!.link!) }] : undefined } : null}
	onSave={submit}
	{onClose}
>
	<TextField label="Название" autofocus value={title} error={errors.title} onInput={(v) => ((title = v), (errors.title = ''))} />

	<SegmentedControl value={type} size="m" onChange={setType} aria-label="Тип сделки">
		<Segment index="b2b" label="Организация" />
		<Segment index="b2c" label="Физлицо" />
	</SegmentedControl>

	{#if type === 'b2b'}
		<div class="flex flex-col gap-1">
			<OrgPicker value={orgId} error={errors.organization_id} onChange={(id) => ((orgId = id), (contactId = null), (errors.organization_id = ''))} />
			<div class="self-start"><Btn label="Нет в списке? Найти по ИНН" size="s" variant="ghost" onclick={() => (orgDrawer = true)} /></div>
		</div>
		{#if orgId}
			<ContactPicker label="Контактное лицо" value={contactId} organizationId={orgId} onChange={(id) => (contactId = id)} />
		{/if}
	{:else}
		<div class="flex flex-col gap-1">
			<ContactPicker label="Клиент" value={contactId} error={errors.contact_id} onChange={(id) => ((contactId = id), (errors.contact_id = ''))} />
			<div class="self-start"><Btn label="Новый клиент" size="s" variant="ghost" onclick={() => (contactDrawer = true)} /></div>
		</div>
	{/if}

	<FormRow>
		<NumberField label="Сумма, ₽" value={amount} error={errors.amount} onChange={(v) => (amount = v)} />
		<Pick label="Приоритет" items={priorityItems} value={priority} onChange={(v) => v && (priority = v)} />
	</FormRow>

	{#if canPickOwner}<UserPicker label="Ответственный" roles={['KAM', 'HEAD']} value={owner} onChange={(id) => (owner = id)} hint="По умолчанию — вы" />{/if}
	{#if candidates.length > 1}
		<Pick label="Воронка" items={flowItems} value={workflowId ?? candidates.find((w) => w.is_default)?.id ?? null} onChange={(v) => (workflowId = v)} />
	{/if}

	<FormSection collapsible>
		<FormRow>
			<DateField label="Плановая дата закрытия" value={closeDate} onChange={(v) => (closeDate = v)} />
			{#if type === 'b2b'}<NumberField integer label="Обучающихся" value={students} onChange={(v) => (students = v)} />{/if}
		</FormRow>
		<MultiPick label="Продукты" placeholder="Не выбраны" items={productItems} bind:value={picked} emptyText="Продуктов пока нет" />
	</FormSection>
</FormDrawer>

<OrgCreateDrawer
	open={orgDrawer}
	onClose={() => (orgDrawer = false)}
	onCreated={(org) => {
		orgCache.put(org);
		orgId = org.id;
		orgDrawer = false;
		errors.organization_id = '';
	}}
/>
<ContactCreateDrawer
	open={contactDrawer}
	organizationId={null}
	onClose={() => (contactDrawer = false)}
	onCreated={(contact) => {
		contactCache.put(contact);
		contactId = contact.id;
		contactDrawer = false;
		errors.contact_id = '';
	}}
/>
