// Связывает ошибку поля с самим полем: DS Input рисует подсказку и ошибку, но не ставит aria-invalid и aria-describedby, а кнопку очистки называет «Clear».
// Один наблюдатель на всё приложение (вместо обёртки у каждого поля: обёртка ломала раскладку рядов фильтров, где правила идут по прямым потомкам).
const ids = new WeakMap<Element, string>();
let counter = 0;

function decorate(field: Element) {
	const input = field.querySelector<HTMLElement>('input, textarea');
	if (!input) return;
	const hint = field.querySelector<HTMLElement>('.atmr-input__hint');
	const error = field.classList.contains('atmr-input--error');
	const clear = field.querySelector('[data-testid="input__suffix__clear"]');
	if (clear && clear.getAttribute('aria-label') !== 'Очистить') clear.setAttribute('aria-label', 'Очистить');
	// the DS names the button at the end of the box «Input-right-icon»: for the eye of a password field say what it does
	const suffix = field.querySelector('button.atmr-input__suffix');
	if (suffix && input instanceof HTMLInputElement && /password/i.test(input.name)) {
		const label = input.type === 'password' ? 'Показать пароль' : 'Скрыть пароль';
		if (suffix.getAttribute('aria-label') !== label) suffix.setAttribute('aria-label', label);
	}
	if (error) {
		if (input.getAttribute('aria-invalid') !== 'true') input.setAttribute('aria-invalid', 'true');
	} else if (input.hasAttribute('aria-invalid')) input.removeAttribute('aria-invalid');
	if (hint) {
		let id = ids.get(hint);
		if (!id) ids.set(hint, (id = `field-hint-${++counter}`));
		if (hint.id !== id) hint.id = id;
		// озвучиваем только ошибку: постоянная подсказка («Например …») при каждом показе читалась бы заново
		if (error) {
			if (hint.getAttribute('aria-live') !== 'polite') hint.setAttribute('aria-live', 'polite');
		} else if (hint.hasAttribute('aria-live')) hint.removeAttribute('aria-live');
		if (input.getAttribute('aria-describedby') !== id) input.setAttribute('aria-describedby', id);
	} else if (input.hasAttribute('aria-describedby') && input.getAttribute('aria-describedby')?.startsWith('field-hint-')) input.removeAttribute('aria-describedby');
}

export function installFieldA11y(root: HTMLElement = document.body): () => void {
	let queued = false;
	const run = () => {
		queued = false;
		for (const field of root.querySelectorAll('.atmr-input')) decorate(field);
	};
	const observer = new MutationObserver(() => {
		if (queued) return;
		queued = true;
		requestAnimationFrame(run);
	});
	observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
	run();
	return () => observer.disconnect();
}
