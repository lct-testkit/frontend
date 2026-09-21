<script lang="ts">
	// The «where am I» of a wizard. On a desktop page — the DS steps (a number on a tile, a line between the tiles, the current one in the accent colour). In a dialog and on a phone
	// — «Шаг 2 из 5 · Проверка» and a thin progress bar: four titles do not fit into a 560 px window or a 390 px screen. One component for every wizard, so they all look the same.
	import { WizardStepsHorizontal } from '@lct-testkit/rt-ui';
	import { Progress, useBreakpoint } from '@lct-testkit/rt-ui/ext';

	interface Props {
		/** the titles of the steps */
		steps: readonly string[];
		/** the index of the current step */
		current: number;
		/** always the short form (a wizard in a dialog) */
		compact?: boolean;
		class?: string;
	}

	let { steps, current, compact = false, class: className = '' }: Props = $props();

	const bp = useBreakpoint();
	const index = $derived(Math.min(Math.max(current, 0), steps.length - 1));
</script>

{#if compact || bp.isMobile}
	<div class={['flex flex-col gap-1.5', className]}>
		<p class="t-body-s"><b>Шаг {index + 1} из {steps.length}</b> · {steps[index]}</p>
		<Progress value={((index + 1) / steps.length) * 100} size="s" />
	</div>
{:else}
	<WizardStepsHorizontal class={className} currentStep={index} steps={steps.map((title) => ({ title }))} />
{/if}
