// A mistake shown under a field belongs to the value that was there when it appeared («Заполните поле», a 422 «amount: …» from the server): once the person edits the
// field, the message is stale and goes away — it comes back only with a new answer (a new text, or a new attempt to save: the container counts them).
//   field:      const fresh = useFreshError(() => error, () => value);   …   error={fresh.error}
//   container:  const submits = provideSubmitCounter();                   …   submits.bump() on every submit
import { getContext, setContext, untrack } from 'svelte';
import { nextSnap, visibleError, type ErrorSnap } from './fresh-error';

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
