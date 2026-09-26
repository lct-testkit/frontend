<script lang="ts">
	// «Загляните сюда»: акцентная точка с мягким пульсом. Стоит у «Справки», пока её не открыли (у `Counter` дизайн-системы внутри число — здесь его нет).
	// Пульс включается только при `motion-safe`: с prefers-reduced-motion остаётся спокойная точка.
	// Кольцо пульса и сама точка лежат в одной ячейке сетки, а не друг на друге через `absolute`: так хозяин точки волен сам сделать её `absolute` (угол иконки).
	let { class: className = '' }: { class?: string } = $props();
</script>

<span class={['inline-grid size-2.5 flex-none', className]} aria-hidden="true" data-attention-dot>
	<span class="col-start-1 row-start-1 rounded-full bg-accent opacity-60 motion-safe:animate-ping"></span>
	<span class="col-start-1 row-start-1 rounded-full bg-accent"></span>
</span>
