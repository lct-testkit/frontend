<script lang="ts">
	// Текстовое поле с подсказками из справочника: можно ввести своё значение (сервер сам ищет совпадение) или нажать на подсказку (тогда уходит и ссылка на запись).
	import { Btn, TextField } from '$lib/ui';

	export interface Suggestion {
		id: string;
		name: string;
	}

	interface Props {
		label: string;
		value: string;
		/** выбранная запись справочника: сбрасывается, как только текст перестаёт совпадать с её названием */
		pickedId: string | null;
		items: readonly Suggestion[];
		required?: boolean;
		error?: string;
		hint?: string;
		maxlength?: number;
		disabled?: boolean;
		onChange: (text: string, id: string | null) => void;
	}

	let { label, value, pickedId, items, required = false, error, hint, maxlength, disabled = false, onChange }: Props = $props();

	const needle = $derived(value.trim().toLocaleLowerCase('ru'));
	// подсказки: совпадающие с введённым (все — пока поле пусто); выбранную и точное совпадение не повторяем
	const shown = $derived(items.filter((i) => i.id !== pickedId && i.name.toLocaleLowerCase('ru') !== needle && (!needle || i.name.toLocaleLowerCase('ru').includes(needle))).slice(0, 6));
</script>

<div class="flex min-w-0 flex-col gap-2">
	<TextField {label} {value} {required} {error} {hint} {maxlength} {disabled} onInput={(v) => onChange(v, items.find((i) => i.name === v.trim())?.id ?? null)} />
	{#if shown.length && !disabled}
		<div class="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Подсказки: {label}">
			{#each shown as item (item.id)}
				<Btn label={item.name} size="s" variant="outline" colorScheme="neutral" onclick={() => onChange(item.name, item.id)} />
			{/each}
		</div>
	{/if}
</div>
