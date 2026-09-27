<script lang="ts">
	// Initials on a soft tinted disc (users have no photos). The caps of the DS font sit a little high in a line box, so the text gets a 0.08em nudge down; below 10 px the initials stop being legible, so the font never gets smaller. `profile`: the avatar of the top bar — the DS classes make its hover ring round.
	import { initials } from '$lib/utils/format';

	let { name, size = 32, profile = false }: { name?: string | null; size?: number; profile?: boolean } = $props();

	const TONES = ['bg-accent-soft', 'bg-info-soft', 'bg-success-soft', 'bg-warning-soft', 'bg-neutral-soft'];
	const tone = $derived(TONES[[...(name ?? '?')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % TONES.length]);
</script>

<span
	class={[
		'inline-flex flex-none items-center justify-center rounded-full font-semibold leading-none text-fg select-none',
		tone,
		profile && 'atmr-top-menu__profile-avatar atmr-top-menu__profile-avatar--round'
	]}
	style:width="{size}px"
	style:height="{size}px"
	style:font-size="{Math.max(10, Math.round(size * 0.4))}px"
	style:padding-top="0.08em"
	aria-hidden="true">{initials(name)}</span
>
