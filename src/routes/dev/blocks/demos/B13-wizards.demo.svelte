<script module lang="ts">
	export const meta = {
		block: 'B13',
		title: 'Мастера',
		note: 'Эталон: сторис Wizard (WizardStepsHorizontal) и рецепты форм. Шаги — WizardSteps: на странице (десктоп) степпер дизайн-системы (номер на плитке, линия между плитками), в окне и на телефоне — «Шаг 2 из 5 · Проверка» и тонкая полоса. Шаг — WizardCard: содержимое на карточке, под ним за тонкой линией (как подвал окна) кнопки шага: ГЛАВНАЯ первой («Далее», «Применить»), остальные после неё, слева; на телефоне столбиком, главная внизу, размер l. Поля — те же, что в формах (B9), загрузка, пусто и ошибка — как в B12. Мастера приложения: импорт (страница), увольнение сотрудника (страница), отправка на подпись и архивация статуса (окна).'
	};
</script>

<script lang="ts">
	import { Loader } from '@lct-testkit/rt-ui';
	import { Progress } from '@lct-testkit/rt-ui/ext';
	import { CheckLarge, Download } from '@lct-testkit/rt-ui/icons';
	import { ApiError } from '$lib/api/errors';
	import { AppModal, Btn, ErrorState, Notice, Pick, RadioField, Skeleton, TextField, WizardCard, WizardSteps } from '$lib/ui';
	import CheckField from '$lib/ui/fields/CheckField.svelte';
	import FileField from '$lib/ui/fields/FileField.svelte';
	import DemoState from '../DemoState.svelte';

	const STEPS = ['Файл', 'Сопоставление', 'Проверка', 'Применение', 'Готово'];
	let step = $state(0);
	let entity = $state<string | null>('org');
	let mode = $state<string | null>('upsert');
	let ack = $state(false);

	// a wizard in a window
	let win = $state(false);
	let winStep = $state(0);
	const WIN_STEPS = ['Документ', 'Подписанты'];
	let head = $state(true);
	let days = $state('14');

	const server = new ApiError({ status: 500, detail: 'Сервис временно недоступен', requestId: 'e13fde2d-c936-44f9-8810-54ca12a84382' });
</script>

<DemoState title="Страница-мастер: шаги DS, карточка шага, кнопки шага (нажмите «Далее» / «Назад» — шаги переключаются)" bare>
	<div class="flex max-w-4xl flex-col gap-4">
		<WizardSteps steps={STEPS} current={step} />
		<WizardCard>
			<RadioField
				label="Что загружаем"
				columns={2}
				bind:value={entity}
				items={[
					{ key: 'org', label: 'Организации', hint: 'Вузы и компании; ключ — ИНН' },
					{ key: 'product', label: 'Продукты', hint: 'Курсы и программы; ключ — код продукта' }
				]}
			/>
			<Pick
				label="Существующие записи"
				bind:value={mode}
				hint="Новые записи создаются, существующие обновляются по ключу"
				items={[
					{ key: 'upsert', value: 'Создать и обновить' },
					{ key: 'create', value: 'Только создать' }
				]}
			/>
			<FileField label="Перетащите файл сюда" hint="Excel (.xlsx, .xls) или CSV, до 50 МБ" accept={{ 'text/csv': ['.csv'] }} onPick={() => {}} />
			{#snippet actions()}
				<Btn label={step === 4 ? 'Готово' : 'Далее'} disabled={step === 4} onclick={() => (step = Math.min(step + 1, 4))} />
				<Btn label="Назад" variant="outline" colorScheme="neutral" disabled={step === 0} onclick={() => (step = Math.max(step - 1, 0))} />
			{/snippet}
		</WizardCard>
	</div>
</DemoState>

<DemoState title="Шаг «Проверка»: итог, предупреждение, кнопка отчёта; главная кнопка первой" bare>
	<div class="flex max-w-4xl flex-col gap-4">
		<WizardSteps steps={STEPS} current={2} />
		<WizardCard>
			<div class="grid grid-cols-3 gap-3 max-md:grid-cols-1">
				{#each [['Всего строк в файле', '240'], ['Будут загружены', '233'], ['С ошибками', '7']] as [label, value] (label)}
					<div class="flex flex-col rounded-md border border-line bg-surface-2 px-3 py-2">
						<span class="t-h3 tabular-nums">{value}</span>
						<span class="t-desc-l text-muted">{label}</span>
					</div>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-3 rounded-md bg-surface-2 px-3 py-2.5">
				<p class="t-body-s min-w-0 flex-1">Строки с ошибками будут пропущены — остальные загрузятся.</p>
				<Btn label="Отчёт об ошибках" icon={Download} size="s" variant="outline" colorScheme="neutral" />
			</div>
			{#snippet actions()}
				<Btn label="Применить 233 строки" />
				<Btn label="К сопоставлению" variant="outline" colorScheme="neutral" />
			{/snippet}
		</WizardCard>
	</div>
</DemoState>

<DemoState title="Шаги без кнопок и с одной кнопкой: идёт работа · ошибка · готово" bare>
	<div class="flex max-w-4xl flex-col gap-4">
		<WizardCard>
			<div class="flex flex-col items-center gap-3 py-8" aria-busy="true">
				<Loader size="m" />
				<p class="t-body-m text-muted">Проверяем строки…</p>
			</div>
		</WizardCard>
		<WizardCard>
			<div class="flex flex-col items-center gap-4 py-6 text-center" aria-busy="true">
				<Progress indeterminate label="Применяем импорт…" class="w-full max-w-md" />
				<p class="t-desc-l text-muted">233 строки в работе — страницу можно не закрывать, ход обновляется сам</p>
			</div>
		</WizardCard>
		<WizardCard>
			<ErrorState error={server} onRetry={() => {}} compact />
			{#snippet actions()}
				<Btn label="К сопоставлению" variant="outline" colorScheme="neutral" />
			{/snippet}
		</WizardCard>
		<WizardCard>
			<Skeleton kind="rows" rows={4} />
		</WizardCard>
		<WizardCard>
			<div class="flex items-center gap-3">
				<span class="inline-flex size-10 flex-none items-center justify-center rounded-full bg-success-soft"><CheckLarge class="size-5 fill-success" /></span>
				<h2 class="t-h4">Импорт завершён</h2>
			</div>
			<p class="t-body-m">Загружено 233 строки, пропущено 7.</p>
			{#snippet actions()}
				<Btn label="Открыть: организации" />
				<Btn label="Новый импорт" variant="outline" colorScheme="neutral" />
				<Btn label="Откатить импорт" variant="outline" colorScheme="neutral" danger />
			{/snippet}
		</WizardCard>
	</div>
</DemoState>

<DemoState title="Мастер в окне: короткая форма шагов «Шаг 1 из 2 · Документ» и полоса; кнопки — подвал окна" bare>
	<div class="flex flex-wrap gap-3">
		<Btn label="Открыть мастер в окне" variant="outline" colorScheme="neutral" onclick={() => ((winStep = 0), (win = true))} />
	</div>
</DemoState>

<AppModal open={win} title="Отправить на подпись" size="m" onClose={() => (win = false)}>
	<WizardSteps steps={WIN_STEPS} current={winStep} compact />
	{#if winStep === 0}
		<Pick label="Шаблон" value="kp" items={[{ key: 'kp', value: 'Согласование коммерческого предложения' }, { key: 'contract', value: 'Договор' }]} />
		<TextField label="Название" value="Согласование коммерческого предложения · D-2026-000076" />
	{:else}
		<CheckField label="Руководитель" bind:checked={head} />
		<CheckField label="Контакт сделки: Никольский Даниил" bind:checked={ack} />
		<TextField label="Срок, дн." bind:value={days} />
		<Notice tone="warning">Внешний подписант не первый: ссылку ему сервер не выдаст.</Notice>
	{/if}
	{#snippet footer()}
		{#if winStep === 0}
			<Btn label="Далее" onclick={() => (winStep = 1)} />
			<Btn label="Отмена" variant="secondary" colorScheme="neutral" onclick={() => (win = false)} />
		{:else}
			<Btn label="Отправить на подпись" onclick={() => (win = false)} />
			<Btn label="Назад" variant="secondary" colorScheme="neutral" onclick={() => (winStep = 0)} />
		{/if}
	{/snippet}
</AppModal>
