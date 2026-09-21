<script lang="ts">
	// Ссылки для внешних подписантов. Бэкенд показывает токен один раз (в ответе на «Отправить») — здесь его можно скопировать.
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import type { SignLink } from './types';
	import { normalizeSignUrl } from './urls';

	let { open, links, onClose }: { open: boolean; links: SignLink[]; onClose: () => void } = $props();

	const bp = useBreakpoint();
	const items = $derived(links.map((l) => ({ ...l, url: normalizeSignUrl(l.url, location.origin) })));
</script>

<AppModal {open} title="Ссылка для подписания" size="m" {onClose}>
	<p class="t-body-s m-0 text-muted">Ссылка показывается один раз. Скопируйте её и отправьте подписанту.</p>
	{#each items as link (link.url)}
		<div class="flex flex-col gap-2">
			<span class="t-body-m-strong break-words">{link.name}</span>
			<div class="flex items-center gap-1">
				<div class="min-w-0 flex-1"><TextField value={link.url} readonly ariaLabel="Ссылка для {link.name}" /></div>
				<CopyButton value={link.url} label="Копировать ссылку" size={bp.isMobile ? 'l' : 'm'} done="Ссылка скопирована" />
			</div>
			<div><Btn label="Открыть страницу подписи" variant="outline" colorScheme="neutral" size="s" onclick={() => window.open(link.url, '_blank', 'noopener')} /></div>
		</div>
	{/each}
	{#snippet footer()}
		<Btn label="Готово" onclick={onClose} />
	{/snippet}
</AppModal>
