<script module lang="ts">
	export const meta = {
		block: 'B9',
		title: 'Формы: поля, панель и окно формы',
		note: 'Эталон: рецепты DS Drawer «Create project» и Modal «Modal with form». Поле — DS m (36 px), на телефоне l (48 px); подпись НАД рамкой, подсказка или ошибка ПОД ней (поле без size у DS — l, 48 px, подпись внутри: в форме его не бывает). Панель (FormDrawer) и окно (FormModal): заголовок и ✕, поля с шагом 16 px, подвал — главная кнопка ПЕРВОЙ, «Отмена» после неё (в панели outline, в окне secondary), слева; на телефоне кнопки одна под другой. Общая ошибка и плашка 409 — над кнопками; закрытие с несохранённым вводом спрашивает.'
	};
</script>

<script lang="ts">
	import {
		AreaField,
		Btn,
		Card,
		CheckField,
		DateField,
		FileField,
		FormDrawer,
		FormModal,
		FormRow,
		FormSection,
		MultiPick,
		NumberField,
		Pick,
		RadioField,
		RangeField,
		TextField,
		Toggle
	} from '$lib/ui';
	import DemoState from '../DemoState.svelte';
	import { CITY_ITEMS, STATUS_ITEMS } from '../mock';

	let name = $state('Летняя школа Data Science');
	let notes = $state('');
	let amount = $state<number | null>(210000);
	let when = $state<string | null>('2026-11-12');
	let city = $state<string | null>(null);
	let cities = $state<string[]>(['Казань']);
	let kind = $state<string | null>('b2b');
	let agree = $state(true);
	let flag = $state(false);
	let period = $state({ from: '2026-09-01', to: '2026-09-30' });

	// panels and windows
	let drawer = $state<null | 'plain' | 'errors' | 'saving'>(null);
	let modal = $state<null | 's' | 'm'>(null);
	let saving = $state(false);
	function fakeSave() {
		saving = true;
		setTimeout(() => {
			saving = false;
			drawer = null;
			modal = null;
		}, 1200);
	}
</script>

<DemoState title="Поля: обычное, с подсказкой, с ошибкой, недоступное" bare>
	<Card title="Состояния текстового поля">
		<div class="grid grid-cols-4 items-start gap-x-3 gap-y-4 max-lg:grid-cols-2 max-md:grid-cols-1">
			<TextField label="Название" bind:value={name} />
			<TextField label="Телефон" hint="Начните с +7" value="" placeholder="+7 (___) ___-__-__" />
			<TextField label="E-mail" value="ivanov@" error="Введите корректный email" />
			<TextField label="Регион" value="Татарстан" disabled />
		</div>
	</Card>
</DemoState>

<DemoState title="Поля: число, дата, выбор, поиск, несколько значений" bare>
	<Card title="Все виды полей в одной сетке — одна высота, одна строка подписи">
		<div class="grid grid-cols-3 items-start gap-x-3 gap-y-4 max-lg:grid-cols-2 max-md:grid-cols-1">
			<NumberField label="Сумма, ₽" bind:value={amount} />
			<DateField label="Плановая дата закрытия" bind:value={when} />
			<Pick label="Статус" items={STATUS_ITEMS} bind:value={city} placeholder="Не выбран" clearable />
			<Pick label="Город" items={CITY_ITEMS} value="Самара" search />
			<MultiPick label="Города" items={CITY_ITEMS} bind:value={cities} placeholder="Не выбраны" />
			<Pick label="Приоритет" items={STATUS_ITEMS} value={null} error="Выберите приоритет" />
		</div>
	</Card>
</DemoState>

<DemoState title="Многострочное поле, переключатели, флажок, радио" bare>
	<Card title="Остальное">
		<div class="flex max-w-xl flex-col gap-4">
			<AreaField label="Комментарий" rows={3} bind:value={notes} hint="Ctrl/⌘ + Enter — отправить" />
			<RadioField
				label="Тип сделки"
				columns={2}
				bind:value={kind}
				items={[
					{ key: 'b2b', label: 'Организация', hint: 'вуз, колледж, компания' },
					{ key: 'b2c', label: 'Физлицо', hint: 'студент, слушатель' }
				]}
			/>
			<CheckField label="Лицо, принимающее решения" bind:checked={agree} />
			<Toggle label="Требовать второй фактор (TOTP)" hint="Вход только с кодом из приложения" bind:checked={flag} />
		</div>
	</Card>
</DemoState>

<DemoState title="Обязательные поля: звёздочка после подписи у каждого вида" bare>
	<Card title="TextField, Pick, MultiPick, DateField, NumberField, AreaField, RadioField, CheckField, FileField">
		<div class="grid grid-cols-3 items-start gap-x-3 gap-y-4 max-lg:grid-cols-2 max-md:grid-cols-1">
			<TextField label="Название" required value="" />
			<Pick label="Статус" required items={STATUS_ITEMS} value={null} placeholder="Не выбран" />
			<MultiPick label="Города" required items={CITY_ITEMS} value={[]} placeholder="Не выбраны" />
			<DateField label="Плановая дата закрытия" required value={null} />
			<NumberField label="Сумма, ₽" required value={null} />
			<TextField label="Заполнено" required value="Есть значение" />
		</div>
		<div class="mt-4 flex max-w-xl flex-col gap-4">
			<AreaField label="Комментарий" required rows={2} value="" />
			<RadioField label="Тип сделки" required value={null} items={[{ key: 'b2b', label: 'Организация' }, { key: 'b2c', label: 'Физлицо' }]} />
			<CheckField label="Понимаю, что действие необратимо" required checked={false} />
			<FileField label="Перетащите файл сюда" required hint="Excel или CSV, до 50 МБ" onPick={() => {}} />
		</div>
	</Card>
</DemoState>

<DemoState title="Даты периодом и загрузка файла" bare>
	<Card title="RangeField, FileField">
		<div class="flex max-w-xl flex-col gap-4">
			<RangeField label="Период" from={period.from} to={period.to} onChange={(from, to) => (period = { from, to })} />
			<FileField label="Перетащите файл сюда" hint="Excel (.xlsx, .xls) или CSV, до 50 МБ" accept={{ 'text/csv': ['.csv'] }} onPick={() => {}} />
			<FileField label="Выберите PDF или перетащите его сюда" fileName="Договор.pdf" onPick={() => {}} />
		</div>
	</Card>
</DemoState>

<DemoState title="Группы в форме: ряд из двух полей и «Дополнительно»" bare>
	<Card title="FormRow, FormSection">
		<div class="flex max-w-xl flex-col gap-4">
			<TextField label="Название" value="Программа повышения квалификации" />
			<FormRow>
				<NumberField label="Сумма, ₽" value={150000} />
				<Pick label="Приоритет" items={STATUS_ITEMS} value="talks" />
			</FormRow>
			<FormSection collapsible>
				<FormRow>
					<DateField label="Плановая дата закрытия" value={null} />
					<NumberField integer label="Обучающихся" value={null} />
				</FormRow>
			</FormSection>
			<FormSection title="Контакты">
				<TextField label="Телефон" value="" />
			</FormSection>
		</div>
	</Card>
</DemoState>

<DemoState title="Панель формы (справа) и окно формы: нажмите, чтобы открыть" bare>
	<div class="flex flex-wrap gap-3">
		<Btn label="Панель: обычная" variant="outline" colorScheme="neutral" onclick={() => (drawer = 'plain')} />
		<Btn label="Панель: ошибка и конфликт 409" variant="outline" colorScheme="neutral" onclick={() => (drawer = 'errors')} />
		<Btn label="Панель: сохранение" variant="outline" colorScheme="neutral" onclick={() => ((drawer = 'saving'), fakeSave())} />
		<Btn label="Окно s" variant="outline" colorScheme="neutral" onclick={() => (modal = 's')} />
		<Btn label="Окно m" variant="outline" colorScheme="neutral" onclick={() => (modal = 'm')} />
	</div>
</DemoState>

<FormDrawer
	open={drawer !== null}
	title="Новая сделка"
	saveLabel="Создать сделку"
	saving={drawer === 'saving' && saving}
	dirty={drawer === 'plain' && !!notes}
	conflict={drawer === 'errors'}
	formError={drawer === 'errors' ? 'Для этого типа сделок нет опубликованной воронки.' : null}
	onSave={fakeSave}
	onReload={() => (drawer = 'plain')}
	onClose={() => (drawer = null)}
>
	<TextField label="Название" autofocus bind:value={name} error={drawer === 'errors' ? 'Введите название' : undefined} />
	<Pick label="Тип" items={STATUS_ITEMS} value="talks" />
	<FormRow>
		<NumberField label="Сумма, ₽" bind:value={amount} />
		<Pick label="Приоритет" items={STATUS_ITEMS} value="talks" />
	</FormRow>
	<AreaField label="Комментарий" bind:value={notes} />
	<FormSection collapsible>
		<DateField label="Плановая дата закрытия" bind:value={when} />
	</FormSection>
</FormDrawer>

<FormModal open={modal !== null} title="Сменить ответственного" size={modal ?? 's'} saveLabel="Передать" {saving} onSave={fakeSave} onClose={() => (modal = null)}>
	<Pick label="Новый ответственный" items={STATUS_ITEMS} value={null} />
	<AreaField label="Причина" rows={2} bind:value={notes} />
</FormModal>
