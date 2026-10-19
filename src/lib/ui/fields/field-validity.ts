// Fields whose text is not a value (a date typed as «31.02.2026», «01.01.26») tell the form about it, and the form does not save what the user cannot see is wrong:
// the field has no value (null), but its text is on the screen — saving would silently lose it.
//   container (FormDrawer / FormModal):  const validity = provideFieldValidity();  …  if (validity.blocked()) return;
//   field (DateField):                   const report = useFieldValidity();         …  report('Такой даты нет') / report(null)
import { getContext, setContext } from 'svelte';

export interface FieldValidity {
	/** the field `id` reports its message; `null` — the text is fine (or empty) */
	report(id: symbol, message: string | null): void;
	/** at least one field of the form holds text that is not a value */
	blocked(): boolean;
	/** moves focus out of the field being typed in, so the field shows its message (the DS shows it when the field loses focus) */
	reveal(form: HTMLElement | null): void;
}

const KEY = Symbol('field-validity');

export function createFieldValidity(): FieldValidity {
	const messages = new Map<symbol, string>();
	return {
		report(id, message) {
			if (message) messages.set(id, message);
			else messages.delete(id);
		},
		blocked: () => messages.size > 0,
		reveal(form) {
			const active = document.activeElement;
			if (form && active instanceof HTMLElement && form.contains(active)) active.blur();
		}
	};
}

/** In a container of a form: fields below report into it. */
export function provideFieldValidity(validity: FieldValidity): FieldValidity {
	return setContext(KEY, validity);
}

/** In a field: a reporter bound to this field (does nothing outside of a form container). */
export function useFieldValidity(): (message: string | null) => void {
	const validity = getContext<FieldValidity | undefined>(KEY);
	const id = Symbol('field');
	return (message) => validity?.report(id, message);
}
