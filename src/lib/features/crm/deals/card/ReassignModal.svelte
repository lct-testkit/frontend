<script lang="ts">
	// Смена ответственного (HEAD/ADMIN): новый сотрудник и обязательная причина; в сделке появится системная запись, сотрудник получит уведомление.
	import { ApiError, errorMessage } from '$lib/api';
	import { FormModal, UserPicker, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import type { DealCardState } from './dealCard.svelte';

	interface Props {
		open: boolean;
		card: DealCardState;
		onClose: () => void;
	}

	let { open, card, onClose }: Props = $props();

	let owner = $state<string | null>(null);
	let reason = $state('');
	let error = $state<string | null>(null);
	let conflict = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (open) {
			owner = null;
			reason = '';
			error = null;
			conflict = false;
		}
	});

	async function submit() {
		if (!owner || !reason.trim()) {
			error = owner ? 'Укажите причину передачи' : 'Выберите сотрудника';
			return;
		}
		busy = true;
		error = null;
		try {
			await card.reassign(owner, reason.trim());
			toast.success('Ответственный сменён');
			onClose();
		} catch (e) {
			conflict = e instanceof ApiError && e.isConflict;
			error = conflict ? 'Сделка изменена другим пользователем. Обновите данные и повторите.' : errorMessage(e);
		} finally {
			busy = false;
		}
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		await card.refresh();
		error = null;
		conflict = false;
		busy = false;
	}
</script>

<FormModal {open} size="s" title="Сменить ответственного" saveLabel="Передать" saving={busy} dirty={open && (!!owner || !!reason.trim())} {conflict} conflictText={error ?? undefined} reloadLabel="Обновить" formError={conflict ? null : error} onSave={submit} onReload={refresh} {onClose}>
	<UserPicker label="Новый ответственный" roles={['KAM', 'HEAD']} value={owner} exclude={card.deal ? [card.deal.owner_id] : []} clearable={false} onChange={(id) => (owner = id)} />
	<AreaField label="Причина" value={reason} rows={2} onInput={(v) => (reason = v)} onSubmit={submit} />
</FormModal>
