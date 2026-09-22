<script lang="ts">
	// Холст воронки на @xyflow/svelte. Узлы и рёбра строятся из черновика редактора; правки идут обратно в редактор (позиция, переход, выбор).
	// Единственный глобальный CSS из фичи — стили xyflow; тема — через его переменные `--xy-*` на токенах дизайн-системы.
	import '@xyflow/svelte/dist/style.css';
	import { untrack } from 'svelte';
	import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, Panel, SvelteFlow, useSvelteFlow, type Connection } from '@xyflow/svelte';
	import { AddLarge, Magic } from '@lct-testkit/rt-ui/icons';
	import { IconBtn } from '$lib/ui';
	import { toFlow, type StatusNode, type TransitionEdge } from '../graph';
	import type { WorkflowEditor } from './editor.svelte';
	import StatusNodeView from './StatusNode.svelte';
	import TransitionEdgeView from './TransitionEdge.svelte';

	interface Props {
		editor: WorkflowEditor;
		/** false — только просмотр (телефон, планшет): панорама и масштаб без перетаскивания и соединения */
		interactive: boolean;
		minimap?: boolean;
	}

	let { editor, interactive, minimap = false }: Props = $props();

	const nodeTypes = { status: StatusNodeView };
	const edgeTypes = { transition: TransitionEdgeView };
	const THEME =
		'[--xy-edge-stroke:var(--atmr-fg-soft)] [--xy-edge-stroke-selected:var(--atmr-accent-default)] [--xy-connectionline-stroke:var(--atmr-accent-default)] [--xy-connectionline-stroke-width:2] ' +
		'[--xy-background-pattern-dots-color:var(--atmr-border-default)] [--xy-minimap-background-color:var(--atmr-bg-surface1)] [--xy-minimap-node-background-color:var(--atmr-bg-surface4)] ' +
		'[--xy-minimap-mask-background-color:color-mix(in_srgb,var(--atmr-bg-surface3)_70%,transparent)] [--xy-controls-button-background-color:var(--atmr-bg-surface1)] ' +
		'[--xy-controls-button-background-color-hover:var(--atmr-bg-surface3)] [--xy-controls-button-color:var(--atmr-fg-default)] [--xy-controls-button-border-color:var(--atmr-border-muted)] ' +
		'[--xy-attribution-background-color:transparent] [--xy-handle-border-color:var(--atmr-bg-surface1)]';

	let nodes = $state.raw<StatusNode[]>([]);
	let edges = $state.raw<TransitionEdge[]>([]);

	const { fitView } = useSvelteFlow();
	// большой граф целиком не читается: начинаем с начала воронки в масштабе, где виден текст; «Показать всё» — на панели управления
	// svelte-ignore state_referenced_locally
	const many = editor.draft.statuses.length > 8;
	const editable = $derived(interactive && !editor.readonly);

	// черновик / позиции / проблемы / выбор → узлы и рёбра холста
	$effect(() => {
		const flow = toFlow(editor.draft, editor.positions, editor.issues, { readonly: !editable, compactLabels: editor.draft.transitions.length > 16 });
		const sel = editor.selection;
		nodes = flow.nodes.map((n) => ({ ...n, selected: sel?.kind === 'status' && sel.key === n.id }));
		// выбран статус или переход — остальные рёбра приглушаем, иначе в плотной воронке ничего не разобрать
		const related = (e: TransitionEdge) => (sel?.kind === 'status' ? e.source === sel.key || e.target === sel.key : sel?.kind === 'transition' ? e.id === sel.key : true);
		edges = flow.edges.map((e) => ({
			...e,
			data: e.data && { ...e.data, select: () => editor.select({ kind: 'transition', key: e.id }) },
			selected: sel?.kind === 'transition' && sel.key === e.id,
			class: related(e) ? undefined : 'opacity-15'
		}));
	});

	// «показать на холсте» (клик по проблеме, автораскладка)
	$effect(() => {
		const request = editor.focus;
		if (!request) return;
		untrack(() => {
			const transition = editor.draft.transitions.find((t) => t.key === request.key);
			const id = transition ? transition.from : request.key;
			const known = id && nodes.some((n) => n.id === id);
			// небольшая задержка: узлы должны успеть получить новые позиции
			setTimeout(() => void fitView(known ? { nodes: [{ id }], duration: 300, maxZoom: 1.1, padding: 0.6 } : { duration: 300, padding: 0.2, maxZoom: 1 }), 60);
		});
	});

	function connect(c: Connection) {
		editor.addTransition(c.source, c.target);
	}
	const valid = (c: Connection | { source: string; target: string }) =>
		c.source !== c.target && !editor.draft.transitions.some((t) => t.from === c.source && t.to === c.target);
</script>

<div class={['size-full', THEME]}>
	<SvelteFlow
		bind:nodes
		bind:edges
		{nodeTypes}
		{edgeTypes}
		colorMode="light"
		fitView={!many}
		initialViewport={{ x: 40, y: 90, zoom: 0.7 }}
		fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
		minZoom={0.2}
		maxZoom={1.6}
		nodesDraggable={editable}
		nodesConnectable={editable}
		elementsSelectable
		deleteKey={null}
		defaultMarkerColor={null}
		defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } }}
		isValidConnection={valid}
		onconnect={connect}
		onnodeclick={({ node }) => editor.select({ kind: 'status', key: node.id })}
		onedgeclick={({ edge }) => editor.select({ kind: 'transition', key: edge.id })}
		onpaneclick={() => editor.select(null)}
		onnodedragstop={({ nodes: moved }) => {
			for (const n of moved) editor.setPosition(n.id, n.position);
		}}
		ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Приблизить', 'controls.zoomOut.ariaLabel': 'Отдалить', 'controls.fitView.ariaLabel': 'Показать всё', 'controls.interactive.ariaLabel': 'Блокировка' }}
	>
		<Background variant={BackgroundVariant.Dots} gap={20} size={1.5} />
		<Controls showLock={false} position="bottom-left" />
		{#if minimap}<MiniMap pannable zoomable position="bottom-right" class="rounded-md! border border-line" />{/if}
		{#if editable}
			<Panel position="top-left" class="flex gap-1.5">
				<IconBtn icon={AddLarge} label="Добавить статус" variant="secondary" onclick={() => editor.addStatus()} />
				<IconBtn icon={Magic} label="Расставить автоматически" variant="secondary" onclick={() => editor.autoLayout()} />
			</Panel>
		{/if}
	</SvelteFlow>
</div>
