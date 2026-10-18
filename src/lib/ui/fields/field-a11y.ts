// Связывает ошибку поля с самим полем: DS Input рисует подсказку и ошибку, но не ставит aria-invalid и aria-describedby.
let counter = 0;

export function fieldA11y(node: HTMLElement, error: string | undefined) {
	const id = `field-hint-${++counter}`;
	let current = error;
	function apply() {
		const input = node.querySelector<HTMLElement>('input, textarea');
		const hint = node.querySelector<HTMLElement>('.atmr-input__hint');
		const clear = node.querySelector('[data-testid="input__suffix__clear"]');
		if (clear && clear.getAttribute('aria-label') !== 'Очистить') clear.setAttribute('aria-label', 'Очистить');
		if (!input) return;
		if (current) input.setAttribute('aria-invalid', 'true');
		else input.removeAttribute('aria-invalid');
		if (hint) {
			hint.id = id;
			// озвучиваем только ошибку: постоянная подсказка («Например …») при каждом показе читалась бы заново
			if (current) hint.setAttribute('aria-live', 'polite');
			else hint.removeAttribute('aria-live');
			input.setAttribute('aria-describedby', id);
		} else input.removeAttribute('aria-describedby');
	}
	const observer = new MutationObserver(apply); // DS добавляет и убирает блок подсказки сам
	observer.observe(node, { childList: true, subtree: true });
	apply();
	return {
		update(next: string | undefined) {
			current = next;
			queueMicrotask(apply);
		},
		destroy: () => observer.disconnect()
	};
}
