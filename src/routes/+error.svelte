<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { Search } from '@lct-testkit/rt-ui/icons';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Btn from '$lib/ui/Btn.svelte';
</script>

<div class="flex min-h-dvh items-center justify-center">
	<EmptyState title={page.status === 404 ? 'Страница не найдена' : 'Что-то пошло не так'} hint={page.status === 404 ? undefined : page.error?.message} icon={Search}>
		{#snippet action()}<Btn label="На главную" onclick={() => goto('/')} />{/snippet}
	</EmptyState>
</div>
