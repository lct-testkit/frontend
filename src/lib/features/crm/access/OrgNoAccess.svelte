<script lang="ts">
	// Карточка вуза, который сервер скрыл (404/403): человеку нужно не «ошибка», а выход — запросить доступ у ответственного.
	// Если запрос уже отправлен и ждёт решения, вместо кнопки — об этом сказано.
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { Lock } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { Btn, EmptyState } from '$lib/ui';
	import AccessRequestModal from './AccessRequestModal.svelte';

	let { orgId }: { orgId: string } = $props();

	let asking = $state(false);
	/** null — ещё не знаем, false — запроса нет, true — ждёт решения */
	let pending = $state<boolean | null>(null);

	onMount(async () => {
		try {
			const mine = await unwrap(api.GET('/api/access-requests', { params: { query: { box: 'mine', status: 'pending', limit: 100 } } }));
			pending = mine.items.some((r) => r.entity_id === orgId && r.status === 'pending');
		} catch {
			pending = false;
		}
	});
</script>

<EmptyState
	icon={Lock}
	title="Нет доступа к организации"
	hint={pending ? 'Запрос отправлен и ожидает решения. Ответ придёт уведомлением.' : 'Организация закреплена за другим сотрудником или удалена. Можно запросить доступ — решение примет руководитель.'}
>
	{#snippet action()}
		{#if pending}
			<Btn label="Мои запросы" variant="outline" colorScheme="neutral" onclick={() => goto('/access-requests?box=mine')} />
		{:else if pending === false}
			<Btn label="Запросить доступ" onclick={() => (asking = true)} data-testid="org-request-access" />
		{/if}
	{/snippet}
</EmptyState>

<AccessRequestModal open={asking} {orgId} onClose={() => (asking = false)} onSent={() => (pending = true)} />
