<script lang="ts">
	// Полный список продуктов сделки: карточками — количество, цена, скидка, поток; добавление снизу.
	// PUT — полная замена (backend-issues A-7 закрыт этим экраном), поэтому «Сохранить» шлёт весь список,
	// а не только изменённые строки, и пустой список — осознанная очистка, а не отмена.
	import { untrack } from 'svelte';
	import { Trash } from '@lct-testkit/rt-ui/icons';
	import { ApiError, errorMessage } from '$lib/api';
	import { FormDrawer, IconBtn, toast } from '$lib/ui';
	import NumberField from '$lib/ui/fields/NumberField.svelte';
	import Pick from '$lib/ui/fields/Pick.svelte';
	import { products } from '../../shared/refs.svelte';
	import type { DealCardState } from './dealCard.svelte';

	interface Props {
		open: boolean;
		card: DealCardState;
		onClose: () => void;
	}

	let { open, card, onClose }: Props = $props();

	interface Row {
		product_id: string;
		quantity: number;
		price: number | null;
		discount_pct: number;
		stream_number: number | null;
	}

	const read = (): Row[] =>
		card.products.map((p) => ({
			product_id: p.product_id,
			quantity: p.quantity,
			price: p.price === null || p.price === undefined ? null : Number(p.price),
			discount_pct: Number(p.discount_pct || 0),
			stream_number: p.stream_number ?? null
		}));

	let base = read();
	let rows = $state<Row[]>(read());
	let adding = $state<string | null>(null);
	let banner = $state<string | null>(null);
	let conflict = $state(false);
	let busy = $state(false);

	$effect(() => {
		if (!open) return;
		untrack(() => {
			base = read();
			rows = read();
			banner = null;
			conflict = false;
		});
	});

	const productItems = $derived((products.value ?? []).map((p) => ({ key: p.id, value: p.name, hint: p.base_price ?? undefined })));
	const productName = (id: string) => products.value?.find((p) => p.id === id)?.name ?? '…';
	const isDirty = $derived(open && JSON.stringify(rows) !== JSON.stringify(base));

	const update = (i: number, patch: Partial<Row>) => (rows = rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
	const remove = (i: number) => (rows = rows.filter((_, k) => k !== i));

	function addRow(id: string | null) {
		if (!id) return;
		const product = products.value?.find((p) => p.id === id);
		rows = [...rows, { product_id: id, quantity: 1, price: product?.base_price ? Number(product.base_price) : null, discount_pct: 0, stream_number: null }];
		adding = null;
	}

	async function refresh() {
		if (busy) return;
		busy = true;
		await card.refresh();
		rows = read();
		base = read();
		conflict = false;
		banner = null;
		busy = false;
	}

	async function save() {
		if (busy) return;
		busy = true;
		banner = null;
		try {
			await card.replaceProducts(rows.map((r) => ({ product_id: r.product_id, quantity: r.quantity, price: r.price, discount_pct: r.discount_pct, stream_number: r.stream_number })));
			toast.success('Продукты сохранены');
			onClose();
		} catch (e) {
			if (e instanceof ApiError && e.isConflict) {
				conflict = true;
				banner = 'Сделка изменена другим пользователем. Обновите данные — введённое сохранится.';
			} else {
				banner = errorMessage(e);
			}
		} finally {
			busy = false;
		}
	}
</script>

<FormDrawer
	{open}
	title="Продукты сделки"
	saving={busy}
	saveTestId="deal-products-save"
	dirty={isDirty}
	{conflict}
	conflictText={banner ?? undefined}
	reloadLabel="Обновить"
	formError={conflict ? null : banner}
	onSave={save}
	onReload={refresh}
	{onClose}
>
	<div class="flex flex-col gap-2.5">
		{#each rows as row, i (i)}
			<div class="flex flex-col gap-2.5 rounded-md border border-line bg-surface p-2.5">
				<div class="flex items-center gap-2">
					<span class="t-body-s-strong min-w-0 flex-1 truncate">{productName(row.product_id)}</span>
					<IconBtn icon={Trash} label="Убрать продукт" danger size="s" onclick={() => remove(i)} />
				</div>
				<div class="grid grid-cols-4 gap-2 max-md:grid-cols-2">
					<NumberField label="Количество" integer min={1} value={row.quantity} onChange={(v) => update(i, { quantity: v ?? 1 })} />
					<NumberField label="Цена, ₽" value={row.price} onChange={(v) => update(i, { price: v })} />
					<NumberField label="Скидка, %" min={0} max={100} value={row.discount_pct} onChange={(v) => update(i, { discount_pct: v ?? 0 })} />
					<NumberField label="Поток" integer value={row.stream_number} onChange={(v) => update(i, { stream_number: v })} />
				</div>
			</div>
		{/each}
		{#if !rows.length}<p class="t-body-m m-0 text-muted">Продукты не добавлены</p>{/if}
	</div>

	<Pick label="Добавить продукт" search bind:value={adding} items={productItems} emptyText="Продуктов пока нет" onChange={addRow} />
</FormDrawer>
