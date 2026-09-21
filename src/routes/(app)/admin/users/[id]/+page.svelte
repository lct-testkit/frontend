<script lang="ts">
	import { page } from '$app/state';
	import UserPage from '$lib/features/identity/users/UserPage.svelte';
</script>

<svelte:head><title>Пользователь · RTK School</title></svelte:head>

{#key page.params.id}<UserPage id={page.params.id ?? ''} />{/key}
