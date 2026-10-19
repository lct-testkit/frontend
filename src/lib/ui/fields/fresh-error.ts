// What a field shows of a mistake once it was edited: see fresh-error.svelte.ts.
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

