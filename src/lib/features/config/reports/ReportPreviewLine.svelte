<script lang="ts">
	// Под параметрами отчёта: сколько строк найдётся, ещё до «Запустить». Пустой результат — предупреждение, а не сюрприз после запуска.
	// Сбой, лимит частоты и медленный ответ строку просто прячут (см. preview.svelte.ts); «Запустить» от неё не зависит.
	import { onDestroy, untrack } from 'svelte';
	import { Notice } from '$lib/ui';
	import { ReportPreview } from './preview.svelte';
	import { previewText } from './preview';

	interface Props {
		code: string;
		/** параметры в виде, в каком они уйдут на сервер; `null` — форма в ошибке или не на этапе ввода, считать нечего */
		params: Record<string, unknown> | null;
	}

	let { code, params }: Props = $props();

	const preview = new ReportPreview();
	$effect(() => {
		const p = params;
		untrack(() => (p ? preview.request(code, p) : preview.clear()));
	});
	onDestroy(() => preview.destroy());

	const view = $derived(previewText(preview.rows, preview.exact, typeof params?.limit === 'number' ? params.limit : null, preview.phase));
</script>

<!-- полоса прилипает к низу прокручиваемой панели, над кнопками: правят параметры наверху, число должно быть на виду (на телефоне форма длиннее экрана); поля панели 24 px (телефон 16), полоса выходит на них -->
{#if view.kind !== 'none'}
	<div class="sticky -bottom-6 z-10 -mx-6 -mb-6 border-t border-line bg-elevated px-6 py-2 max-md:-bottom-4 max-md:-mx-4 max-md:-mb-4 max-md:px-4">
		{#if view.kind === 'empty'}
			<Notice tone="warning" class={view.stale ? 'opacity-60' : ''} data-testid="report-preview">{view.text}</Notice>
		{:else}
			<p class={['t-desc-l m-0 text-muted', view.stale && 'opacity-60']} aria-live="polite" data-testid="report-preview">{view.text}</p>
		{/if}
	</div>
{/if}
