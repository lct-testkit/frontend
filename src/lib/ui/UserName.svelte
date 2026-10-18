<script lang="ts">
	// `<UserName id={deal.owner_id} />` → «Иван Иванов» (batched, cached lookup in the staff directory).
	import { people } from '$lib/api/people.svelte';

	let { id, fallback = '—' }: { id: string | null | undefined; fallback?: string } = $props();
	const text = $derived(people.name(id, fallback));
</script>

<!-- while the name is on its way keep the room of a typical one (9 rem): a row with buttons next to it must not re-wrap when it arrives -->
<span class={['wrap-anywhere', text === '…' && 'inline-block min-w-36 animate-pulse text-muted']}>{text}</span>
