<script lang="ts">
	// Мастер импорта: 5 шагов. Шаги — WizardSteps (степпер дизайн-системы на десктопе, «Шаг 2 из 5» и полоса на телефоне); каждый шаг — WizardCard: содержимое и кнопки шага.
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { ApiError } from '$lib/api';
	import { ErrorState, Page, PageHeader, WizardSteps } from '$lib/ui';
	import { session } from '$lib/auth/session.svelte';
	import { useLeaveGuard } from '$lib/ui/leave-guard.svelte';
	import { ImportFlow, WIZARD_STEPS } from './flow.svelte';
	import StepCheck from './StepCheck.svelte';
	import StepDone from './StepDone.svelte';
	import StepFile from './StepFile.svelte';
	import StepMapping from './StepMapping.svelte';

	const flow = new ImportFlow();
	// файл выбран или загружен, но импорт ещё не запущен: уход со страницы бросит начатое
	useLeaveGuard(() => (flow.step === 0 ? !!flow.file : flow.step < 3), 'Начатый импорт не будет запущен.');
	const jobId = $derived(page.url.searchParams.get('job'));

	onMount(() => {
		if (jobId) void flow.restore(jobId);
		else void flow.loadTypes();
	});
	onDestroy(() => flow.stop());
</script>

<Page narrow class="max-w-4xl!">
	<PageHeader title="Новый импорт" back="/imports" />
	{#if !session.can('import:run')}
		<ErrorState error={new ApiError({ status: 403, detail: 'Импорт доступен руководителю и администратору.' })} />
	{:else}
		<WizardSteps steps={WIZARD_STEPS} current={flow.step} />

		{#if flow.step === 0}
			<StepFile {flow} />
		{:else if flow.step === 1}
			<StepMapping {flow} />
		{:else if flow.step === 2}
			<StepCheck {flow} />
		{:else}
			<StepDone {flow} />
		{/if}
	{/if}
</Page>
