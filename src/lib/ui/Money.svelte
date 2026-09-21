<script lang="ts">
	// Backend money = string "150000.00" + currency. Never parse it in components — use this or formatMoney().
	import { formatMoney, formatMoneyShort } from '$lib/utils/format';

	let { value, currency = 'RUB', short = false }: { value: string | number | null | undefined; currency?: string | null; short?: boolean } = $props();
</script>

<span class="whitespace-nowrap tabular-nums" title={short ? formatMoney(value, currency) : undefined}>{short ? formatMoneyShort(value, currency) : formatMoney(value, currency)}</span>
