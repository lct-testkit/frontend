<script module lang="ts">
	export const meta = {
		block: 'B12',
		title: 'Пусто, загрузка, ошибка',
		note: 'Своего эталона у DS нет (скелетона и «пустого места» в rt-ui нет) — состояния собраны из его токенов. Загрузка (Skeleton) — серые плитки того же места и высоты, что и содержимое: строки текста 20 px, строки таблицы 40 px, строки списка 56 px, плитка — любой высоты; страница не прыгает, когда данные приходят. Пусто (EmptyState) — одна строка и, если нужно, одно действие, которое это чинит. Ошибка (ErrorState) — что случилось человеческими словами и «Повторить»; для 403 и 404 повтора нет, для серверной ошибки — код обращения.'
	};
</script>

<script lang="ts">
	import { Loader } from '@lct-testkit/rt-ui';
	import { AddLarge, Search } from '@lct-testkit/rt-ui/icons';
	import { ApiError } from '$lib/api/errors';
	import { Btn, Card, EmptyState, ErrorState, Skeleton } from '$lib/ui';
	import DemoState from '../DemoState.svelte';

	const forbidden = new ApiError({ status: 403, detail: 'У вас нет прав на просмотр этого раздела' });
	const missing = new ApiError({ status: 404, detail: 'Сделки с таким номером нет или она удалена' });
	const offline = new ApiError({ status: 0, detail: 'Нет ответа от сервера' });
	const server = new ApiError({ status: 500, detail: 'Сервис временно недоступен', requestId: 'e13fde2d-c936-44f9-8810-54ca12a84382' });
	const general = new Error('Что-то пошло не так');
</script>

<DemoState title="Загрузка: четыре вида — строки текста, строки таблицы, строки списка, плитки" bare>
	<div class="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		<Card title="lines — текст в карточке">
			<Skeleton kind="lines" rows={4} />
		</Card>
		<Card title="rows — строки таблицы и настроек">
			<Skeleton kind="rows" rows={4} />
		</Card>
		<Card title="list — строки списка (задачи, уведомления)">
			<Skeleton kind="list" rows={3} />
		</Card>
		<Card title="tile — карточки, графики, колонки доски">
			<div class="grid grid-cols-3 gap-3 max-md:grid-cols-1">
				<Skeleton kind="tile" />
				<Skeleton kind="tile" />
				<Skeleton kind="tile" />
			</div>
		</Card>
	</div>
</DemoState>

<DemoState title="Загрузка одной кнопки, шага мастера и списка «Показать ещё»" bare>
	<div class="flex flex-wrap items-center gap-6">
		<Btn label="Сохранить" loading />
		<Btn label="Отмена" variant="outline" colorScheme="neutral" loading />
		<div class="flex items-center gap-2 text-muted"><Loader size="2xs" /><span class="t-body-s">Проверяем…</span></div>
		<div class="flex w-40 justify-center rounded-lg border border-line py-8"><Loader size="m" /></div>
	</div>
</DemoState>

<DemoState title="Пусто: только заголовок · с подсказкой · с действием · со значком · сжатое в карточке" bare>
	<div class="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		<div class="rounded-lg border border-line bg-surface"><EmptyState title="Задач нет" /></div>
		<div class="rounded-lg border border-line bg-surface"><EmptyState title="Ничего не найдено" hint="Измените поиск или снимите часть фильтров." /></div>
		<div class="rounded-lg border border-line bg-surface">
			<EmptyState title="Сделок пока нет" hint="Создайте первую — она появится здесь.">
				{#snippet action()}<Btn label="Новая сделка" icon={AddLarge} />{/snippet}
			</EmptyState>
		</div>
		<div class="rounded-lg border border-line bg-surface"><EmptyState title="Ничего не найдено" hint="Проверьте написание или попробуйте ИНН." icon={Search} /></div>
		<Card title="Мои задачи"><EmptyState title="Задач нет" compact /></Card>
		<Card title="Участники"><EmptyState title="Участников нет" hint="Добавьте коллег, чтобы они видели сделку." compact /></Card>
	</div>
</DemoState>

<DemoState title="Ошибка: общая · нет доступа · не найдено · нет соединения · серверная с кодом · без «Повторить» · сжатая" bare>
	<div class="grid grid-cols-2 items-start gap-4 max-lg:grid-cols-1">
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={general} onRetry={() => {}} /></div>
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={forbidden} onRetry={() => {}} /></div>
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={missing} onRetry={() => {}} /></div>
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={offline} onRetry={() => {}} /></div>
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={server} onRetry={() => {}} /></div>
		<div class="rounded-lg border border-line bg-surface"><ErrorState error={general} /></div>
		<Card title="Мои задачи"><ErrorState error={server} onRetry={() => {}} compact /></Card>
	</div>
</DemoState>

<DemoState title="В контексте: одна и та же карточка — грузится, пуста, не открылась" bare>
	<div class="grid grid-cols-3 items-start gap-4 max-lg:grid-cols-1">
		<Card title="На подпись"><Skeleton kind="lines" rows={3} /></Card>
		<Card title="На подпись"><EmptyState title="Документов на подпись нет" compact /></Card>
		<Card title="На подпись"><ErrorState error={server} onRetry={() => {}} compact /></Card>
	</div>
</DemoState>
