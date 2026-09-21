<script lang="ts">
	// A switch with its label on the right (the label is clickable): `bind:checked` or `checked` + `onChange`. The hint stands under the label.
	import { Switch } from '@lct-testkit/rt-ui';

	interface Props {
		checked?: boolean;
		label: string;
		hint?: string;
		disabled?: boolean;
		class?: string;
		onChange?: (checked: boolean) => void;
	}

	let { checked = $bindable(false), label, hint, disabled = false, class: className = '', onChange }: Props = $props();
</script>

<div class={['flex min-w-0 flex-col gap-0.5', className]}>
	<Switch
		{checked}
		{disabled}
		{label}
		onChange={(v: boolean) => {
			checked = v;
			onChange?.(v);
		}}
	/>
	{#if hint}<p class="t-desc-m pl-[50px] text-muted">{hint}</p>{/if}
</div>
