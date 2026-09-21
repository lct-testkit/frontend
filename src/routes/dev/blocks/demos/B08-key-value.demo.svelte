<script module lang="ts">
	export const meta = {
		block: 'B8',
		title: 'Ключ — значение',
		note: 'Один блок для всех полей сущности. «Стопкой» (как в карточке DS): подпись 12 px серая над значением 16 px, 1–3 колонки. «В строку» (профиль, настройки): подпись и значение в двух колонках на ОДНОЙ БАЗОВОЙ ЛИНИИ, у всех строк подписи одной ширины. Пустое значение — «—». Длинное значение переносится, ничего не сдвигает.'
	};
</script>

<script lang="ts">
	import { Card, KeyValue, KeyValueList, StatusChip } from '$lib/ui';
	import DemoState from '../DemoState.svelte';
</script>

<DemoState title="Стопкой, 3 колонки (карточка сделки)" bare>
	<Card title="Сделка">
		<KeyValueList columns={3}>
			<KeyValue label="Тип" value="B2B" />
			<KeyValue label="Воронка" value="B2B: продвижение продукта вузу" />
			<KeyValue label="Приоритет"><StatusChip label="Обычный" tone="info" /></KeyValue>
			<KeyValue label="Сумма" value="100 000 ₽" />
			<KeyValue label="Обучающихся" value={null} />
			<KeyValue label="Плановая дата закрытия" value="12.11.2026" />
			<KeyValue label="Источник" value="Импорт каталога" />
			<KeyValue label="Создана" value="21.09.2026, 00:09" />
			<KeyValue label="Причина отказа" value="Заказчик выбрал другого поставщика: у конкурента ниже цена за слушателя и есть готовая площадка в кампусе вуза" />
		</KeyValueList>
	</Card>
</DemoState>

<DemoState title="В строку — на одной базовой линии (профиль)" bare>
	<Card title="Профиль">
		<KeyValueList layout="inline">
			<KeyValue label="Имя" value="Иван Иванов" />
			<KeyValue label="E-mail" value="i.ivanov@rtk-school.example.ru" />
			<KeyValue label="Телефон" value="+7 (9**) ***-**-12" />
			<KeyValue label="Роль"><StatusChip label="Менеджер по вузам" tone="info" /></KeyValue>
			<KeyValue label="Команда" value="Отдел по работе с вузами Поволжского федерального округа" />
			<KeyValue label="Руководитель" value={null} />
		</KeyValueList>
	</Card>
</DemoState>

<DemoState title="Одна колонка (узкая панель, Drawer)" bare>
	<div class="max-w-sm">
		<Card title="Организация">
			<KeyValueList columns={1}>
				<KeyValue label="ИНН" value="7736050003" />
				<KeyValue label="Город" value="Казань" />
				<KeyValue label="Ректор" value="Соколов Игорь Анатольевич" />
			</KeyValueList>
		</Card>
	</div>
</DemoState>
