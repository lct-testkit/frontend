<script lang="ts">
	// Массовая передача выбранных сделок другому сотруднику (HEAD/ADMIN): преемник и причина.
	import { api, errorMessage, unwrap } from '$lib/api';
	import { FormModal, UserPicker, toast } from '$lib/ui';
	import AreaField from '$lib/ui/fields/AreaField.svelte';

	interface Props {
		open: boolean;
		dealIds: string[];
		onClose: () => void;
		onDone: () => void;
	}

	let { open, dealIds, onClose, onDone }: Props = $props();

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
			error = errorMessage(e);
		} finally {
			busy = false;
		}
	}
</script>

<FormModal {open} size="s" title="Передать сделки" saveLabel="Передать" saving={busy} dirty={open && (!!successor || !!reason.trim())} formError={error} onSave={submit} {onClose}>
	<UserPicker label="Кому передать" roles={['KAM', 'HEAD']} value={successor} onChange={(id) => (successor = id)} />
	<AreaField label="Причина" placeholder="Например, уход в отпуск" value={reason} onInput={(v) => (reason = v)} onSubmit={submit} />
</FormModal>
