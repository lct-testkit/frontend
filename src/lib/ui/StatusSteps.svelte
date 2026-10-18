<script lang="ts" module>
	export interface Step {
		id: string;
		name: string;
		/**
		 * done = passed, skipped = an optional step the object bypassed, current = here, stopped = the object left the pipeline from this step
		 * (lost, parked), earlier = ahead but the object has been there already (after a return), future = ahead
		 */
		state: 'done' | 'skipped' | 'current' | 'earlier' | 'future' | 'stopped';
		/** the step may be bypassed: «· необязательный» is added to its name */
		optional?: boolean;
		/** present when the step can be entered now */
		onclick?: () => void;
		/** why the step cannot be entered (shown as the tooltip of an inactive step) */
		hint?: string;
	}
</script>

<script lang="ts">
	// The path of an object through its pipeline (a deal through the funnel): ONE line of named steps that scrolls by itself so the current step
	// is in the middle and about three steps before and three after are in view («…3 4 5 [6] 7 8 9…»); the first and the last one are out of sight
	// until you get there. There is no such component in rt-ui (its Wizard is a row of numbered tiles that does not fit 14 steps).
	// The scrollbar is hidden (it was the bug of the first version): the row is moved by touch, wheel, trackpad, the ‹ › buttons or a click on a step.
	// Each step is a coloured bar with «N Name» under it: done = accent, skipped = dashed outline, current = accent with a ring, lost = red,
	// earlier = pale accent, ahead = grey. The full name of the current step is on the header line (the names of the funnel are long).
	// A step that can be entered right now is a button; the rest are inert.
	import type { Snippet } from 'svelte';
	import { ChevronLeft, ChevronRight } from '@lct-testkit/rt-ui/icons';
	import IconBtn from './IconBtn.svelte';

	interface Props {
		steps: Step[];
		/** the right end of the header line: a badge of the final status (won / lost / parked) */
		end?: Snippet;
		/** an action next to the name of the current step (a link to rename it); not on a phone, where the name line is hidden */
		here?: Snippet;
		label?: string;
	}

	let { steps, end, here, label = 'Этапы воронки' }: Props = $props();

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

	// keep the current step in the middle of the row (instantly the first time, smoothly afterwards); the row is moved by whole steps so that
	// the cells at its edges are not cut in half (only the steps that do not fit are hidden)
	let placed = false;
	function center() {
		if (!strip) return;
		const cells = [...strip.children] as HTMLElement[];
		const here = strip.querySelector<HTMLElement>('[data-here]');
		const behavior = placed ? 'smooth' : 'instant';
		if (!here && steps.length && steps.every((s) => s.state === 'done' || s.state === 'skipped')) {
			// closed successfully: show the end of the path
			strip.scrollTo({ left: strip.scrollWidth, behavior });
			placed = true;
			return measure();
		}
		if (!here || cells.length < 2) return measure();
		const pitch = cells[1].offsetLeft - cells[0].offsetLeft;
		const visible = Math.max(1, Math.floor((strip.clientWidth + (pitch - cells[0].offsetWidth) + 2) / pitch)); // +2 px: rounding of fractional widths
		const first = Math.min(Math.max(0, cells.indexOf(here) - Math.floor((visible - 1) / 2)), Math.max(0, cells.length - visible));
		strip.scrollTo({ left: cells[first].offsetLeft - cells[0].offsetLeft, behavior });
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
	const passed = $derived(steps.filter((s) => s.state === 'done' || s.state === 'skipped').length);
	const skippedNumbers = $derived(steps.flatMap((s, i) => (s.state === 'skipped' ? [i + 1] : [])));
	// a successfully closed object has passed everything: «все шаги пройдены» instead of a wrong «шаг 0»
	const caption = $derived.by(() => {
		const skipped = skippedNumbers.length ? `${skippedNumbers.length === 1 ? 'пропущен' : 'пропущены'}: ${skippedNumbers.join(', ')}` : '';
		if (at >= 0) return `Шаг ${at + 1} из ${steps.length}${skipped ? `, ${skipped}` : ''}`;
		if (passed === steps.length) return skipped ? `Все шаги пройдены, ${skipped}` : 'Все шаги пройдены';
		return `Шагов: ${steps.length}`;
	});
	const hereName = $derived(steps[at]?.name ?? '');

	const FILL: Record<Step['state'], string> = {
		done: 'bg-accent',
		skipped: 'border-2 border-dashed border-muted/70 bg-transparent',
		current: 'bg-accent ring-2 ring-accent/30',
		stopped: 'bg-danger ring-2 ring-danger/30',
		earlier: 'bg-accent/30',
		future: 'bg-surface-3'
	};
	const TEXT: Record<Step['state'], string> = {
		done: 't-desc-l text-fg',
		skipped: 't-desc-l text-muted',
		current: 't-desc-l-strong text-fg',
		stopped: 't-desc-l-strong text-danger',
		earlier: 't-desc-l text-muted',
		future: 't-desc-l text-muted'
	};
	// the screen-reader text of a state (the colour alone says nothing to a reader)
	const STATE_TEXT: Record<Step['state'], string> = {
		done: 'пройден',
		skipped: 'пропущен',
		current: 'текущий шаг',
		stopped: 'остановлена здесь',
		earlier: 'был пройден раньше',
		future: 'впереди'
	};
	const nameOf = (step: Step) => (step.optional ? `${step.name} · необязательный` : step.name);
</script>

{#snippet cell(step: Step, i: number)}
	<span class={['block h-1.5 w-full rounded-full', FILL[step.state]]}></span>
	<span class={[TEXT[step.state], 'mt-1.5 line-clamp-3 break-words']}><span class="text-soft">{i + 1}</span> {step.name}{#if step.optional}<span class="text-soft"> · необязательный</span>{/if}<span class="sr-only">, {STATE_TEXT[step.state]}</span></span>
{/snippet}

{#if steps.length}
	<div class="flex min-w-0 flex-col gap-2" role="group" aria-label={label}>
		<div class="flex min-h-9 min-w-0 items-center gap-3">
			<span class="t-body-s-strong flex-none">{caption}</span>
			{#if hereName}<span class="t-body-s min-w-0 flex-1 truncate text-muted max-md:hidden" title={hereName}>{hereName}</span>{/if}
			{#if here && hereName}<span class="flex-none max-md:hidden">{@render here()}</span>{/if}
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
		<ol bind:this={strip} class="relative m-0 flex list-none snap-x gap-3 overflow-x-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" onscroll={measure}>
			{#each steps as step, i (step.id)}
				<li class="max-w-none min-w-0 shrink-0 grow-0 basis-[max(8.5rem,calc((100%-4.5rem)/7))] snap-start" data-here={step.state === 'current' || step.state === 'stopped' ? '' : undefined}>
					{#if step.onclick}
						<button type="button" class="block w-full cursor-pointer rounded-md p-0 text-left transition-colors hover:bg-surface-2 relative after:absolute after:inset-x-0 after:-inset-y-3 after:content-['']" title="Перейти: {nameOf(step)}" aria-label="Перейти к шагу {i + 1}: {nameOf(step)}, {STATE_TEXT[step.state]}" onclick={step.onclick}>
							{@render cell(step, i)}
						</button>
					{:else}
						<div class="block w-full" title={`${nameOf(step)}${step.state === 'skipped' ? ' (пропущен)' : ''}${step.hint ? `. ${step.hint}` : ''}`} aria-current={step.state === 'current' ? 'step' : undefined}>{@render cell(step, i)}</div>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
{/if}
