// Общий кэш направлений на время сессии: нужен списку продуктов (фильтр, колонка), форме продукта и странице направлений.
import { createResource } from '../shared/resource.svelte';
import { fetchAllDirections } from './directions';

export const directions = createResource(fetchAllDirections);

let started = false;
/** Загружает при первом обращении; повторные вызовы не ходят в сеть (после ошибки — `directions.reload()`). */
export function ensureDirections(): void {
	if (started) return;
	started = true;
	void directions.reload();
}
