// Automatic «has unsaved input» for a form that does not compute it itself (FormDrawer / FormModal without the `dirty` prop).
// The form is sampled (the values of its inputs); a change that follows a real user action (key, click, input) is the person's input, a change
// that comes by itself (the form fills up with loaded data, a default arrives) becomes the new starting point. The form is dirty while its
// values differ from the starting point — so typing and then erasing it again is clean, and opening an edit form and closing it is clean.

/** a change of the values this soon after a user action is the person's own */
export const TRUST_MS = 700;

export interface DirtyTracker {
	/** a real user action happened (keydown, pointerdown, input, change) */
	userAction(now: number): void;
	/** the current signature of the form */
	sample(signature: string, now: number): void;
	readonly dirty: boolean;
}

/** right after the form opens its values settle by themselves (defaults, loaded data): until the person acts, they are the starting point */
export const SETTLE_MS = 1200;

export function createDirtyTracker(start = 0): DirtyTracker {
	let baseline: string | null = null;
	let current = '';
	let last: string | null = null;
	let lastUser = Number.NEGATIVE_INFINITY;
	return {
		userAction(now) {
			lastUser = now;
		},
		sample(signature, now) {
			current = signature;
			if (baseline === null) baseline = signature;
			else if (signature !== last && now - lastUser > TRUST_MS) baseline = signature;
			else if (signature !== last && now - start < SETTLE_MS && lastUser < start) baseline = signature;
			last = signature;
		},
		get dirty() {
			return baseline !== null && current !== baseline;
		}
	};
}

/** the values of everything the person can fill in inside `root` */
export function formSignature(root: ParentNode): string {
	const parts: string[] = [];
	root.querySelectorAll('input, textarea, select').forEach((el) => {
		const input = el as HTMLInputElement;
		if (input.type === 'checkbox' || input.type === 'radio') parts.push(input.checked ? '1' : '0');
		else if (input.type === 'file') parts.push(Array.from(input.files ?? [], (f) => f.name).join(','));
		else parts.push(input.value);
	});
	// custom pickers show the chosen value as text on a button
	root.querySelectorAll('[role="combobox"], [aria-haspopup="listbox"]').forEach((el) => parts.push(el.textContent ?? ''));
	return parts.join('\u0001');
}

export interface WatchParams {
	/** the form is on screen; a new opening starts a new comparison */
	open: boolean;
	onChange: (dirty: boolean) => void;
}

/** Svelte action for the <form> of FormDrawer / FormModal: reports `dirty` (see createDirtyTracker) */
export function watchDirty(form: HTMLElement, params: WatchParams) {
	let p = params;
	let tracker = createDirtyTracker(performance.now());
	let reported = false;
	const report = () => {
		if (tracker.dirty !== reported) {
			reported = tracker.dirty;
			p.onChange(reported);
		}
	};
	const sample = () => {
		tracker.sample(formSignature(form), performance.now());
		report();
	};
	const user = () => tracker.userAction(performance.now());
	const typed = () => {
		user();
		sample();
	};
	const events: [string, () => void][] = [
		['keydown', user],
		['pointerdown', user],
		['input', typed],
		['change', typed]
	];
	for (const [name, fn] of events) document.addEventListener(name, fn, true);
	const timer = setInterval(sample, 150);
	return {
		update(next: WatchParams) {
			const reopened = next.open !== p.open;
			p = next;
			if (reopened) {
				tracker = createDirtyTracker(performance.now());
				reported = false;
				p.onChange(false);
			}
		},
		destroy() {
			for (const [name, fn] of events) document.removeEventListener(name, fn, true);
			clearInterval(timer);
		}
	};
}
