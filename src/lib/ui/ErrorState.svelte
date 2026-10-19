<script lang="ts">
	// A failed load: the human sentence from the error + Retry. 403/404 get their own wording.
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AttentionMark, Refresh } from '@lct-testkit/rt-ui/icons';
	import { ApiError, errorCode, errorHelpHref, errorMessage } from '$lib/api/errors';
	import Btn from './Btn.svelte';
	import { errorBackLink } from './error-back';

	let { error, onRetry, compact = false }: { error: unknown; onRetry?: () => void; compact?: boolean } = $props();

	const title = $derived(
		error instanceof ApiError
			? error.isForbidden
				? 'Нет доступа'
				: error.isNotFound
					? 'Не найдено'
					: error.isNetwork
						? 'Нет соединения'
						: error.isValidation
							? 'Не удалось открыть'
							: 'Не удалось загрузить'
			: 'Не удалось загрузить'
	);
	const retryable = $derived(!(error instanceof ApiError && (error.isForbidden || error.isNotFound || error.isValidation)));
	// повтор тут не поможет: человеку нужен выход — список раздела, в котором он был
	const back = $derived(!retryable ? errorBackLink(page.url.pathname) : null);
	const requestId = $derived(error instanceof ApiError && error.status >= 500 ? error.requestId : null);
	const code = $derived(errorCode(error));
</script>

<div class={['flex flex-col items-center gap-2 text-center', compact ? 'px-3 py-6' : 'px-4 py-12']} role="alert">
	<span class="inline-flex size-14 items-center justify-center rounded-full bg-danger-soft [&_svg]:size-7 [&_svg]:fill-danger"><AttentionMark /></span>
	<p class="t-body-l-strong">{title}</p>
	<p class="t-body-m max-w-115 text-muted">{errorMessage(error)}</p>
	{#if code}<p class="t-desc-l text-soft" data-testid="error-code">Код ошибки: {code} · <a href={errorHelpHref(code)}>Что это значит</a></p>{/if}
	{#if requestId}<p class="t-desc-m font-mono text-soft">Код обращения: {requestId}</p>{/if}
	{#if onRetry && retryable}<Btn label="Повторить" icon={Refresh} variant="outline" colorScheme="neutral" onclick={onRetry} />{/if}
	{#if back}<Btn label={back.label} variant="outline" colorScheme="neutral" onclick={() => goto(back.href)} data-testid="error-back" />{/if}
</div>
