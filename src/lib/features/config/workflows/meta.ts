// Подписи и тона чипов воронок (список и шапка редактора).
import { DEAL_TYPE_LABELS, WORKFLOW_STATE_LABELS, type DealType, type WorkflowState } from './graph';

export const STATE_TONE: Record<WorkflowState, 'warning' | 'success' | 'neutral'> = { draft: 'warning', published: 'success', archived: 'neutral' };
export const stateLabel = (state: string): string => WORKFLOW_STATE_LABELS[state as WorkflowState] ?? state;
export const stateTone = (state: string) => STATE_TONE[state as WorkflowState] ?? 'neutral';
/** «B2B» / «B2C» — короткая подпись типа сделки для чипов. */
export const dealTypeShort = (type: string): string => type.toUpperCase();
export const dealTypeLong = (type: string): string => DEAL_TYPE_LABELS[type as DealType] ?? type;

/** Были ли правки после публикации: `updated_at` заметно позже `published_at` (публикация сама трогает обе даты в одном запросе). */
export function hasUnpublishedChanges(w: { state: string; published_at?: string | null; updated_at: string }): boolean {
	if (w.state === 'archived') return false;
	if (w.state !== 'published' || !w.published_at) return true;
	return Date.parse(w.updated_at) - Date.parse(w.published_at) > 2000;
}
