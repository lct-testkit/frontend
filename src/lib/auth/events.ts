// Tiny hub between the HTTP layer and the session store (avoids an import cycle api ⇄ session).

export type AuthEvent =
	| { type: 'unauthorized'; status: number }
	| { type: 'consent_required' }
	| { type: 'password_change_required' }
	| { type: 'blocked' };

type Listener = (event: AuthEvent) => void;
const listeners = new Set<Listener>();

export function onAuthEvent(listener: Listener): () => void {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

export function emitAuthEvent(event: AuthEvent): void {
	for (const listener of listeners) listener(event);
}
