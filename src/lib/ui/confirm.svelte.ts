// Promise-based confirmation: `if (await confirm({ title: 'Удалить сделку D-2026-00431?', danger: true })) …`
// Rendered by <ConfirmHost/> (root layout).
export interface ConfirmOptions {
	title: string;
	message?: string;
	confirmLabel?: string;
	cancelLabel?: string;
	/** red primary button for destructive actions */
	danger?: boolean;
}

interface Pending {
	options: ConfirmOptions;
	resolve: (value: boolean) => void;
}

let pending = $state<Pending | null>(null);

export const confirmState = {
	get current() {
		return pending;
	}
};

export function confirm(options: ConfirmOptions): Promise<boolean> {
	pending?.resolve(false);
	return new Promise<boolean>((resolve) => {
		pending = {
			options,
			resolve: (value) => {
				pending = null;
				resolve(value);
			}
		};
	});
}
