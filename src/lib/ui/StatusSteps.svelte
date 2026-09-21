<script lang="ts" module>
	export interface Step {
		id: string;
		name: string;
		/** done = passed, current = here, stopped = the object left the pipeline from this step (lost, parked), future = ahead */
		state: 'done' | 'current' | 'stopped' | 'future';
		/** present when the step can be entered now */
		onclick?: () => void;
	}
</script>

<script lang="ts">
	// The path of an object through its pipeline (a deal through the funnel): ONE line of named steps that scrolls by itself so the current step
	// is in the middle and about three steps before and three after are in view («…3 4 5 [6] 7 8 9…»); the first and the last one are out of sight
	// until you get there. There is no such component in rt-ui (its Wizard is a row of numbered tiles that does not fit 14 steps).
	// The scrollbar is hidden (it was the bug of the first version): the row is moved by touch, wheel, trackpad, the ‹ › buttons or a click on a step.
	// Each step is a coloured bar with «N Name» under it: done = accent, current = accent with a ring, lost = red, ahead = grey.
	// A step that can be entered right now is a button; the rest are inert.
	import type { Snippet } from 'svelte';
	import { ChevronLeft, ChevronRight } from '@lct-testkit/rt-ui/icons';
	import IconBtn from './IconBtn.svelte';

	interface Props {
		steps: Step[];
		/** the right end of the header line: a badge of the final status (won / lost / parked) */
		end?: Snippet;
		label?: string;
	}

	let { steps, end, label = 'Этапы воронки' }: Props = $props();

	let strip = $state<HTMLElement | null>(null);
	let atStart = $state(true);
	let atEnd = $state(true);
	let scrolls = $state(false);

	function measure() {
		if (!strip) return;
		atStart = strip.scrollLeft <= 1;
		atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 1;
		scrolls = strip.scrollWidth > strip.clientWidth + 1;
	}

	// keep the current step in the middle of the row (instantly the first time, smoothly afterwards)
	let placed = false;
	function center() {
		const here = strip?.querySelector<HTMLElement>('[data-here]');
		if (strip && !here && steps.length && steps.every((s) => s.state === 'done')) {
			// closed successfully: show the end of the path
			strip.scrollTo({ left: strip.scrollWidth, behavior: placed ? 'smooth' : 'instant' });
			placed = true;
			return measure();
		}
		if (!strip || !here) return measure();
		strip.scrollTo({ left: Math.max(0, here.offsetLeft - (strip.clientWidth - here.offsetWidth) / 2), behavior: placed ? 'smooth' : 'instant' });
		placed = true;
		measure();
	}
	$effect(() => {
		void steps.map((s) => s.state).join();
		center();
	});
	$effect(() => {
		if (!strip) return;
		const observer = new ResizeObserver(center);
		observer.observe(strip);
		return () => observer.disconnect();
	});

	const page = (dir: 1 | -1) => strip?.scrollBy({ left: dir * strip.clientWidth * 0.43, behavior: 'smooth' });

	const at = $derived(steps.findIndex((s) => s.state === 'current' || s.state === 'stopped'));
	const passed = $derived(steps.filter((s) => s.state === 'done').length);
	// a successfully closed object has passed everything: «все шаги пройдены» instead of a wrong «шаг 0»
	const caption = $derived(at >= 0 ? `Шаг ${at + 1} из ${steps.length}` : passed === steps.length ? 'Все шаги пройдены' : `Шагов: ${steps.length}`);

	const FILL: Record<Step['state'], string> = {
		done: 'bg-accent',
		current: 'bg-accent ring-2 ring-accent/30',
		stopped: 'bg-danger ring-2 ring-danger/30',
		future: 'bg-surface-3'
	};
	const TEXT: Record<Step['state'], string> = {
		done: 't-desc-l text-fg',
		current: 't-desc-l-strong text-fg',
		stopped: 't-desc-l-strong text-danger',
		future: 't-desc-l text-muted'
	};
	// a soft fade on the side where more steps are hidden
	const FADE_L = '[mask-image:linear-gradient(to_right,transparent,black_2rem)]';
	const FADE_R = '[mask-image:linear-gradient(to_left,transparent,black_2rem)]';
	const FADE_BOTH = '[mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]';
	const fade = $derived(atStart && atEnd ? '' : atStart ? FADE_R : atEnd ? FADE_L : FADE_BOTH);
</script>

{#snippet cell(step: Step, i: number)}
	<span class={['block h-1.5 w-full rounded-full', FILL[step.state]]}></span>
	<span class={[TEXT[step.state], 'mt-1.5 line-clamp-2 break-words']}><span class="text-soft">{i + 1}</span> {step.name}</span>
{/snippet}

{#if steps.length}
	<div class="flex min-w-0 flex-col gap-2" role="group" aria-label={label}>
		<div class="flex min-h-9 min-w-0 items-center gap-3">
			<span class="t-body-s-strong flex-none">{caption}</span>
			<span class="ml-auto flex flex-none items-center gap-2">
				{#if end}{@render end()}{/if}
				{#if scrolls}
					<span class="flex items-center">
						<IconBtn icon={ChevronLeft} label="Предыдущие шаги" size="s" disabled={atStart} onclick={() => page(-1)} />
						<IconBtn icon={ChevronRight} label="Следующие шаги" size="s" disabled={atEnd} onclick={() => page(1)} />
					</span>
				{/if}
			</span>
		</div>

		<!-- 7 steps fit the row (3 + current + 3); on a narrow screen a step is at least 8.5 rem wide and fewer are in view -->
		<ol bind:this={strip} class={['relative m-0 flex list-none gap-3 overflow-x-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', fade]} onscroll={measure}>
			{#each steps as step, i (step.id)}
				<li class="max-w-none min-w-0 shrink-0 grow-0 basis-[max(8.5rem,calc((100%-4.5rem)/7))]" data-here={step.state === 'current' || step.state === 'stopped' ? '' : undefined}>
					{#if step.onclick}
						<button type="button" class="block w-full cursor-pointer rounded-md p-0 text-left transition-colors hover:bg-surface-2 relative after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']" title="Перейти: {step.name}" aria-label="Перейти к шагу {i + 1}: {step.name}" onclick={step.onclick}>
							{@render cell(step, i)}
						</button>
					{:else}
						<div class="block w-full" title={step.name} aria-current={step.state === 'current' ? 'step' : undefined}>{@render cell(step, i)}</div>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
{/if}
