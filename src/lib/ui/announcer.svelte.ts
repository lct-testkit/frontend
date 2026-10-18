// Объявления для экранного читателя (WCAG 4.1.3): тосты и статусы озвучиваются через две невидимые живые области в AnnouncerHost.
// Одинаковый текст подряд: значение сначала сбрасывается и записывается в следующей микрозадаче, иначе читатель не заметит изменения.
export const announcements = $state({ polite: '', assertive: '' });

const timers: Record<'polite' | 'assertive', ReturnType<typeof setTimeout> | undefined> = { polite: undefined, assertive: undefined };
const CLEAR_AFTER_MS = 5000;

export function announce(text: string, level: 'polite' | 'assertive' = 'polite'): void {
	if (!text) return;
	clearTimeout(timers[level]);
	announcements[level] = '';
	queueMicrotask(() => {
		announcements[level] = text;
		timers[level] = setTimeout(() => (announcements[level] = ''), CLEAR_AFTER_MS);
	});
}
