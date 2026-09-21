<script lang="ts">
	// Панель подтверждения подписи: код из СМС/почты, повторная отправка с таймером, подсказка демо-режима.
	import { CloseLarge } from '@lct-testkit/rt-ui/icons';
	import Btn from '$lib/ui/Btn.svelte';
	import IconBtn from '$lib/ui/IconBtn.svelte';
	import Notice from '$lib/ui/Notice.svelte';
	import OtpInput from './OtpInput.svelte';
	import { OTP_LENGTH, formatCountdown, isOtpComplete } from './otp';
	import type { SignSession } from './sign-session.svelte';

	let { session }: { session: SignSession } = $props();

	const CHANNEL: Record<string, string> = { sms: 'СМС', email: 'письма', telegram: 'сообщения Telegram' };

	// секундный тик нужен только пока кнопка «Отправить повторно» заблокирована
	$effect(() => {
		if (session.resend.canResend) return;
		const timer = setInterval(() => (session.now = Date.now()), 1000);
		return () => clearInterval(timer);
	});

	const channel = $derived(session.challenge ? (CHANNEL[session.challenge.channel] ?? 'сообщения') : '');
	const resendLabel = $derived(session.resend.canResend ? 'Отправить повторно' : `Повторить через ${formatCountdown(session.resend.secondsLeft)}`);

	function fillDemo() {
		if (!session.debugCode || session.busy) return;
		session.setOtp(session.debugCode);
		void session.submit();
	}
</script>

<section class="flex flex-col gap-4 rounded-lg border border-line bg-surface p-4 max-md:max-h-[92dvh] max-md:gap-3 max-md:overflow-y-auto max-md:rounded-b-none max-md:border-x-0 max-md:p-3 max-md:shadow-l" aria-label="Подтверждение подписи" data-testid="otp-panel">
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<h2 class="t-h4 m-0">Код подтверждения</h2>
			<p class="t-body-s m-0 mt-1 text-muted" aria-live="polite">
				{#if session.challenge}
					Введите {OTP_LENGTH} цифр из {channel}, отправленного на {session.challenge.sent_to_masked}
				{:else if session.busy}
					Отправляем код…
				{:else}
					Код не отправлен
				{/if}
			</p>
		</div>
		<IconBtn icon={CloseLarge} label="Назад к документу" disabled={session.busy} onclick={() => session.back()} />
	</div>

	<OtpInput
		value={session.otp}
		onChange={(v) => session.setOtp(v)}
		onComplete={() => session.submit()}
		disabled={session.busy || !session.challenge}
		invalid={!!session.message && session.failed > 0}
	/>

	{#if session.message}
		<Notice class="shrink-0" tone="error" data-testid="otp-error">{session.message}</Notice>
	{/if}

	{#if session.debugCode}
		<Notice class="shrink-0" tone="info" data-testid="demo-hint" actions={[{ label: 'Подставить', onclick: fillDemo }]}>Демо-режим: код <b class="tabular-nums">{session.debugCode}</b></Notice>
	{/if}

	<!-- the MAIN button first, the resend after it (as in every form); on a phone one under another, the main one at the bottom -->
	<div class="flex flex-wrap items-center gap-3 max-md:flex-col-reverse max-md:items-stretch">
		<Btn
			label="Подписать"
			size="l"
			class="max-md:w-full"
			loading={session.busy && !!session.challenge}
			disabled={!isOtpComplete(session.otp) || !session.challenge}
			onclick={() => session.submit()}
		/>
		<Btn
			label={resendLabel}
			variant="ghost"
			colorScheme="neutral"
			size="l"
			class="max-md:w-full"
			disabled={!session.resend.canResend || session.busy || session.sendsExhausted}
			onclick={() => session.requestCode()}
		/>
	</div>
</section>
