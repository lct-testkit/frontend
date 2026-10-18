// Global toast API. `ToastHost` (mounted once in the root layout) registers the rt-ui stack; calls made earlier are queued.
import { goto } from '$app/navigation';
import { ApiError, errorCode, errorHelpHref, errorMessage } from '$lib/api/errors';
import { announce } from './announcer.svelte';

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
	const { title, subtitle, colorScheme } = props as { title?: string; subtitle?: string; colorScheme?: string };
	if (title) announce(subtitle ? `${title}. ${subtitle}` : title, colorScheme === 'error' ? 'assertive' : 'polite');
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
	/** Any thrown value → one human sentence (ApiError codes are mapped); the code of the error catalog and a «what does it mean» button
	 * point to the help chapter, the request id is added for server faults. */
	error(e: unknown, title?: string) {
		const message = errorMessage(e);
		const code = errorCode(e);
		const rid = e instanceof ApiError && e.status >= 500 && e.requestId ? `Код обращения: ${e.requestId}` : undefined;
		const meta = [code ? `Код ошибки: ${code}` : '', rid ?? ''].filter(Boolean).join(' · ') || undefined;
		const actionButtons = code ? [{ label: 'Что это значит', action: () => void goto(errorHelpHref(code)) }] : undefined;
		push(
			title
				? { title, subtitle: [message, meta].filter(Boolean).join(' · '), colorScheme: 'error', timeout: 15000, actionButtons }
				: { title: message, subtitle: meta, colorScheme: 'error', timeout: 15000, actionButtons }
		);
	}
};
