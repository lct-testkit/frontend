// Esc closes what is on top: an open list (a select, the calendar of a date field, a suggestion list) before the form or the window under it.
// The DS lists close themselves on Esc, but the Esc also reaches the drawer / modal below and the whole form closed («Закрыть без сохранения?»).
// The DS lists do not react to Esc at all (the calendar and the list of a select close on a click outside) — so a listener on `window` in the capture phase
// (the first one to see the key) notes whether a popup was open at that moment, closes it with the same outside click, and the drawer / modal under it ask
// whether this Esc was already spent on a popup.
let hitPopupAt = Number.NEGATIVE_INFINITY;

/** Is a DS popup (a list of a select, the calendar, a popover) on screen right now. */
function popupOpen(): boolean {
	for (const el of document.querySelectorAll('.atmr-popover, [role="listbox"]')) {
		const box = el.getBoundingClientRect();
		if (box.width > 0 && box.height > 0 && getComputedStyle(el).visibility !== 'hidden') return true;
	}
	return false;
}

/** What a person does to close a list: a click beside it (the DS listens to it on the document). */
function clickOutside() {
	for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: 1, clientY: 1 }));
}

if (typeof window !== 'undefined') {
	window.addEventListener(
		'keydown',
		(e) => {
			if (e.key !== 'Escape' || !popupOpen()) return;
			hitPopupAt = performance.now();
			queueMicrotask(clickOutside);
		},
		true
	);
}

/** The Esc being handled right now only closed a popup: the form under it stays. */
export const escapeClosedPopup = (): boolean => performance.now() - hitPopupAt < 100;
