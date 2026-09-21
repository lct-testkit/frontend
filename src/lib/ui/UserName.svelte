<script lang="ts">
	// `<UserName id={deal.owner_id} />` → «Иван Иванов» (batched, cached lookup in the staff directory).
	import { people } from '$lib/api/people.svelte';

	let { id, fallback = '—' }: { id: string | null | undefined; fallback?: string } = $props();
</script>

<span class="wrap-anywhere">{people.name(id, fallback)}</span>
