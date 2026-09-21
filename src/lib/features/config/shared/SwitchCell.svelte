<script lang="ts">
	// Переключатель «Активен» прямо в строке списка: значение меняется сразу (оптимистично), при ошибке возвращается и показывается toast.
	import { Switch } from '@lct-testkit/rt-ui';
	import { toast } from '$lib/ui';

	interface Props {
		checked: boolean;
		/** сохраняет новое значение; выбрасывает ошибку при неудаче */
		onToggle: (next: boolean) => Promise<void>;
		label: string;
		disabled?: boolean;
	}

	let { checked, onToggle, label, disabled = false }: Props = $props();

	let optimistic = $state<boolean | null>(null);
	let busy = $state(false);
	const shown = $derived(optimistic ?? checked);

	async function change(next: boolean) {
		if (busy) return;
		busy = true;
		optimistic = next;
		try {
			await onToggle(next);
		} catch (e) {
			toast.error(e);
		} finally {
			optimistic = null;
			busy = false;
		}
	}
</script>

<span role="presentation" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
	<Switch checked={shown} disabled={disabled || busy} aria-label={label} title={label} onChange={change} />
</span>
