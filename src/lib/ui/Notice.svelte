<script lang="ts">
	// A message inside a page or dialog (hint, warning, error, success): the design system's InlineNotification with our props.
	// Body goes in as children; `title` is the bold first line; `actions` are the buttons under the text (link-like, one or two).
	import type { Snippet } from 'svelte';
	import { InlineNotification } from '@lct-testkit/rt-ui';

	interface Action {
		label: string;
		onclick: () => void;
		/** the design system's FunctionButton variants; default `secondary` (dark text, no outline) */
		variant?: 'primary' | 'secondary' | 'tertiary';
		disabled?: boolean;
		[key: string]: unknown;
	}

	interface Props {
		tone?: 'info' | 'warning' | 'error' | 'success';
		title?: string;
		children?: Snippet;
		actions?: Action[];
		/** shows the close cross; called after the notice is dismissed */
		onClose?: () => void;
		/** `alert` for something that went wrong, `status` (default) for information */
		role?: 'alert' | 'status';
		class?: string;
		[key: string]: unknown;
	}

	let { tone = 'info', title, children, actions = [], onClose, role = tone === 'error' ? 'alert' : 'status', class: className = '', ...rest }: Props = $props();
</script>

<InlineNotification
	colorScheme={tone}
	{title}
	subtitle={children}
	actionButtons={actions.map(({ onclick, ...button }) => ({ ...button, action: () => onclick() }))}
	closeButton={onClose !== undefined}
	{onClose}
	{role}
	class={`shrink-0 ${className}`}
	{...rest}
/>
