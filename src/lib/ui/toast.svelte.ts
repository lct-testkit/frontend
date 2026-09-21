// Global toast API. `ToastHost` (mounted once in the root layout) registers the rt-ui stack; calls made earlier are queued.
import { ApiError, errorMessage } from '$lib/api/errors';

type Props = Record<string, unknown>;
type Adder = (props: Props) => void;

let adder: Adder | null = null;
const queue: Props[] = [];

export function registerToastAdder(fn: Adder | null): void {
	adder = fn;
	if (fn) while (queue.length) fn(queue.shift()!);
}

function push(props: Props): void {
	const full = { closeButton: true, ...props };
	if (adder) adder(full);
	else queue.push(full);
}

export const toast = {
	/** Short confirmation of a finished action: `toast.success('Сделка создана')`. */
	success(title: string, subtitle?: string) {
		push({ title, subtitle, colorScheme: 'success', timeout: 3500 });
	},
	info(title: string, subtitle?: string) {
		push({ title, subtitle, colorScheme: 'info', timeout: 5000 });
	},
	warning(title: string, subtitle?: string) {
		push({ title, subtitle, colorScheme: 'warning', timeout: 7000 });
	},
	/** Any thrown value → one human sentence (ApiError codes are mapped); request id is added for server faults. */
	error(e: unknown, title?: string) {
		const message = errorMessage(e);
		const rid = e instanceof ApiError && e.status >= 500 && e.requestId ? `Код обращения: ${e.requestId}` : undefined;
		push(title ? { title, subtitle: message, colorScheme: 'error', timeout: 9000 } : { title: message, subtitle: rid, colorScheme: 'error', timeout: 9000 });
	}
};
