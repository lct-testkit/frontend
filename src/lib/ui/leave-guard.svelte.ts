// A page (wizard, editor) with unsaved input: leaving through a link of the app asks first, closing the tab gets the browser's own warning.
// Call it while the component initialises (beforeNavigate and $effect need that).
import { beforeNavigate, goto } from '$app/navigation';
import { confirm } from './confirm.svelte';
import { mayClose } from './form-close';

export function useLeaveGuard(dirty: () => boolean, message: string, title = 'Выйти без сохранения?') {
	let leaving = false;
	beforeNavigate((nav) => {
		if (leaving || !dirty() || nav.willUnload || !nav.to) return;
		// the same page with another query (the wizard writes `?job=` into its own address) is not leaving it
		if (nav.from && nav.to.url.pathname === nav.from.url.pathname) return;
		nav.cancel();
		const to = nav.to.url;
		void confirm({ title, message, confirmLabel: 'Выйти', danger: true }).then((yes) => {
			if (!yes) return;
			leaving = true;
			void goto(to);
		});
	});
	$effect(() => {
		const warn = (e: BeforeUnloadEvent) => {
			if (dirty()) e.preventDefault();
		};
		window.addEventListener('beforeunload', warn);
		return () => window.removeEventListener('beforeunload', warn);
	});
}

let askingBack = false;

/**
 * A dialog with unsaved input, opened through the address (`?new=1`): the Back button must ask like Esc and ✕ do («Закрыть без сохранения?»), not throw the
 * filled form away. Back would leave the address without `?new=1`, the dialog would close by itself and the input would be gone.
 * Call it while the dialog component initialises; `active` = the dialog is open AND has unsaved input. «Продолжить» (or a dialog that is not dirty) leaves
 * the history as it is; «Закрыть» repeats the same step back.
 */
export function useBackGuard(active: () => boolean) {
	let passing = false;
	beforeNavigate((nav) => {
		if (passing || askingBack || nav.type !== 'popstate' || nav.willUnload || !active()) return;
		nav.cancel();
		const delta = nav.delta;
		const to = nav.to?.url;
		askingBack = true;
		void mayClose(true).then((yes) => {
			askingBack = false;
			if (!yes) return;
			passing = true;
			// the same step the person took (several Back clicks = the same distance); the guard lets it through once
			if (delta) history.go(delta);
			else if (to) void goto(to);
			setTimeout(() => (passing = false), 600);
		});
	});
}
