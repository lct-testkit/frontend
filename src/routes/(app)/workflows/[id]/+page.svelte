<script lang="ts">
	import { page } from '$app/state';
	import EditorPage from '$lib/features/config/workflows/editor/EditorPage.svelte';
</script>

{#key page.params.id}
	<EditorPage id={page.params.id ?? ''} />
{/key}
