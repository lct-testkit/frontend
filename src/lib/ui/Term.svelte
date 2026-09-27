<script lang="ts">
	// A word with an explanation: an abbreviation (ИНН, КПП, ЕГРЮЛ, SLA, ЭДО: texts in terms.ts) or a plain-text status / role that has a rule behind it (`hint`).
	// The dotted underline says «there is an explanation here»; it slides out over the word on hover (Tip), a screen reader reads it right after the word.
	// Chips explain themselves through StatusChip `hint`; Term is for text that is not a chip.
	import Tip from './Tip.svelte';
	import { TERM_HINTS } from './terms';

	interface Props {
		/** the abbreviation as written in terms.ts: `ИНН` */
		term?: string;
		/** what to show; the abbreviation itself by default */
		label?: string;
		/** the explanation when the word is not in terms.ts (a status, a role) */
		hint?: string;
		class?: string;
	}

	let { term, label, hint, class: className = '' }: Props = $props();
	const text = $derived(hint ?? (term ? TERM_HINTS[term] : undefined));
	const shown = $derived(label ?? term ?? '');
</script>

{#if text}
	<Tip title={shown} {text} class={className}>
		<span class="cursor-help underline decoration-dotted decoration-1 underline-offset-4">{shown}</span>
	</Tip>
	<span class="sr-only">. {text}</span>
{:else}
	<span class={className}>{shown}</span>
{/if}
