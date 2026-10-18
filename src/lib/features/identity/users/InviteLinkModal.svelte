<script lang="ts">
	// Ссылка-приглашение показывается один раз (в ответе на создание / повторную выдачу): скопировать и передать сотруднику.
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import AppModal from '$lib/ui/AppModal.svelte';
	import Btn from '$lib/ui/Btn.svelte';
	import CopyButton from '$lib/ui/CopyButton.svelte';
	import TextField from '$lib/ui/fields/TextField.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import type { UserCreated } from '../types';
	import { inviteMailStatus } from '../mail';
	import MailStatusChip from '../MailStatusChip.svelte';

	let { result, onClose, purpose = 'invite' }: { result: UserCreated | null; onClose: () => void; purpose?: 'invite' | 'reset' } = $props();

	const bp = useBreakpoint();
	const url = $derived(result?.invite_url ? new URL(new URL(result.invite_url).pathname, location.origin).href : null);
</script>

<AppModal open={!!result} title={purpose === 'reset' ? 'Ссылка для нового пароля' : 'Приглашение готово'} size="m" {onClose}>
	{#if result}
		<div class="flex flex-col gap-2">
			<p class="t-body-m m-0">{result.user.full_name}</p>
			<div class="flex flex-wrap items-center gap-2">
				<MailStatusChip status={inviteMailStatus(result.invite_email_sent)} />
				<span class="t-desc-l text-muted">{#if result.invite_email_sent}на {result.user.email}{:else}передайте ссылку сами{/if}</span>
			</div>
		</div>
		{#if url}
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-1">
					<div class="min-w-0 flex-1"><TextField value={url} readonly ariaLabel={purpose === 'reset' ? 'Ссылка для нового пароля' : 'Ссылка-приглашение'} /></div>
					<CopyButton value={url} label="Копировать ссылку" size={bp.isMobile ? 'l' : 'm'} done="Ссылка скопирована" />
				</div>
				{#if result.invite_expires_at}<p class="t-desc-l m-0 text-muted">Действует до {formatDateTime(result.invite_expires_at)}. Ссылка показывается один раз. Сотрудник сам задаст {purpose === 'reset' ? 'новый ' : ''}пароль на странице по этой ссылке.</p>{/if}
			</div>
		{/if}
	{/if}
	{#snippet footer()}
		<Btn label="Готово" onclick={onClose} />
	{/snippet}
</AppModal>
