<script lang="ts">
	// KPI tile: a big number with a short label; clickable when `href` is given.
	import { goto } from '$app/navigation';
	import Skeleton from './Skeleton.svelte';

	type Tone = 'neutral' | 'danger' | 'warning' | 'success';

	interface Props {
		label: string;
		value: string | number;
		/** small line under the number: «просрочено: 2» */
		hint?: string;
		href?: string;
		tone?: Tone;
		loading?: boolean;
	}

	let { label, value, hint, href, tone = 'neutral', loading = false }: Props = $props();

	const TONE: Record<Tone, string> = { neutral: 'text-fg', danger: 'text-danger', warning: 'text-warning', success: 'text-success' };
	const BASE = 'flex min-w-0 flex-col gap-1 rounded-lg border border-line bg-surface p-[15px] text-left';
</script>

{#snippet body()}
	<span class="t-body-s truncate text-muted">{label}</span>
	{#if loading}
		<Skeleton height={32} width="60%" radius={8} />
	{:else}
		<span class={['t-h1 tabular-nums', TONE[tone]]}>{value}</span>
	{/if}
	{#if hint}<span class="t-desc-l truncate text-soft">{hint}</span>{/if}
{/snippet}

{#if href}
	<button type="button" class={[BASE, 'cursor-pointer transition hover:border-accent hover:shadow-s']} onclick={() => goto(href)}>{@render body()}</button>
{:else}
	<div class={BASE}>{@render body()}</div>
{/if}
