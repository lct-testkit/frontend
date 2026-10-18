// Сводка журнала безопасности: сколько событий данного типа за окно.

export function countOf(summary: { by_type: { event_type: string; count: number }[] } | null | undefined, type: string): number {
	return (summary?.by_type ?? []).filter((t) => t.event_type === type).reduce((n, t) => n + t.count, 0);
}
