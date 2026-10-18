<script lang="ts">
	// Назначить, сменить или снять ответственного за вуз (Руководитель, Администратор): кому, причина, при желании — вместе с открытыми сделками вуза.
	// Смена — `PUT /api/organizations/{id}/owner`, снятие — `DELETE` (оба с If-Match и причиной); со сделками — массовая ручка на один вуз.
	import { untrack } from 'svelte';
	import { ApiError, api, errorTextWithCode, ifMatch, unwrap } from '$lib/api';
	import { session } from '$lib/auth/session.svelte';
	import { CheckField, FormModal, Notice, UserName, UserPicker, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import Toggle from '$lib/ui/fields/Toggle.svelte';
	import { plural } from '$lib/utils/format';
	import type { Organization } from '../types';
	import { validateReason } from './ownership';

	interface Props {
		open: boolean;
		org: Organization;
		/** с чего начать: «снять ответственного» уже включено */
		startRemoving?: boolean;
		onClose: () => void;
		/** организация обновлена (свежая версия с сервера) */
		onDone: (org: Organization) => void;
		/** конфликт версий: родитель перечитывает организацию */
		onConflict?: () => Promise<void> | void;
	}

	let { open, org, startRemoving = false, onClose, onDone, onConflict }: Props = $props();

	let successor = $state<string | null>(null);
	let removing = $state(false);
	let reason = $state('');
	let carry = $state(false);
	let openDeals = $state<number | null>(null);
	let busy = $state(false);
	let error = $state<string | null>(null);
	let conflict = $state(false);
	let fieldErrors = $state<{ successor?: string; reason?: string }>({});

	const canCarry = $derived(session.can('deal:reassign_bulk'));
	const hasOwner = $derived(!!org.owner_id);
	const title = $derived(removing ? 'Снять ответственного' : hasOwner ? 'Сменить ответственного' : 'Назначить ответственного');
	const saveLabel = $derived(removing ? 'Снять' : hasOwner ? 'Сменить' : 'Назначить');

	// поля сбрасываются только при открытии окна: после «Обновить» в баннере конфликта организация в `org` меняется, а введённое должно остаться
	let wasOpen = false;
	$effect(() => {
		const opened = open;
		untrack(() => {
			if (opened && !wasOpen) reset();
			wasOpen = opened;
		});
	});

	function reset() {
		successor = null;
		removing = startRemoving;
		reason = '';
		carry = false;
		error = null;
		conflict = false;
		fieldErrors = {};
		openDeals = null;
		if (!canCarry) return;
		// сколько открытых сделок у вуза: от этого числа зависит подпись галки
		void (async () => {
			try {
				const page = await unwrap(api.GET('/api/deals', { params: { query: { organization_id: [org.id], is_closed: false, limit: 1 } } }));
				openDeals = page.total ?? page.items.length;
			} catch {
				openDeals = null;
			}
		})();
	}

	function validate(): boolean {
		const next: { successor?: string; reason?: string } = {};
		if (!removing && !successor) next.successor = 'Выберите, кому передать';
		const bad = validateReason(reason);
		if (bad) next.reason = bad;
		fieldErrors = next;
		return Object.keys(next).length === 0;
	}

	async function submit() {
		if (busy || !validate()) return;
		busy = true;
		error = null;
		conflict = false;
		try {
			const text = reason.trim();
			let updated: Organization;
			if (carry && !removing && successor) {
				// вместе со сделками — только через массовую ручку; для одного вуза
				const res = await unwrap(api.POST('/api/organizations/bulk/owner', { body: { organization_ids: [org.id], owner_id: successor, reason: text, carry_open_deals: true } }));
				const skip = res.skipped?.[0];
				if (skip) throw new Error(skip.reason);
				updated = await unwrap(api.GET('/api/organizations/{organization_id}', { params: { path: { organization_id: org.id } } }));
				toast.success('Ответственный сменён', res.deals_reassigned ? `Передано открытых сделок: ${res.deals_reassigned}` : undefined);
			} else if (removing) {
				updated = await unwrap(api.DELETE('/api/organizations/{organization_id}/owner', { params: { path: { organization_id: org.id } }, headers: ifMatch(org.version), body: { reason: text } }));
				toast.success('Ответственный снят');
			} else {
				updated = await unwrap(api.PUT('/api/organizations/{organization_id}/owner', { params: { path: { organization_id: org.id } }, headers: ifMatch(org.version), body: { owner_id: successor, reason: text } }));
				toast.success(hasOwner ? 'Ответственный сменён' : 'Ответственный назначен');
			}
			onDone(updated);
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) conflict = true;
			else if (e instanceof ApiError && e.isValidation && e.errors.length) {
				const f = e.fieldErrors();
				fieldErrors = { successor: f.owner_id, reason: f.reason };
				if (!f.owner_id && !f.reason) error = errorTextWithCode(e);
			} else error = errorTextWithCode(e);
		} finally {
			busy = false;
		}
	}

	async function reload() {
		await onConflict?.();
		conflict = false;
	}
</script>

<FormModal {open} size="s" {title} {saveLabel} danger={removing} saving={busy} dirty={open && (!!successor || !!reason.trim())} formError={error} {conflict} conflictText="Организация изменена другим пользователем. Обновите данные — введённое сохранится." reloadLabel="Обновить" onReload={reload} onSave={submit} {onClose}>
	{#if hasOwner}
		<p class="t-body-m m-0 text-muted">Сейчас ответственный: <span class="text-fg"><UserName id={org.owner_id} /></span></p>
	{/if}
	{#if hasOwner}<Toggle label="Снять ответственного" checked={removing} onChange={(v) => ((removing = v), (fieldErrors = {}))} hint="Вуз останется без ответственного" />{/if}
	{#if !removing}
		<UserPicker label="Кому передать" required roles={['KAM', 'HEAD']} value={successor} exclude={org.owner_id ? [org.owner_id] : []} error={fieldErrors.successor} onChange={(id) => ((successor = id), (fieldErrors = { ...fieldErrors, successor: undefined }))} />
	{/if}
	<AreaField label="Причина" required rows={2} placeholder="Например, уход в отпуск" value={reason} error={fieldErrors.reason} onInput={(v) => ((reason = v), (fieldErrors = { ...fieldErrors, reason: undefined }))} onSubmit={submit} />
	{#if !removing && canCarry && openDeals}
		<CheckField label={`Передать также ${openDeals} ${plural(openDeals, ['открытую сделку', 'открытые сделки', 'открытых сделок'])} этого вуза`} checked={carry} onChange={(v) => (carry = v)} />
	{/if}
	{#if hasOwner && !removing}
		<Notice class="shrink-0" tone="info">Прежний ответственный потеряет вуз в своём списке, если у него нет сделок этого вуза.</Notice>
	{/if}
</FormModal>
