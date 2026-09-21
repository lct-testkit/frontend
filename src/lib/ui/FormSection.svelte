<script lang="ts">
	// A group of fields in a form: an optional title (DS heading-h4) and the fields under it with a 16 px gap. `collapsible` makes the group a «Дополнительно» that is
	// closed until asked for — a real button (keyboard, `aria-expanded`); a group with input in it (`open`) starts open.
	import type { Snippet } from 'svelte';
	import { ChevronDown } from '@lct-testkit/rt-ui/icons';

	interface Props {
		title?: string;
		collapsible?: boolean;
		/** starts open (a collapsible group whose fields are already filled) */
		open?: boolean;
		/** a short note after the title while the group is closed («3 д», «Не задан») */
		summary?: string;
		children?: Snippet;
		class?: string;
	}

	let { title, collapsible = false, open = false, summary, children, class: className = '' }: Props = $props();

	// svelte-ignore state_referenced_locally
	let shown = $state(!collapsible || open);
	// the fields of the group get their values after it is mounted (a form opened to edit) — a group that gets input opens, it never closes by itself
	$effect(() => {
		if (open) shown = true;
	});
	const id = `fs-${Math.random().toString(36).slice(2, 8)}`;
</script>

<section class={['flex flex-col gap-4', className]}>
	{#if collapsible}
		<button
			type="button"
			class="t-body-s-strong inline-flex items-center gap-1 self-start rounded-md px-0.5 py-1 text-accent hover:text-accent-hover"
			aria-expanded={shown}
			aria-controls={id}
			onclick={() => (shown = !shown)}
		>
			{title ?? 'Дополнительно'}
			{#if summary && !shown}<span class="t-desc-l font-normal text-muted">{summary}</span>{/if}
			<span class={['inline-flex size-4 items-center justify-center transition-transform [&_svg]:size-full [&_svg]:fill-current', shown && 'rotate-180']} aria-hidden="true"><ChevronDown /></span>
		</button>
	{:else if title}
		<h3 class="t-h4">{title}</h3>
	{/if}
	{#if shown}<div {id} class="flex flex-col gap-4">{@render children?.()}</div>{/if}
</section>
