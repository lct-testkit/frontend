// Closing a form that has unsaved input asks first: a click beside the panel, Esc or a slip of the finger must not throw a filled form away.
import { confirm } from './confirm.svelte';

/** true = the form may close (nothing to lose, or the person confirmed) */
export async function mayClose(dirty: boolean): Promise<boolean> {
	if (!dirty) return true;
	return confirm({ title: 'Закрыть без сохранения?', message: 'Введённое будет потеряно.', confirmLabel: 'Закрыть', cancelLabel: 'Продолжить' });
}
