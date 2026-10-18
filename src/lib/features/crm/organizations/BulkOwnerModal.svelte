<script lang="ts">
	// Массовая смена ответственного у выбранных вузов (Руководитель, Администратор): кому (или снять), причина, при желании — с открытыми сделками.
	// Вузы уходят пакетами по 100; в конце — отчёт «Назначено: N. Пропущено: M» со списком пропущенных и причинами.
	import { api, errorMessage, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { CheckField, FormModal, Notice, UserPicker } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { plural } from '$lib/utils/format';
	import { runBulkOwnerChange, validateReason, type BulkOwnerResult } from './ownership';

	interface Props {
		open: boolean;
		/** выбранные вузы: id и название (для отчёта о пропущенных) */
		orgs: { id: string; name: string }[];
		/** с чего начать: «снять ответственного» уже включено */
		startRemoving?: boolean;
		onClose: () => void;
		/** окно закрыто после отчёта: список надо перечитать */
		onDone: () => void;
	}

	let { open, orgs, startRemoving = false, onClose, onDone }: Props = $props();

	let successor = $state<string | null>(null);
	let removing = $state(false);
	let reason = $state('');
	let carry = $state(false);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let fieldErrors = $state<{ successor?: string; reason?: string }>({});
	let result = $state<BulkOwnerResult | null>(null);

	const canCarry = $derived(session.can('deal:reassign_bulk'));
	const nameOf = $derived(new Map(orgs.map((o) => [o.id, o.name])));
	const word = (n: number) => plural(n, ['вуз', 'вуза', 'вузов']);

	$effect(() => {
		if (!open) return;
		successor = null;
		removing = startRemoving;
		reason = '';
		carry = false;
		error = null;
		fieldErrors = {};
		result = null;
	});

	async function submit() {
		if (busy) return;
		const next: { successor?: string; reason?: string } = {};
		if (!removing && !successor) next.successor = 'Выберите, кому передать';
		const bad = validateReason(reason);
		if (bad) next.reason = bad;
		fieldErrors = next;
		if (Object.keys(next).length) return;
		busy = true;
		error = null;
		try {
			result = await runBulkOwnerChange(
				orgs.map((o) => o.id),
				{ ownerId: removing ? null : successor, reason, carryOpenDeals: carry && !removing },
				(body) => unwrap(api.POST('/api/organizations/bulk/owner', { body }))
			);
		} catch (e) {
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}

	const close = () => {
		const done = !!result;
		onClose();
		if (done) onDone();
	};
</script>

<FormModal
	{open}
	size="s"
	title={removing ? 'Снять ответственного' : 'Назначить ответственного'}
	saveLabel={removing ? 'Снять' : 'Назначить'}
	cancelLabel={result ? 'Закрыть' : 'Отмена'}
	showSave={!result}
	danger={removing && !result}
	saving={busy}
	dirty={open && !result && (!!successor || !!reason.trim())}
	formError={error}
	onSave={submit}
	onClose={close}
>
	{#if result}
		<div class="flex flex-col gap-3" data-testid="bulk-owner-report">
			<Notice class="shrink-0" tone={result.skipped.length ? 'warning' : 'success'}>
				{removing ? 'Снято' : 'Назначено'}: {result.changed}. Пропущено: {result.skipped.length}.{#if result.dealsReassigned} Передано открытых сделок: {result.dealsReassigned}.{/if}
			</Notice>
			{#if result.skipped.length}
				<ul class="m-0 flex list-none flex-col gap-1.5 p-0">
					{#each result.skipped as s (s.organization_id)}
						<li class="t-body-m flex flex-col"><span class="font-medium break-words">{nameOf.get(s.organization_id) ?? 'Организация'}</span><span class="t-desc-l text-muted">{s.reason}</span></li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<p class="t-body-m m-0 text-muted">Выбрано: {orgs.length} {word(orgs.length)}</p>
		<Toggle label="Снять ответственного" checked={removing} onChange={(v) => ((removing = v), (fieldErrors = {}))} hint="Вузы останутся без ответственного" />
		{#if !removing}
			<UserPicker label="Кому передать" required roles={['KAM', 'HEAD']} value={successor} error={fieldErrors.successor} onChange={(id) => ((successor = id), (fieldErrors = { ...fieldErrors, successor: undefined }))} />
		{/if}
		<AreaField label="Причина" required rows={2} placeholder="Например, реорганизация отдела" value={reason} error={fieldErrors.reason} onInput={(v) => ((reason = v), (fieldErrors = { ...fieldErrors, reason: undefined }))} onSubmit={submit} />
		{#if !removing && canCarry}
			<CheckField label="Передать также открытые сделки этих вузов" checked={carry} onChange={(v) => (carry = v)} />
		{/if}
	{/if}
</FormModal>
