// Что написать под параметрами отчёта по ответу предпросмотра. Чистая функция: как показать — решает `ReportPreviewLine.svelte`.
import { count, formatNumber } from '$lib/utils/format';
import type { PreviewPhase } from './preview.svelte';

export type PreviewView = { kind: 'none' } | { kind: 'loading'; text: string; stale: false } | { kind: 'count' | 'empty'; text: string; stale: boolean };

const ROWS: [string, string, string] = ['строка', 'строки', 'строк'];

export function previewText(rows: number | null, exact: boolean, limit: number | null, phase: PreviewPhase): PreviewView {
	if (phase === 'idle' || phase === 'unavailable') return { kind: 'none' };
	if (rows === null) return phase === 'loading' ? { kind: 'loading', text: 'Считаем строки…', stale: false } : { kind: 'none' };
	// прошлое число остаётся на экране приглушённым, пока считается новое: строка не мигает и не прыгает по высоте
	const stale = phase === 'loading';
	if (rows === 0) return { kind: 'empty', text: 'По этим условиям строк нет — расширьте период или уберите фильтры', stale };
	const found = `Найдётся ${exact ? '' : '≈ '}${count(rows, ROWS)}`;
	return { kind: 'count', text: limit !== null && rows > limit ? `${found}, в отчёт войдут первые ${formatNumber(limit)}` : found, stale };
}
