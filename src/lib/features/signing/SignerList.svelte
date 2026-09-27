<script lang="ts">
	// Подписанты документа по порядку: кто подписал, кто в работе, кто ждёт очереди. «Вы» выделен.
	import type { Component } from 'svelte';
	import { CheckLarge, CloseLarge, Pen, TimeStroke } from '@lct-testkit/rt-ui/icons';
	import { Term } from '$lib/ui';
	import { REQUEST_STATUS_HINTS } from './hints';
	import { requestStatusMeta } from './status';

	interface Signer {
		name: string;
		sign_order: number;
		status: string;
		is_me?: boolean;
		/** подпись под именем: роль, маскированный контакт */
		hint?: string | null;
	}

	let { signers }: { signers: Signer[] } = $props();

	const sorted = $derived([...signers].sort((a, b) => a.sign_order - b.sign_order));

	const TONE = {
		success: 'bg-success-soft fill-success',
		error: 'bg-danger-soft fill-danger',
		warning: 'bg-warning-soft fill-warning',
		info: 'bg-info-soft fill-info',
		neutral: 'bg-neutral-soft fill-muted'
	} as const;

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const ICON: Record<string, Component<any>> = { signed: CheckLarge, rejected: CloseLarge, locked: CloseLarge, sent: Pen, viewed: Pen };
</script>

<ol class="m-0 flex list-none flex-col p-0">
	{#each sorted as signer, i (`${signer.sign_order}-${i}`)}
		{@const meta = requestStatusMeta(signer.status)}
		{@const Icon = ICON[signer.status] ?? TimeStroke}
		<li class={['flex items-center gap-3 py-2', i > 0 && 'border-t border-line']}>
			<span class={['inline-flex size-8 flex-none items-center justify-center rounded-full', TONE[meta.tone]]}>
				<Icon size={18} class="fill-inherit" />
			</span>
			<span class="min-w-0 flex-1">
				<span class={['t-body-m break-words', signer.is_me && 't-body-m-strong']}>{signer.name}</span>
				{#if signer.is_me}<span class="t-desc-l text-muted"> · вы</span>{/if}
				{#if signer.hint}<span class="t-desc-m block text-muted">{signer.hint}</span>{/if}
			</span>
			<span class="t-desc-l flex-none text-right whitespace-nowrap text-muted"><Term label={meta.label} hint={REQUEST_STATUS_HINTS[signer.status as keyof typeof REQUEST_STATUS_HINTS]} /></span>
		</li>
	{/each}
</ol>
