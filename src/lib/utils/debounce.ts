/** Trailing debounce with `cancel()` / `flush()`. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, wait = 300) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let lastArgs: A | undefined;
	const debounced = (...args: A) => {
		lastArgs = args;
		clearTimeout(timer);
		timer = setTimeout(() => {
			timer = undefined;
			fn(...args);
		}, wait);
	};
	debounced.cancel = () => {
		clearTimeout(timer);
		timer = undefined;
	};
	debounced.flush = () => {
		if (timer !== undefined && lastArgs) {
			clearTimeout(timer);
			timer = undefined;
			fn(...lastArgs);
		}
	};
	return debounced;
}
