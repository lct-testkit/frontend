// A page (wizard, editor) with unsaved input: leaving through a link of the app asks first, closing the tab gets the browser's own warning.
// Call it while the component initialises (beforeNavigate and $effect need that).
import { beforeNavigate, goto } from '$app/navigation';
import { confirm } from './confirm.svelte';

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
