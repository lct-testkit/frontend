<script lang="ts">
	// Воронка сделки: блок StatusSteps — по сегменту на шаг, пройденные залиты, текущий выделен, над лентой имя шага и «шаг N из M».
	// Шаг, в который есть доступный переход, кликабелен (открывает диалог перехода). Терминальный статус (успех / отказ / заморозка) —
	// метка справа над лентой; на каком шаге сделка остановилась, берём из истории.
	import { untrack } from 'svelte';
	import { api, unwrap } from '$lib/api';
	import { StatusChip, StatusSteps, type Step } from '$lib/ui';
	import type { AvailableTransition, Deal, WorkflowGraph } from '../../types';
	import { isTerminal, statusTone, steps } from '../statusUtils';

	interface Props {
		graph: WorkflowGraph | undefined;
		deal: Deal;
		transitions: AvailableTransition[];
		onStep?: (transition: AvailableTransition) => void;
	}

	let { graph, deal, transitions, onStep }: Props = $props();

	const list = $derived(steps(graph));
	const current = $derived(graph?.statuses.find((s) => s.id === deal.status_id));
	const terminal = $derived(current && isTerminal(current) ? current : null);

	let stoppedAt = $state<string | null>(null);
	$effect(() => {
		const t = terminal;
		const id = deal.id;
		untrack(() => (stoppedAt = null));
		if (!t || t.type === 'won') return;
		let alive = true;
		void unwrap(api.GET('/api/deals/{deal_id}/history', { params: { path: { deal_id: id } } }))
			.then((h) => {
				if (alive) stoppedAt = h.statuses.filter((s) => s.to_status_id === t.id).at(-1)?.from_status_id ?? null;
			})
			.catch(() => {});
		return () => (alive = false);
	});

	/** индекс текущего шага; у успешно закрытой — за последним (все пройдены) */
	const index = $derived.by(() => {
		if (!terminal) return list.findIndex((s) => s.id === deal.status_id);
		if (terminal.type === 'won') return list.length;
		return stoppedAt ? list.findIndex((s) => s.id === stoppedAt) : -1;
	});

	const view = $derived<Step[]>(
		list.map((step, i) => {
			const transition = transitions.find((t) => t.to_status_id === step.id && t.role_allowed);
			return {
				id: step.id,
				name: step.name,
				state: i < index ? 'done' : i === index ? (terminal ? 'stopped' : 'current') : 'future',
				onclick: transition ? () => onStep?.(transition) : undefined
			};
		})
	);
</script>

<StatusSteps steps={view}>
	{#snippet end()}
		{#if terminal}<StatusChip label={terminal.name} color={terminal.color} tone={statusTone(terminal.type)} />{/if}
	{/snippet}
</StatusSteps>
