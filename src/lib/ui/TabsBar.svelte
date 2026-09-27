<script lang="ts">
	// Tabs of a list or a card, the DS `TabsGroup` exactly as in its CRM example: primary, size m, underline border, label with a count
	// («Все (34)»). Use it for the main segmentation of a list («Все / Мои / Требуют внимания») and for the sections of a card.
	// The row scrolls sideways by itself when it does not fit (a phone) — the page never does.
	import { TabsGroup, TabsItem } from '@lct-testkit/rt-ui';

	interface Item {
		key: string;
		label: string;
		/** shown as «Label (count)» when defined; a string such as «100+» when the number is capped */
		count?: number | string;
		disabled?: boolean;
		/** a dot on the tab: something waits there */
		dot?: boolean;
	}

	interface Props {
		items: readonly Item[];
		value: string;
		onChange: (key: string) => void;
		/** what the tabs switch — read by screen readers */
		label?: string;
		/** the grey line under the whole strip; off when the row that holds the tabs and the page buttons draws it */
		underline?: boolean;
	}

	let { items, value, onChange, label, underline = true }: Props = $props();
</script>

<!-- the DS group has `margin: -4px` and `padding: 4px` (room for the focus ring). It is made 8 px wider than the wrapper, so its strip (the underline and the tabs) spans exactly the wrapper = the page axes, and the gaps around it are the page gap -->
<div class="min-w-0">
<TabsGroup class="w-[calc(100%+8px)]" variant="primary" size="m" border={underline} horizontalFill={false} {value} onChange={(index: string) => onChange(index)} aria-label={label}>
	{#each items as item (item.key)}
		<TabsItem index={item.key} label={item.count === undefined ? item.label : `${item.label} (${item.count})`} disabled={item.disabled} dot={item.dot} />
	{/each}
</TabsGroup>
</div>
