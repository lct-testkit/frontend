<script lang="ts">
	// Продукты, за которые отвечает контакт (каталог «Вендоры»): название, вендор, код. Пусто — карточка не показывается.
	import { onMount } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import Card from '$lib/ui/Card.svelte';
	import type { ContactProduct } from '../types';

	let { contactId }: { contactId: string } = $props();

	let items = $state<ContactProduct[]>([]);

	onMount(async () => {
		try {
			items = (await unwrap(api.GET('/api/contacts/{contact_id}/products', { params: { path: { contact_id: contactId } } }))).items;
		} catch {
			items = [];
		}
	});
</script>

{#if items.length}
	<Card title="Отвечает за продукты" flush>
		<ul class="m-0 flex list-none flex-col p-0">
			{#each items as link (link.product.id)}
				<li class="flex items-center justify-between gap-3 border-b border-line px-[15px] py-2.5 last:border-b-0">
					<span class="flex min-w-0 flex-col">
						<span class="t-body-m-strong wrap-anywhere">{link.product.name}</span>
						<span class="t-desc-l text-muted wrap-anywhere">{link.product.vendor_name ?? 'Вендор не указан'} · {link.product.code}</span>
					</span>
				</li>
			{/each}
		</ul>
	</Card>
{/if}
