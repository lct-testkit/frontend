// A mistake shown under a field belongs to the value that was there when it appeared («Заполните поле», a 422 «amount: …» from the server): once the person edits the
// field, the message is stale and goes away — it comes back only with a new answer (a new text, or a new attempt to save: the container counts them).
//   field:      const fresh = useFreshError(() => error, () => value);   …   error={fresh.error}
//   container:  const submits = provideSubmitCounter();                   …   submits.bump() on every submit
import { getContext, setContext, untrack } from 'svelte';

const KEY = Symbol('submit-counter');

export interface SubmitCounter {
	bump(): void;
	readonly count: number;
}

/** In FormDrawer / FormModal: the fields below learn that the form was sent again. */
export function provideSubmitCounter(): SubmitCounter {
	let count = $state(0);
	return setContext(KEY, {
		bump() {
			count += 1;
		},
		get count() {
			return count;
		}
	} satisfies SubmitCounter);
}

export interface ErrorSnap {
	error: string;
	submit: number;
	value: unknown;
}

const same = (a: unknown, b: unknown) => Object.is(a, b) || JSON.stringify(a) === JSON.stringify(b);

/** The value a message came for: taken when the message appears, or changes, or the form is sent again; no message — no snapshot. */
export function nextSnap(snap: ErrorSnap | null, error: string | undefined, submit: number, value: unknown): ErrorSnap | null {
	if (!error) return null;
	return snap && snap.error === error && snap.submit === submit ? snap : { error, submit, value };
}

/** The message, unless the value moved on since it appeared (a snapshot not taken yet — the message is shown). */
export function visibleError(snap: ErrorSnap | null, error: string | undefined, value: unknown): string | undefined {
	if (!error) return undefined;
	return snap && snap.error === error && !same(snap.value, value) ? undefined : error;
}

export function useFreshError(error: () => string | undefined, value: () => unknown): { readonly error: string | undefined } {
	const submits = getContext<SubmitCounter | undefined>(KEY);
	let snap = $state.raw<ErrorSnap | null>(null);

	$effect.pre(() => {
		const e = error();
		const submit = submits?.count ?? 0;
		const v = $state.snapshot(value());
		untrack(() => (snap = nextSnap(snap, e, submit, v)));
	});

	return {
		get error() {
			return visibleError(snap, error(), $state.snapshot(value()));
		}
	};
}
