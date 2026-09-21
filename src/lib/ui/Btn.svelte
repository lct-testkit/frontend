<script lang="ts">
	// Text button. `icon` is a component (prefix); `loading` disables the button and shows a spinner; `danger` = destructive.
	import { getContext, type Component } from 'svelte';
	import { Button, Counter, Loader } from '@lct-testkit/rt-ui';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { BTN_SIZE } from './BtnSizeScope.svelte';

	interface Props {
		label: string;
		onclick?: (event: MouseEvent) => void;
		icon?: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
		colorScheme?: 'accent' | 'neutral';
		/** `auto` = `m` on a desktop, `l` (48 px, a touch target) on a phone */
		size?: 's' | 'm' | 'l' | 'xl' | 'auto';
		disabled?: boolean;
		loading?: boolean;
		/** a number inside the button after the label («Фильтры 2»); nothing when 0 */
		count?: number;
		danger?: boolean;
		/** stretch to the container (forms on phones) */
		block?: boolean;
		type?: 'button' | 'submit' | 'reset';
		class?: string;
		[key: string]: unknown;
	}

	let {
		label,
		onclick,
		icon,
		variant = 'primary',
		colorScheme = 'accent',
		size,
		disabled = false,
		loading = false,
		count = 0,
		danger = false,
		block = false,
		type = 'button',
		class: className = '',
		...rest
	}: Props = $props();

	const bp = useBreakpoint();
	// a footer of a dialog or a panel sets the size of its buttons (see BtnSizeScope)
	const inherited = getContext<Props['size']>(BTN_SIZE);
	const wanted = $derived(size ?? inherited ?? 'm');
	const boxSize = $derived(wanted === 'auto' ? (bp.isMobile ? 'l' : 'm') : wanted);

	// destructive primary = the error palette through the button's own tokens; other variants only recolour label and icon
	const DANGER_PRIMARY =
		'[--atmr-button-primary-accent-bg-color-default:var(--atmr-error-default)] [--atmr-button-primary-accent-bg-color-hover:var(--atmr-error-hover)] [--atmr-button-primary-accent-bg-color-active:var(--atmr-error-active)] [--atmr-button-primary-accent-border-color-default:var(--atmr-error-default)] [--atmr-button-primary-accent-border-color-hover:var(--atmr-error-hover)] [--atmr-button-primary-accent-border-color-active:var(--atmr-error-active)] [--atmr-button-primary-accent-label-color-default:var(--atmr-error-on-error)] [--atmr-button-primary-accent-label-color-hover:var(--atmr-error-on-error)] [--atmr-button-primary-accent-label-color-active:var(--atmr-error-on-error)] [--atmr-button-primary-accent-icon-color-default:var(--atmr-error-on-error)] [--atmr-button-primary-accent-icon-color-hover:var(--atmr-error-on-error)] [--atmr-button-primary-accent-icon-color-active:var(--atmr-error-on-error)]';
	const DANGER_QUIET = String.raw`[&_.atmr-button\_\_label]:text-danger [&_svg]:fill-danger`; // `\_` = a literal underscore inside a Tailwind arbitrary selector
</script>

{#snippet prefix()}
	{#if loading}
		<Loader size="2xs" variant={variant === 'primary' ? 'secondary' : 'primary'} />
	{:else if icon}
		{@const Icon = icon}
		<Icon />
	{/if}
{/snippet}

{#snippet suffix()}<Counter size="xs">{count}</Counter>{/snippet}

<Button
	{variant}
	{colorScheme}
	size={boxSize}
	{type}
	{label}
	{onclick}
	disabled={disabled || loading}
	iconPrefix={loading || icon ? prefix : undefined}
	iconSuffix={count > 0 ? suffix : undefined}
	aria-busy={loading || undefined}
	class={[block && 'w-full', danger && (variant === 'primary' ? DANGER_PRIMARY : DANGER_QUIET), className]}
	{...rest}
/>
