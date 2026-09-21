<script lang="ts">
	// Код из 6 цифр: шесть ячеек поверх одного настоящего <input> — работают вставка, автозаполнение из СМС
	// (`one-time-code`) и цифровая клавиатура телефона.
	import { OTP_LENGTH, isOtpComplete, normalizeOtp } from './otp';

	interface Props {
		value: string;
		onChange: (value: string) => void;
		onComplete?: () => void;
		disabled?: boolean;
		invalid?: boolean;
	}

	let { value, onChange, onComplete, disabled = false, invalid = false }: Props = $props();

	let input = $state<HTMLInputElement>();
	let focused = $state(false);

	const cells = Array.from({ length: OTP_LENGTH }, (_, i) => i);
	const cursor = $derived(Math.min(value.length, OTP_LENGTH - 1));

	function oninput(event: Event) {
		const next = normalizeOtp((event.target as HTMLInputElement).value);
		(event.target as HTMLInputElement).value = next;
		onChange(next);
		if (isOtpComplete(next)) onComplete?.();
	}

	$effect(() => {
		if (!disabled) input?.focus({ preventScroll: true });
	});
</script>

<div class="relative mx-auto w-full max-w-76">
	<div class="grid grid-cols-6 gap-2" aria-hidden="true">
		{#each cells as i (i)}
			<div
				class={[
					't-h3 flex h-14 items-center justify-center rounded-md border bg-surface tabular-nums transition-colors max-md:h-12',
					invalid ? 'border-danger' : focused && i === cursor ? 'border-accent ring-2 ring-accent-soft' : value[i] ? 'border-line-strong' : 'border-line',
					disabled && 'opacity-60'
				]}
			>
				{value[i] ?? ''}
			</div>
		{/each}
	</div>
	<input
		bind:this={input}
		{value}
		{disabled}
		{oninput}
		onfocus={() => (focused = true)}
		onblur={() => (focused = false)}
		class="absolute inset-0 size-full cursor-text border-0 bg-transparent text-transparent opacity-0 outline-none"
		inputmode="numeric"
		autocomplete="one-time-code"
		maxlength={OTP_LENGTH}
		pattern="[0-9]*"
		aria-label="Код подтверждения из {OTP_LENGTH} цифр"
		aria-invalid={invalid || undefined}
		data-testid="otp-input"
	/>
</div>
