<script lang="ts">
	// Ответственные за продукт (каталог «Вендоры»): кто на стороне вендора отвечает за курс или ПО. Меняются сразу, без общего «Сохранить»:
	// связь — отдельная запись, а не поле продукта. Телефон и e-mail сервер отдаёт маскированными.
	import { onMount } from 'svelte';
	import { CloseSmall } from '@lct-testkit/rt-ui/icons';
	import { api, unwrap } from '$lib/api';
	import { IconBtn, toast } from '$lib/ui';
	import ContactPicker from '$lib/features/crm/shared/pickers/ContactPicker.svelte';
	import { contactFullName } from '$lib/features/crm/shared/entityCache.svelte';
	import type { components } from '$lib/api';

	type Link = components['schemas']['ProductContactOut'];

	let { productId }: { productId: string } = $props();

	let items = $state<Link[]>([]);
	let loading = $state(true);
	let busy = $state(false);
	let picked = $state<string | null>(null);

	async function load() {
		try {
			items = (await unwrap(api.GET('/api/products/{product_id}/contacts', { params: { path: { product_id: productId } } }))).items;
		} catch (e) {
			toast.error(e, 'Не удалось загрузить ответственных');
		} finally {
			loading = false;
		}
	}
	onMount(() => void load());

	async function add(contactId: string | null) {
		picked = contactId;
		if (!contactId || busy) return;
		busy = true;
		try {
			await unwrap(api.PUT('/api/products/{product_id}/contacts/{contact_id}', { params: { path: { product_id: productId, contact_id: contactId } }, body: { role: 'responsible' } }));
			await load();
		} catch (e) {
			toast.error(e, 'Не удалось назначить ответственного');
		} finally {
			picked = null;
			busy = false;
		}
	}

	async function remove(contactId: string) {
		if (busy) return;
		busy = true;
		try {
			await unwrap(api.DELETE('/api/products/{product_id}/contacts/{contact_id}', { params: { path: { product_id: productId, contact_id: contactId } } }));
			items = items.filter((l) => l.contact.id !== contactId);
		} catch (e) {
			toast.error(e, 'Не удалось снять ответственного');
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-2" aria-busy={loading}>
	{#if !loading && items.length === 0}
		<p class="t-desc-l m-0 text-muted">Ответственные не назначены</p>
	{/if}
	{#each items as link (link.contact.id)}
		<div class="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2">
			<span class="flex min-w-0 flex-col">
				<a class="t-body-m-strong wrap-anywhere" href="/contacts/{link.contact.id}">{contactFullName(link.contact)}</a>
				<span class="t-desc-l text-muted wrap-anywhere">{[link.contact.email, link.contact.phone].filter(Boolean).join(' · ') || '—'}</span>
			</span>
			<IconBtn icon={CloseSmall} label="Снять ответственного" disabled={busy} onclick={() => remove(link.contact.id)} />
		</div>
	{/each}
	<ContactPicker label="Назначить ответственного" value={picked} disabled={busy} onChange={add} />
</div>
