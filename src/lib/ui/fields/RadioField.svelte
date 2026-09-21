<script lang="ts">
	// A group of radio buttons with a caption above it and an optional hint under each option: `bind:value` or `value` + `onChange`.
	import { RadioButton, RadioGroup } from '@lct-testkit/rt-ui';

	export interface RadioItem {
		key: string;
		label: string;
		hint?: string;
		disabled?: boolean;
	}

	interface Props {
		value?: string | null;
		items: readonly RadioItem[];
		/** the caption of the group (also its accessible name) */
		label?: string;
		error?: string;
		disabled?: boolean;
		/** 2 = two columns on a desktop (one on a phone) */
		columns?: 1 | 2;
		class?: string;
		onChange?: (value: string) => void;
	}

	let { value = $bindable(null), items, label, error, disabled = false, columns = 1, class: className = '', onChange }: Props = $props();
</script>

<div class={['flex min-w-0 flex-col gap-2', className]}>
	{#if label}<span class="t-desc-l px-0.5 text-muted">{label}</span>{/if}
	<RadioGroup
		class={columns === 2 ? 'grid grid-cols-2 gap-x-4 gap-y-2 max-md:grid-cols-1' : 'flex flex-col gap-2'}
		aria-label={label}
		disabledAll={disabled}
		value={value ?? ''}
		onChange={(v: string) => {
			value = v;
			onChange?.(v);
		}}
	>
		{#each items as item (item.key)}
			<div class="min-w-0">
				<RadioButton value={item.key} label={item.label} disabled={item.disabled} />
				{#if item.hint}<p class="t-desc-m mt-0.5 pl-7 text-muted">{item.hint}</p>{/if}
			</div>
		{/each}
	</RadioGroup>
	{#if error}<p class="t-desc-m text-danger">{error}</p>{/if}
</div>
