<script lang="ts">
	// Итог экрана подписи: подписано / отклонено / ссылка недействительна / срок истёк …
	import type { Component } from 'svelte';
	import { goto } from '$app/navigation';
	import { CheckLarge, CloseLarge, TimeStroke, StopStroke } from '@lct-testkit/rt-ui/icons';
	import Btn from '$lib/ui/Btn.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import type { Outcome } from './sign-session.svelte';
	import type { SignatureOut } from './types';

	interface Props {
		outcome: Outcome;
		title?: string | null;
		note?: string | null;
		signature?: SignatureOut | null;
		/** куда вернуться сотруднику; у гостя кнопки нет */
		backHref?: string;
	}

	let { outcome, title = null, note = null, signature = null, backHref }: Props = $props();

	type Tone = 'success' | 'danger' | 'warning' | 'neutral';
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const META: Record<Outcome, { tone: Tone; icon: Component<any>; head: string; text: string }> = {
		signed: { tone: 'success', icon: CheckLarge, head: 'Документ подписан', text: 'Подпись сохранена. Инициатор получил уведомление.' },
		rejected: { tone: 'neutral', icon: CloseLarge, head: 'Документ отклонён', text: 'Инициатор получит уведомление с вашей причиной.' },
		signed_before: { tone: 'success', icon: CheckLarge, head: 'Вы уже подписали документ', text: 'Повторная подпись не требуется.' },
		rejected_before: { tone: 'neutral', icon: CloseLarge, head: 'Вы отклонили документ', text: 'Изменить решение можно только через инициатора.' },
		locked: { tone: 'danger', icon: CloseLarge, head: 'Подписание заблокировано', text: 'После неверных кодов подписание закрыто. Инициатор уведомлён и отправит документ заново.' },
		expired: { tone: 'warning', icon: TimeStroke, head: 'Срок подписания истёк', text: 'Попросите инициатора отправить документ заново.' },
		void: { tone: 'neutral', icon: StopStroke, head: 'Документ аннулирован', text: 'Подписывать его больше не нужно.' },
		waiting: { tone: 'warning', icon: TimeStroke, head: 'Пока не ваша очередь', text: 'Сначала подписывают предыдущие участники. Вам придёт уведомление.' },
		invalid: { tone: 'danger', icon: CloseLarge, head: 'Ссылка недействительна', text: 'Срок её действия истёк или документ отозван. Попросите инициатора отправить документ заново.' },
		mismatch: { tone: 'danger', icon: CloseLarge, head: 'Подпись не поставлена', text: 'Документ изменился после отправки. Инициатору нужно отправить его заново.' }
	};

	const TONE: Record<Tone, string> = {
		success: 'bg-success-soft fill-success',
		danger: 'bg-danger-soft fill-danger',
		warning: 'bg-warning-soft fill-warning',
		neutral: 'bg-neutral-soft fill-muted'
	};

	const meta = $derived(META[outcome]);
	const Icon = $derived(meta.icon);
</script>

<!-- экран результата подписи (крупный значок, заголовок, действия): это страница, а не сообщение — Notice не подходит -->
<section class="flex flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-10 text-center max-md:px-4 max-md:py-8" role="status" data-testid="sign-outcome" data-outcome={outcome}>
	<span class={['inline-flex size-16 items-center justify-center rounded-full', TONE[meta.tone]]}>
		<Icon size={32} class="fill-inherit" />
	</span>
	<div class="flex max-w-[26rem] flex-col gap-2">
		<h1 class="t-h3 m-0">{meta.head}</h1>
		{#if title}<p class="t-body-m m-0 break-words text-fg">«{title}»</p>{/if}
		<p class="t-body-m m-0 text-muted">{note ?? meta.text}</p>
		{#if outcome === 'signed' && signature}
			<p class="t-desc-l m-0 text-muted">{signature.signer_display} · {formatDateTime(signature.signed_at)}</p>
		{/if}
	</div>
	<div class="flex flex-wrap justify-center gap-2 max-md:w-full max-md:flex-col">
		{#if outcome === 'signed' && signature}
			<Btn label="Проверить подпись" size="l" onclick={() => goto(`/verify/${signature.id}`)} />
		{/if}
		{#if backHref}
			<Btn label="К списку" variant={outcome === 'signed' ? 'secondary' : 'primary'} colorScheme={outcome === 'signed' ? 'neutral' : 'accent'} size="l" onclick={() => goto(backHref)} />
		{/if}
	</div>
</section>
