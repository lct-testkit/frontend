<script lang="ts">
	// Ссылка-приглашение показывается один раз (в ответе на создание / повторную выдачу): скопировать и передать сотруднику.
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import type { UserCreated } from '../types';

	let { result, onClose }: { result: UserCreated | null; onClose: () => void } = $props();

	const bp = useBreakpoint();
	const url = $derived(result?.invite_url ? new URL(new URL(result.invite_url).pathname, location.origin).href : null);
</script>

<AppModal open={!!result} title="Приглашение готово" size="m" {onClose}>
	{#if result}
		<p class="t-body-m m-0">
			{result.user.full_name}{#if result.invite_email_sent}: письмо с приглашением отправлено на {result.user.email}.{:else}: письмо не отправлялось, передайте ссылку сами.{/if}
		</p>
		{#if url}
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-1">
					<div class="min-w-0 flex-1"><TextField value={url} readonly ariaLabel="Ссылка-приглашение" /></div>
					<CopyButton value={url} label="Копировать ссылку" size={bp.isMobile ? 'l' : 'm'} done="Ссылка скопирована" />
				</div>
				{#if result.invite_expires_at}<p class="t-desc-l m-0 text-muted">Действует до {formatDateTime(result.invite_expires_at)}. Ссылка показывается один раз.</p>{/if}
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		<Btn label="Готово" onclick={onClose} />
	{/snippet}
</AppModal>
