<script lang="ts">
	// Чип статуса письма с подсказкой-причиной. Тон «предупреждение», а не «ошибка»: без почты сотрудника можно пригласить ссылкой.
	import StatusChip from '$lib/ui/StatusChip.svelte';
	import { mailLabel, mailText, mailTone, type MailStatus } from './mail';

	let { status, reason = null }: { status: MailStatus; reason?: string | null } = $props();
</script>

<StatusChip label={mailLabel(status)} tone={mailTone(status)} hint={status === 'not_sent' && reason ? mailText(status, reason) : undefined} />
