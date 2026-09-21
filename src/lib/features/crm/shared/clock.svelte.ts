// «Сейчас» для индикаторов SLA и относительного времени: реактивно, обновляется раз в 30 с, пока на него кто-то смотрит.
import { createSubscriber } from 'svelte/reactivity';

const subscribe = createSubscriber((update) => {
	const timer = setInterval(update, 30_000);
	return () => clearInterval(timer);
});

export function nowMs(): number {
	subscribe();
	return Date.now();
}
