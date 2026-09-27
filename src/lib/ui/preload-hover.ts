// SvelteKit preloads a page's data on hover for real `<a>` elements alone (`data-sveltekit-preload-data="hover"`
// on `<body>`, already set in app.html) — it walks up from the hovered element for the nearest anchor. Our
// navigation is mostly NOT anchors: the side menu is DS `SideMenuItem` buttons that call `goto()`, and every list
// row navigates through `DataTable`'s `onRowClick` the same way. Neither ever reaches SvelteKit's hover mechanism,
// so the built-in attribute is dead weight for most of the app. This gives the same effect by hand: call
// `preloadData` ourselves when the pointer enters an element that is *going* to navigate but isn't an anchor.
import { preloadData } from '$app/navigation';

// One-shot per href for the life of the tab: SvelteKit's own load cache already dedupes short-lived repeats, this
// only avoids re-issuing the call (and its network traffic) on every re-hover of an already-visited row.
const requested = new Set<string>();

/** Preloads `href` once, silently — a bad/unmatched/external href must never surface as an error. */
export function preloadHref(href: string | null | undefined): void {
	if (!href || !href.startsWith('/') || requested.has(href)) return;
	requested.add(href);
	preloadData(href).catch(() => {});
}

/**
 * `use:preloadHover={() => href}` on a button/div that navigates on click via `goto(href)`.
 * The getter (not a plain string) lets the href follow reactive state (e.g. a list row bound in an `{#each}`).
 */
export function preloadHover(node: HTMLElement, getHref: () => string | null | undefined) {
	let current = getHref;
	const onEnter = () => preloadHref(current());
	node.addEventListener('pointerenter', onEnter);
	return {
		update(next: () => string | null | undefined) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerenter', onEnter);
		}
	};
}
