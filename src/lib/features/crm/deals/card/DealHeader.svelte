<script lang="ts">
	// Шапка карточки сделки — блок PageHeader: назад, название, номер, статус / срок / приоритет / подпись, факты (ответственный, организация,
	// контакт, сумма, срок закрытия) и действия. Одно главное действие — переход вперёд (оранжевая кнопка справа); «Заморозить» и «Отказ» рядом,
	// контурные; всё остальное и недоступное по роли — в меню «Ещё». Телефон: в шапке иконки и меню, главная кнопка — отдельной строкой на всю ширину.
	import { DropdownMenu } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { ArrowRight, Contacts, Edit, Government, MenuKebab, Refresh, UserAdd } from '@lct-testkit/rt-ui/icons';
	import { people } from '$lib/api/people.svelte';
	import { session } from '$lib/auth/session.svelte';
	import { Avatar, Btn, IconBtn, Money, PageHeader, StatusChip, UserName } from '$lib/ui';
	import { formatDate } from '$lib/utils/format';
	import Ico from '../../shared/Ico.svelte';
	import PriorityChip from '../../shared/PriorityChip.svelte';
	import SlaIndicator from '../../shared/SlaIndicator.svelte';
	import { contactCache, contactLabel, orgCache, orgLabel } from '../../shared/entityCache.svelte';
	import { SIGNATURE_STATUS_LABELS, SIGNATURE_STATUS_SCHEMES } from '../../shared/labels';
	import type { AvailableTransition } from '../../types';
	import DealStatusChip from '../DealStatusChip.svelte';
	import { classifyTransitions, type ClassifiedTransition } from '../statusUtils';
	import { workflows } from '../workflows.svelte';
	import type { DealCardState } from './dealCard.svelte';

	interface Props {
		card: DealCardState;
		onTransition: (transition: AvailableTransition) => void;
		onEdit: () => void;
		onReassign: () => void;
	}

	let { card, onTransition, onEdit, onReassign }: Props = $props();

	const bp = useBreakpoint();
	const deal = $derived(card.deal!);
	const buttons = $derived(classifyTransitions(card.transitions, (id) => workflows.status(id), card.status));
	const canUpdate = $derived(session.can('deal:update') && card.writable);
	const canTransition = $derived(session.can('deal:transition') && card.writable);
	const canReassign = $derived(session.can('deal:reassign'));
	const open = $derived(!card.closed);

	$effect(() => {
		orgCache.ensure([deal.organization_id]);
		contactCache.ensure([deal.contact_id]);
		people.ensure([deal.owner_id]);
	});

	const label = (c: ClassifiedTransition): string => {
		const target = c.target?.name;
		if (c.kind === 'forward') return target ? `Далее: ${target}` : c.transition.name;
		if (c.kind === 'back') return target ? `Назад: ${target}` : c.transition.name;
		return c.transition.name;
	};

	let menuOpen = $state(false);
	// на телефоне «Заморозить» и «Отказ» тоже уходят в меню — рядом с названием остаются иконки, главная кнопка ниже
	const menuItems = $derived(
		[...(bp.isMobile ? buttons.secondary : []), ...buttons.more].map((c) => ({
			key: c.transition.id,
			value: label(c),
			hint: c.transition.role_allowed ? undefined : 'Недоступно вашей роли',
			disabled: !c.transition.role_allowed
		}))
	);

	function onMenuItem(item: { key: string | number }) {
		menuOpen = false;
		const found = card.transitions.find((t) => t.id === item.key);
		if (found) onTransition(found);
	}

	const showSignature = $derived(deal.signature_status !== 'none');
</script>

<PageHeader title={deal.title} subtitle={deal.number} back="/deals">
	{#snippet details()}
		<span class="inline-flex flex-wrap items-center gap-2">
			<DealStatusChip statusId={deal.status_id} />
			{#if deal.closed_at}<span class="t-desc-l text-muted">закрыта {formatDate(deal.closed_at)}</span>{:else}<SlaIndicator {deal} />{/if}
			<PriorityChip priority={deal.priority} hideNormal />
			{#if showSignature}<StatusChip label={SIGNATURE_STATUS_LABELS[deal.signature_status] ?? deal.signature_status} tone={SIGNATURE_STATUS_SCHEMES[deal.signature_status] ?? 'neutral'} />{/if}
		</span>
		<span class="inline-flex items-center gap-1.5">
			<Avatar name={people.name(deal.owner_id)} size={20} />
			<UserName id={deal.owner_id} />
		</span>
		{#if deal.organization_id}
			<a class="inline-flex items-center gap-1.5 text-fg relative after:absolute after:inset-x-0 after:-inset-y-4 after:content-['']" href="/organizations/{deal.organization_id}"><Ico icon={Government} tone="soft" size={16} />{orgLabel(deal.organization_id)}</a>
		{/if}
		{#if deal.contact_id}
			<a class="inline-flex items-center gap-1.5 text-fg relative after:absolute after:inset-x-0 after:-inset-y-4 after:content-['']" href="/contacts/{deal.contact_id}"><Ico icon={Contacts} tone="soft" size={16} />{contactLabel(deal.contact_id)}</a>
		{/if}
		<span class="font-medium text-fg"><Money value={deal.amount} currency={deal.currency} /></span>
		{#if deal.expected_close_date}<span>до {formatDate(deal.expected_close_date)}</span>{/if}
	{/snippet}

	{#snippet actions()}
		<IconBtn icon={Refresh} label="Обновить" onclick={() => card.refresh()} />
		{#if canUpdate && open}<IconBtn icon={Edit} label="Редактировать" onclick={onEdit} data-testid="deal-edit" />{/if}
		{#if canReassign && open}<IconBtn icon={UserAdd} label="Сменить ответственного" onclick={onReassign} data-testid="deal-reassign" />{/if}
		{#if canTransition && open}
			{#if !bp.isMobile}
				{#each buttons.secondary as c (c.transition.id)}
					<Btn label={label(c)} variant="outline" colorScheme="neutral" danger={c.kind === 'lost'} onclick={() => onTransition(c.transition)} />
				{/each}
			{/if}
			{#if menuItems.length}
				<DropdownMenu class="w-auto flex-none" items={menuItems} isOpened={menuOpen} placement="bottomRight" onClose={() => (menuOpen = false)} onClickItem={onMenuItem}>
					<IconBtn icon={MenuKebab} label="Ещё" onclick={() => (menuOpen = !menuOpen)} aria-expanded={menuOpen} data-testid="deal-more" />
				</DropdownMenu>
			{/if}
			{#if buttons.primary && !bp.isMobile}
				<Btn class="max-w-80" title={label(buttons.primary)} label={label(buttons.primary)} icon={ArrowRight} onclick={() => onTransition(buttons.primary!.transition)} data-testid="deal-primary-transition" />
			{/if}
		{/if}
	{/snippet}

	{#if bp.isMobile && canTransition && open && buttons.primary}
		<Btn block size="l" title={label(buttons.primary)} label={label(buttons.primary)} icon={ArrowRight} onclick={() => onTransition(buttons.primary!.transition)} data-testid="deal-primary-transition" />
	{/if}
</PageHeader>
