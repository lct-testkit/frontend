<script lang="ts">
	// Массовая передача выбранных сделок другому сотруднику (HEAD/ADMIN): преемник и причина.
	import { api, errorTextWithCode, unwrap } from '$lib/api';
	import { people } from '$lib/api/people.svelte';
	import { FormModal, UserPicker, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';
	import { plural } from '$lib/utils/format';

	interface Props {
		open: boolean;
		dealIds: string[];
		/** кто сейчас отвечает за выбранные сделки (в том же порядке не нужен): из него видно, от кого передаём, и единственный владелец не предлагается как преемник */
		ownerIds?: (string | null | undefined)[];
		onClose: () => void;
		onDone: () => void;
	}

	let { open, dealIds, ownerIds = [], onClose, onDone }: Props = $props();

	const owners = $derived([...new Set(ownerIds.filter((id): id is string => !!id))]);
	$effect(() => {
		if (open && owners.length) people.ensure(owners);
	});
	const count = $derived(`Передаётся: ${dealIds.length} ${plural(dealIds.length, ['сделка', 'сделки', 'сделок'])}`);
	const holder = $derived(owners.length === 1 ? `Сейчас отвечает: ${people.name(owners[0])}` : owners.length > 1 ? `Сейчас отвечают: ${owners.length} сотрудников` : '');

	let successor = $state<string | null>(null);
	let reason = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		if (open) {
			successor = null;
			reason = '';
			error = null;
		}
	});

	async function submit() {
		if (!successor || !reason.trim()) {
			error = successor ? 'Укажите причину передачи' : 'Выберите, кому передать';
			return;
		}
		busy = true;
		error = null;
		try {
			const res = await unwrap(api.POST('/api/deals/bulk/reassign', { body: { deal_ids: dealIds, successor_id: successor, reason: reason.trim() } }));
			toast.success(`Передано сделок: ${res.reassigned_count} из ${dealIds.length}`);
			onDone();
		} catch (e) {
			error = errorTextWithCode(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} size="s" title="Передать сделки" saveLabel="Передать" saving={busy} dirty={open && (!!successor || !!reason.trim())} formError={error} onSave={submit} {onClose}>
	<p class="t-body-m m-0 flex flex-col text-muted" data-testid="bulk-reassign-summary"><span>{count}</span>{#if holder}<span>{holder}</span>{/if}</p>
	<UserPicker label="Кому передать" required roles={['KAM', 'HEAD']} value={successor} exclude={owners.length === 1 ? owners : []} onChange={(id) => (successor = id)} />
	<AreaField label="Причина" required placeholder="Например, уход в отпуск" value={reason} onInput={(v) => (reason = v)} onSubmit={submit} />
</FormModal>
