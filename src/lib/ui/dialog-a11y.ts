// Окно как диалог: роль, фокус при открытии, ловушка Tab, возврат фокуса. Дизайн-система (rt-ui Modal, Drawer) этого не делает.
const stack: HTMLElement[] = [];
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const OUTSIDE_OK = '.atmr-dropdown-menu, .atmr-popover, .atmr-tooltip'; // списки и подсказки DS открываются в body, вне окна

export function dialogA11y(node: HTMLElement, options: { label?: string } = {}) {
	const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	node.setAttribute('role', 'dialog');
	node.setAttribute('aria-modal', 'true');
	node.setAttribute('aria-label', options.label || 'Окно');
	if (!node.hasAttribute('tabindex')) node.tabIndex = -1;
	stack.push(node);

	const items = () => [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
	queueMicrotask(() => {
		if (node.contains(document.activeElement)) return;
		(node.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? items()[0] ?? node).focus();
	});

	function onKeydown(event: KeyboardEvent) {
		if (event.key !== 'Tab' || stack[stack.length - 1] !== node) return;
		const active = document.activeElement;
		if (active instanceof Element && active.closest(OUTSIDE_OK)) return;
		const list = items();
		const go = (to: HTMLElement) => {
			event.preventDefault();
			to.focus();
		};
		if (!list.length) return go(node);
		const first = list[0];
		const last = list[list.length - 1];
		if (!node.contains(active)) go(first);
		else if (event.shiftKey && (active === first || active === node)) go(last);
		else if (!event.shiftKey && active === last) go(first);
	}
	document.addEventListener('keydown', onKeydown, true);

	return {
		destroy() {
			document.removeEventListener('keydown', onKeydown, true);
			stack.splice(stack.indexOf(node), 1);
			// назад на кнопку, открывшую окно, — если человек уже не ушёл дальше (фокус потерян, а не стоит на странице)
			const lost = !document.activeElement || document.activeElement === document.body || node.contains(document.activeElement);
			if (lost && opener?.isConnected) opener.focus({ preventScroll: true });
		}
	};
}
