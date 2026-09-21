<script lang="ts">
	// The placeholder of what is loading: grey blocks that breathe, in the place and the size of the real content, so the page does not jump when it arrives. Four kinds — take the one
	// that looks like what is coming and give only the number of `rows`:
	//   lines — lines of text in a card (20 px, the last one shorter) · rows — rows of a table or a settings list (40 px = the height of a table row)
	//   list  — two-line list rows (56 px = a ListRow) · tile — a card, a chart, a board column (`height` says how high)
	// `height` / `gap` / `radius` override the kind for the rare block that has its own size.
	type Kind = 'lines' | 'rows' | 'list' | 'tile';

	interface Props {
		kind?: Kind;
		rows?: number;
		height?: number | string;
		width?: string;
		gap?: number;
		radius?: number;
	}

	const KINDS: Record<Kind, { height: number; gap: number; radius: number }> = {
		lines: { height: 20, gap: 12, radius: 6 },
		rows: { height: 40, gap: 8, radius: 8 },
		list: { height: 56, gap: 8, radius: 12 },
		tile: { height: 96, gap: 12, radius: 12 }
	};

	let { kind = 'lines', rows = 1, height, width = '100%', gap, radius }: Props = $props();

	const preset = $derived(KINDS[kind]);
	const h = $derived(typeof height === 'string' ? height : `${height ?? preset.height}px`);
</script>

<div class="flex flex-col" style:gap="{gap ?? preset.gap}px" aria-hidden="true">
	{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
		<span
			class="block animate-pulse bg-surface-3"
			style:height={h}
			style:width={kind === 'lines' && i === rows - 1 && rows > 1 ? '70%' : width}
			style:border-radius="{radius ?? preset.radius}px"
		></span>
	{/each}
</div>
