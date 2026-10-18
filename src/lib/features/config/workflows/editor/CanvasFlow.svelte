<script lang="ts">
	// Холст воронки на @xyflow/svelte. Узлы и рёбра строятся из черновика редактора; правки идут обратно в редактор (позиция, переход, выбор).
	// Единственный глобальный CSS из фичи — стили xyflow; тема — через его переменные `--xy-*` на токенах дизайн-системы.
	import '@xyflow/svelte/dist/style.css';
	import { untrack } from 'svelte';
	import { Background, BackgroundVariant, Controls, MarkerType, MiniMap, Panel, SvelteFlow, useSvelteFlow, type Connection } from '@xyflow/svelte';
	import { Chip } from '@lct-testkit/rt-ui';
	import { AddLarge, Magic } from '@lct-testkit/rt-ui/icons';
	import { IconBtn } from '$lib/ui';
	import { LARGE_GRAPH, toFlow, type StatusNode, type TransitionEdge } from '../graph';
	import { statusColor } from '../palette';
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
	let total = $state(0);

	const { fitView } = useSvelteFlow();
	// большой граф целиком не читается: начинаем с начала воронки в масштабе, где виден текст; «Показать всё» — на панели управления
	const editable = $derived(interactive && !editor.readonly);

	// черновик / позиции / проблемы / выбор → узлы и рёбра холста
	$effect(() => {
		const sel = editor.selection;
		const marked = editor.marked;
		// выбран статус — видны все рёбра, что к нему подходят; выбран переход или отмечено замечанием — они сами, какой бы слой ни был скрыт
		const pinned = new Set<string>(marked);
		if (sel?.kind === 'transition') pinned.add(sel.key);
		if (sel?.kind === 'status') for (const t of editor.draft.transitions) if (t.from === sel.key || t.to === sel.key) pinned.add(t.key);
		const flow = toFlow(editor.draft, editor.positions, editor.issues, { readonly: !editable, compactLabels: editor.draft.transitions.length > LARGE_GRAPH.transitions, layers: editor.layers, pinned });
		total = flow.total;
		nodes = flow.nodes.map((n) => ({ ...n, selected: (sel?.kind === 'status' && sel.key === n.id) || marked.has(n.id) }));
		// выбран статус или переход — остальные рёбра приглушаем, иначе в плотной воронке ничего не разобрать
		const related = (e: TransitionEdge) => (sel?.kind === 'status' ? e.source === sel.key || e.target === sel.key : sel?.kind === 'transition' ? e.id === sel.key : true);
		edges = flow.edges.map((e) => ({
			...e,
			data: e.data && { ...e.data, select: () => editor.select({ kind: 'transition', key: e.id }) },
			selected: (sel?.kind === 'transition' && sel.key === e.id) || marked.has(e.id),
			class: related(e) || marked.has(e.id) ? undefined : 'opacity-15'
		}));
	});

	// «показать на холсте» (клик по проблеме, автораскладка)
	$effect(() => {
		const request = editor.focus;
		if (!request) return;
		untrack(() => {
			// ключ — узел или переход (у перехода показываем оба конца); у замечания про несколько узлов в кадре все
			const ids = new Set<string>();
			for (const key of request.keys) {
				const transition = editor.draft.transitions.find((t) => t.key === key);
				for (const id of transition ? [transition.from, transition.to] : [key]) if (nodes.some((n) => n.id === id)) ids.add(id);
			}
			const single = ids.size === 1;
			// небольшая задержка: узлы должны успеть получить новые позиции
			setTimeout(
				() => void fitView(ids.size ? { nodes: [...ids].map((id) => ({ id })), duration: 300, maxZoom: single ? 1.1 : 0.9, padding: single ? 0.6 : 0.3 } : { duration: 300, padding: 0.2, maxZoom: 1 }),
				60
			);
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
		fitView
		fitViewOptions={{ padding: { top: '60px', left: '56px', bottom: '12px', right: '12px' }, maxZoom: 1 }}
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
		{#if minimap}
			<!-- цвет узла — цвет статуса, узлы с ошибками обведены красным -->
			<MiniMap
				pannable
				zoomable
				position="bottom-right"
				class="rounded-md! border border-line"
				nodeColor={(n) => statusColor((n as StatusNode).data.status)}
				nodeStrokeColor={(n) => ((n as StatusNode).data.issues.some((i) => i.severity === 'error') ? 'var(--atmr-error-default)' : 'transparent')}
				nodeStrokeWidth={4}
			/>
		{/if}
		{#if interactive && editor.draft.transitions.length > LARGE_GRAPH.transitions}
			<!-- плотная воронка (десктоп; на телефоне холст — просмотр, там списки): слои рёбер; «Показано N из M» — чтобы не искать пропавшие «Отказ» и «Заморозку» -->
			<Panel position="top-right" class="m-2! flex flex-wrap items-center justify-end gap-1.5 max-md:m-1!">
				<span class="t-desc-l rounded-full bg-surface px-2 py-0.5 text-muted shadow-s" aria-live="polite" data-testid="layers-count">Показано {edges.length} из {total}</span>
				<Chip size="s" variant="secondary" selected={editor.layers.has('back')} label="Возвраты" onclick={() => editor.toggleLayers(['back'])} data-testid="layer-back" />
				<Chip size="s" variant="secondary" selected={editor.layers.has('exit') && editor.layers.has('resume')} label="Отказ и заморозка" onclick={() => editor.toggleLayers(['exit', 'resume'])} data-testid="layer-exit" />
				<Chip size="s" variant="secondary" selected={editor.layers.size === 5} label="Все" onclick={() => editor.toggleAllLayers()} data-testid="layer-all" />
			</Panel>
		{/if}
		{#if editable}
			<Panel position="top-left" class="flex gap-1.5">
				<IconBtn icon={AddLarge} label="Добавить статус" variant="secondary" onclick={() => editor.addStatus()} />
				<IconBtn icon={Magic} label="Расставить автоматически" variant="secondary" onclick={() => editor.autoLayout()} />
			</Panel>
		{/if}
	</SvelteFlow>
</div>
