<script module lang="ts">
	export const meta = {
		block: 'B10',
		title: 'Сообщения: плашки, тосты, подтверждения',
		note: 'Эталон: сторис Notification (InlineNotification, ToastNotification) и пример CRM (окно подтверждения, тосты). Плашка (Notice) — сообщение внутри страницы или окна: 4 тона, заголовок и текст, до двух кнопок, крестик по желанию. Тост — короткий ответ на действие, справа сверху, до трёх сразу, сам уходит (успех 3,5 с, инфо 5 с, предупреждение 7 с, ошибка 9 с). Подтверждение (confirm) — окно по центру: заголовок h2, пояснение, две кнопки одной ширины, главная первой; на телефоне столбиком, главная внизу.'
	};
</script>

<script lang="ts">
	import { Btn, Card, Notice, confirm, toast } from '$lib/ui';
	import DemoState from '../DemoState.svelte';

	let closed = $state<Record<string, boolean>>({});
	let answer = $state('');

	async function ask(options: Parameters<typeof confirm>[0]) {
		const yes = await confirm(options);
		answer = yes ? `«${options.confirmLabel ?? 'Подтвердить'}»` : 'Отмена';
	}

	const TONES = ['info', 'success', 'warning', 'error'] as const;
	const NAMES = { info: 'Информация', success: 'Успех', warning: 'Предупреждение', error: 'Ошибка' } as const;
</script>

<DemoState title="Плашки: заголовок, текст, кнопки, крестик — в каждом из четырёх тонов" bare>
	<div class="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		{#each TONES as tone (tone)}
			<Card title={NAMES[tone]}>
				<div class="flex flex-col gap-3">
					<Notice {tone} title="Только заголовок" />
					<Notice {tone}>Только текст: что произошло и что делать дальше.</Notice>
					<Notice {tone} title="Заголовок и текст">Сделка передана менеджеру, он получит уведомление.</Notice>
					<Notice {tone} title="Заголовок, текст и одна кнопка" actions={[{ label: 'Открыть сделку', onclick: () => {} }]}>Проверьте карточку до конца дня.</Notice>
					<Notice
						{tone}
						title="Две кнопки"
						actions={[
							{ label: 'Принять все', onclick: () => {}, variant: 'primary' },
							{ label: 'Позже', onclick: () => {} }
						]}
					>
						Реквизиты изменились в ЕГРЮЛ.
					</Notice>
					{#if !closed[tone]}
						<Notice {tone} title="С крестиком" onClose={() => (closed[tone] = true)}>Закрывается и не возвращается, пока страницу не обновят.</Notice>
					{:else}
						<Btn label="Показать плашку с крестиком снова" variant="ghost" colorScheme="neutral" size="s" onclick={() => (closed[tone] = false)} />
					{/if}
					<Notice {tone} title="Длинный текст">
						Импорт остановлен на строке 1 204: значение в колонке «ИНН» не похоже на ИНН (10 или 12 цифр). Исправьте файл и загрузите его заново — уже принятые строки не пострадают, повторная загрузка их не задвоит.
					</Notice>
				</div>
			</Card>
		{/each}
	</div>
</DemoState>

<DemoState title="Тосты: нажмите — появятся справа сверху" bare>
	<div class="flex flex-wrap gap-3">
		<Btn label="Успех" variant="outline" colorScheme="neutral" onclick={() => toast.success('Сделка создана', 'D-2026-000431')} />
		<Btn label="Успех, одна строка" variant="outline" colorScheme="neutral" onclick={() => toast.success('Сохранено')} />
		<Btn label="Информация" variant="outline" colorScheme="neutral" onclick={() => toast.info('Загружена актуальная версия', 'Проверьте поля и сохраните ещё раз')} />
		<Btn label="Предупреждение" variant="outline" colorScheme="neutral" onclick={() => toast.warning('Данные изменил другой пользователь', 'Ваш ввод сохранён в форме')} />
		<Btn label="Ошибка" variant="outline" colorScheme="neutral" onclick={() => toast.error(new Error('Не удалось сохранить'))} />
		<Btn label="Ошибка с заголовком" variant="outline" colorScheme="neutral" onclick={() => toast.error(new Error('Проверьте подключение к сети и повторите'), 'Не удалось выгрузить журнал')} />
		<Btn
			label="Четыре подряд"
			variant="outline"
			colorScheme="neutral"
			onclick={() => {
				toast.success('Первый', 'Виден до трёх сразу');
				toast.info('Второй');
				toast.warning('Третий');
				toast.success('Четвёртый вытесняет первый');
			}}
		/>
	</div>
</DemoState>

<DemoState title="Подтверждения: нажмите — окно по центру" bare>
	<div class="flex flex-wrap items-center gap-3">
		<Btn label="Просто вопрос" variant="outline" colorScheme="neutral" onclick={() => ask({ title: 'Закрыть без сохранения?', message: 'Введённое будет потеряно.', confirmLabel: 'Закрыть', cancelLabel: 'Продолжить' })} />
		<Btn label="Опасное действие" variant="outline" colorScheme="neutral" onclick={() => ask({ title: 'Удалить сделку D-2026-000431?', message: 'Это действие нельзя отменить — карточка исчезнет из списка.', confirmLabel: 'Удалить', danger: true })} />
		<Btn label="Без пояснения" variant="outline" colorScheme="neutral" onclick={() => ask({ title: 'Опубликовать воронку?' })} />
		<Btn label="Длинный заголовок и подписи" variant="outline" colorScheme="neutral" onclick={() => ask({ title: 'Передать все открытые сделки сотрудника «Петров Пётр Сергеевич» другому менеджеру?', message: 'Сделки получат нового ответственного, прежнему придёт уведомление, а в журнале останется запись об изменении.', confirmLabel: 'Передать сделки', cancelLabel: 'Оставить как есть' })} />
		{#if answer}<span class="t-body-s text-muted">Ответ: {answer}</span>{/if}
	</div>
</DemoState>
