<script lang="ts">
	// Выбор НЕСКОЛЬКИХ значений из большого списка с серверным поиском и кнопкой «Показать ещё» (вузы, направления, продукты, сотрудники).
	// Запросов при показе формы нет: первый уходит при открытии списка. Выбранные теги подписаны из словаря `known`, поэтому не пропадают
	// после нового поиска; ключи без подписи (сохранённый виджет) разрешаются одним пакетом через `resolve`.
	import { untrack } from 'svelte';
	import { Multiselect } from '@lct-testkit/rt-ui';
	import Term from '$lib/ui/Term.svelte';
	import { useBreakpoint } from '@lct-testkit/rt-ui/ext';
	import { RemoteList, type RemoteItem, type RemoteSearch } from './remote-list.svelte';

	interface Props {
		value?: string[];
		search: RemoteSearch;
		/** подписи для ключей, которых ещё не видели (после загрузки формы с готовым значением) */
		resolve?: (ids: string[]) => Promise<RemoteItem[]>;
		label?: string;
		/** пояснение к подписи: всплывает по наведению (глоссарий), а не стоит под полем */
		labelHint?: string;
		placeholder?: string;
		hint?: string;
		error?: string;
		disabled?: boolean;
		required?: boolean;
		emptyText?: string;
		/** приписка в подвале списка («Показаны первые 100: уточните запрос») */
		note?: string;
		/** приписка видна, когда в списке не меньше стольких строк (у списка без «Показать ещё») */
		noteAt?: number;
		class?: string;
		/** словарь всех элементов, что приходили с сервера (для проверок снаружи: например, направление выбранного продукта) */
		onKnown?: (known: ReadonlyMap<string, RemoteItem>) => void;
		onChange?: (value: string[], items: RemoteItem[]) => void;
	}

	let { value = $bindable([]), search, resolve, label, labelHint, placeholder, hint, error, disabled = false, required = false, emptyText = 'Ничего не найдено', note, noteAt, class: className = '', onKnown, onChange }: Props = $props();

	const bp = useBreakpoint();
	// svelte-ignore state_referenced_locally
	const list = new RemoteList(search);
	$effect(() => untrack(() => onKnown?.(list.known)));

	// ключи без подписи: до ответа `resolve` тег называется коротким id
	const asked = new Set<string>();
	$effect(() => {
		const missing = value.filter((k) => !list.known.has(k) && !asked.has(k));
		if (!missing.length || !resolve) return;
		for (const k of missing) asked.add(k);
		untrack(() => {
			resolve(missing)
				.then((found) => list.remember(found))
				.catch(() => {
					for (const k of missing) asked.delete(k);
				});
		});
	});
	$effect(() => () => list.dispose());

	/** сервер уже отфильтровал выдачу по тексту: клиентский фильтр rt-ui ничего не вырезает */
	function keepAll<T>(_text: unknown, options: T[]): T[] {
		return options;
	}
	const short = (k: string) => `#${k.slice(-4)}`;
	const selected = $derived(value.map((k) => ({ key: k, value: list.known.get(k)?.value ?? short(k) })));
	// rt-ui рисует теги только для значений, которые есть среди `items`: выбранные, которых нет в текущей выдаче, дописываются в конец
	const menu = $derived.by(() => {
		const found = list.items.map((i) => ({ key: i.key, value: i.value, hint: i.hint }));
		const seen = new Set(found.map((i) => i.key));
		return [...found, ...selected.filter((i) => !seen.has(i.key))];
	});
	const showNote = $derived(Boolean(note) && (noteAt === undefined || list.items.length >= noteAt));
	const empty = $derived(list.loading ? 'Поиск…' : list.error ? 'Не удалось загрузить' : emptyText);
</script>

<!-- the DS label ignores the pointer, so a label with an explanation is drawn here: same place and size, with the Tip on the word -->
<div class={['flex min-w-0 flex-col gap-1', className]}>
{#if labelHint}
	<!-- the closed Tip keeps a 200 px popper box in the layout: without the clip it widens the page on a phone -->
	<div class="relative overflow-x-clip"><span class="t-desc-l px-0.5 text-muted"><Term label={label ?? ''} hint={labelHint} placement="top" /></span></div>
{/if}
<Multiselect
	class="w-full"
	size={bp.isMobile ? 'l' : 'm'}
	{label}
	showLabel={!labelHint}
	placeholder={value.length ? undefined : placeholder}
	error={error}
	hintPrefix={error ? undefined : hint}
	{disabled}
	{required}
	emptyText={empty}
	autoHeight
	placement="bottom"
	items={menu}
	value={selected}
	autocomplete={{ enabled: true, filterOptions: keepAll, onChange: (text: string) => list.setQuery(text), clearSearchOnSelect: true }}
	onOpen={() => list.ensureLoaded()}
	onChange={(options: { key: string | number }[]) => {
		value = options.map((o) => String(o.key));
		onChange?.(value, options.map((o) => list.known.get(String(o.key)) ?? { key: String(o.key), value: short(String(o.key)) }));
	}}
>
	{#snippet footerSlot()}
		{#if list.hasMore || list.loadingMore || list.error || showNote}
			<div class="flex flex-col gap-1 border-t border-line px-3 py-2">
				{#if list.error}
					{#if list.items.length}<span class="t-desc-l text-danger">Не удалось загрузить</span>{/if}
					<button type="button" class="t-body-s-strong self-start rounded-md py-1 text-accent hover:text-accent-hover" onclick={() => void list.retry()}>Повторить</button>
				{:else if list.loadingMore}
					<span class="t-desc-l text-muted">Загрузка…</span>
				{:else if list.hasMore}
					<button type="button" class="t-body-s-strong self-start rounded-md py-1 text-accent hover:text-accent-hover" onclick={() => void list.loadMore()}>Показать ещё</button>
				{/if}
				{#if showNote}<span class="t-desc-l text-muted">{note}</span>{/if}
			</div>
		{/if}
	{/snippet}
</Multiselect>
</div>
