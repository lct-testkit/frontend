<script lang="ts">
	// The card of an invitation (the public page /invite/[token]): who is invited, until when the link works, and the way to the sign-in.
	import { KeyValue, KeyValueList } from '$lib/ui';
	import Btn from '$lib/ui/Btn.svelte';
	import { formatDateTime } from '$lib/utils/format';

	interface Props {
		fullName?: string | null;
		emailMasked?: string | null;
		expiresAt: string;
		onContinue: () => void;
	}

	let { fullName, emailMasked, expiresAt, onContinue }: Props = $props();
</script>

<section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-5 max-md:p-4">
	<h1 class="t-h2">Вас пригласили в CRM</h1>
	<KeyValueList columns={1}>
		{#if fullName}<KeyValue label="Сотрудник" value={fullName} />{/if}
		{#if emailMasked}<KeyValue label="Почта" value={emailMasked} />{/if}
		<KeyValue label="Ссылка действует до" value={formatDateTime(expiresAt)} />
	</KeyValueList>
	<Btn label="Перейти ко входу" size="l" block onclick={onContinue} data-testid="invite-continue" />
</section>
