<script lang="ts">
	// Воронка сделки: блок StatusSteps — по сегменту на шаг. Пройденные залиты, пропущенный необязательный шаг — пунктиром, текущий выделен,
	// шаги, где сделка уже была до возврата, бледные; над лентой «шаг N из M» (и номера пропущенных) и полное название текущего шага.
	// Шаг, в который есть доступный переход, кликабелен (открывает диалог перехода). Терминальный статус (успех / отказ / заморозка) —
	// метка справа над лентой; на каком шаге сделка остановилась и где бывала, берём из истории в состоянии карточки.
	import { goto } from '$app/navigation';
	import { session } from '$lib/auth/session.svelte';
	import { Btn, StatusChip, StatusSteps, type Step } from '$lib/ui';
	import { statusTypeHint } from '../../shared/hints';
	import type { AvailableTransition } from '../../types';
	import { deniedText, isTerminal, optionalStepIds, roleHint, statusName, statusTone, stepStates, steps } from '../statusUtils';
	import type { DealCardState } from './dealCard.svelte';

	interface Props {
		card: DealCardState;
		transitions: AvailableTransition[];
		onStep?: (transition: AvailableTransition) => void;
	}

	let { card, transitions, onStep }: Props = $props();

	const graph = $derived(card.graph);
	const deal = $derived(card.deal!);
	const list = $derived(steps(graph));
	const optional = $derived(optionalStepIds(graph));
	const current = $derived(graph?.statuses.find((s) => s.id === deal.status_id));
	const terminal = $derived(current && isTerminal(current) ? current : null);

	/** индекс текущего шага; у успешно закрытой — за последним (все пройдены) */
	const index = $derived.by(() => {
		if (!terminal) return list.findIndex((s) => s.id === deal.status_id);
		if (terminal.type === 'won') return list.length;
		return card.stoppedAt ? list.findIndex((s) => s.id === card.stoppedAt) : -1;
	});

	const states = $derived(stepStates(list, index, card.visited, optional, !!terminal, card.migrated));

	const view = $derived<Step[]>(
		list.map((step, i) => {
			const toStep = transitions.filter((t) => t.to_status_id === step.id);
			const transition = toStep.find((t) => t.role_allowed);
			// переход в шаг есть, но роли запрещён — подсказка вместо молчаливой неактивности
			const denied = !transition ? toStep[0] : undefined;
			const who = denied ? roleHint(denied, graph) : null;
			return {
				id: step.id,
				name: statusName(step.name),
				state: states[i],
				optional: optional.has(step.id),
				onclick: transition ? () => onStep?.(transition) : undefined,
				hint: denied ? deniedText(who) : undefined
			};
		})
	);
</script>

<StatusSteps steps={view}>
	{#snippet here()}
		<!-- право переименовывать шаги (Руководитель, Администратор): ссылка в редактор воронки с выбранным шагом -->
		{#if current && !terminal && session.can('workflow:rename_status')}
			<Btn label="Переименовать" variant="ghost" colorScheme="neutral" size="s" onclick={() => goto(`/workflows/${deal.workflow_id}?status=${current.id}`)} data-testid="step-rename" />
		{/if}
	{/snippet}
	{#snippet end()}
		{#if terminal}<StatusChip label={statusName(terminal.name)} color={terminal.color} tone={statusTone(terminal.type)} hint={statusTypeHint(terminal.type)} />{/if}
	{/snippet}
</StatusSteps>
