<script lang="ts">
	// A checkbox with its label on the right (the label is clickable) and an optional hint under it: `bind:checked` or `checked` + `onChange`.
	import { Checkbox } from '@lct-testkit/rt-ui';

	interface Props {
		checked?: boolean;
		label: string;
		hint?: string;
		error?: string;
		disabled?: boolean;
		class?: string;
		onChange?: (checked: boolean) => void;
	}

	let { checked = $bindable(false), label, hint, error, disabled = false, class: className = '', onChange }: Props = $props();
</script>

<div class={['flex min-w-0 flex-col gap-0.5', className]}>
	<Checkbox
		variant="primary"
		{label}
		{checked}
		{disabled}
		onChange={(v: boolean) => {
			checked = v;
			onChange?.(v);
		}}
	/>
	{#if error}<p class="t-desc-m pl-7 text-danger">{error}</p>{:else if hint}<p class="t-desc-m pl-7 text-muted">{hint}</p>{/if}
</div>
