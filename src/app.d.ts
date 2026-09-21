// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageState {
			/** Something a page wants restored on «Back» (open drawer id, etc.). */
			drawer?: string;
		}
	}
}

export {};
