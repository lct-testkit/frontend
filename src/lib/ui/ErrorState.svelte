<script lang="ts">
	// A failed load: the human sentence from the error + Retry. 403/404 get their own wording.
	import { AttentionMark, Refresh } from '@lct-testkit/rt-ui/icons';
	import { ApiError, errorMessage } from '$lib/api/errors';
	import Btn from './Btn.svelte';

	let { error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean } = $props();

	const title = $derived(
		error instanceof ApiError
			? error.isForbidden
				? 'Нет доступа'
				: error.isNotFound
					? 'Не найдено'
					: error.isNetwork
						? 'Нет соединения'
						: 'Не удалось загрузить'
			: 'Не удалось загрузить'
	);
	const retryable = $derived(!(error instanceof ApiError && (error.isForbidden || error.isNotFound)));
	const requestId = $derived(error instanceof ApiError && error.status >= 500 ? error.requestId : null);
</script>

<div class={['flex flex-col items-center gap-2 text-center', compact ? 'px-3 py-6' : 'px-4 py-12']} role="alert">
	<span class="inline-flex size-14 items-center justify-center rounded-full bg-danger-soft [&_svg]:size-7 [&_svg]:fill-danger"><AttentionMark /></span>
	<p class="t-body-l-strong">{title}</p>
	<p class="t-body-m max-w-115 text-muted">{errorMessage(error)}</p>
	{#if requestId}<p class="t-desc-m font-mono text-soft">Код обращения: {requestId}</p>{/if}
	{#if onRetry && retryable}<Btn label="Повторить" icon={Refresh} variant="outline" colorScheme="neutral" onclick={onRetry} />{/if}
</div>
