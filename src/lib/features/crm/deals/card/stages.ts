// Контроль исполнения этапов сделки (шаг 14 задания): подписи состояний, времени, срока и вложений для перехода вперёд.
import { formatHours } from '$lib/features/config/workflows/editor/format';
import { formatDurationShort } from '../../shared/duration';
import { ATTACHMENT_CATEGORY_LABELS } from '../../shared/labels';
import type { DealStages, StageItem } from '../../types';

export type StageTone = 'neutral' | 'success' | 'warning' | 'error' | 'info';

export const STAGE_STATES: Record<StageItem['state'], { label: string; tone: StageTone }> = {
	done: { label: 'Пройден', tone: 'success' },
	current: { label: 'Сейчас', tone: 'info' },
	skipped: { label: 'Пропущен', tone: 'neutral' },
	pending: { label: 'Впереди', tone: 'neutral' }
};

/** Сколько сделка пробыла на этапе: у не посещённых — прочерк. */
export function stageTime(item: Pick<StageItem, 'state' | 'visits' | 'time_spent_seconds'>): string {
	if (item.visits === 0 && item.time_spent_seconds === 0) return '—';
	return formatDurationShort(item.time_spent_seconds * 1000);
}

/** Сколько раз сделка заходила на этап: «2 захода» только если больше одного (возврат). */
export function stageVisitsNote(visits: number): string {
	if (visits < 2) return '';
	return `${visits} ${visits < 5 ? 'захода' : 'заходов'}`;
}

export interface StageSla {
	text: string;
	tone: StageTone;
}

/** Срок этапа и итог: «Просрочен» красным, «В срок» — только у тех этапов, где SLA уже можно оценить. */
export function stageSla(item: Pick<StageItem, 'sla_hours' | 'sla_breached' | 'state'>): StageSla {
	if (item.sla_hours === null || item.sla_hours === undefined) return { text: 'без срока', tone: 'neutral' };
	const limit = formatHours(item.sla_hours);
	if (item.sla_breached) return { text: `Просрочен · срок ${limit}`, tone: 'error' };
	if (item.sla_breached === false && (item.state === 'done' || item.state === 'current')) return { text: `В срок · ${limit}`, tone: 'success' };
	return { text: `срок ${limit}`, tone: 'neutral' };
}

const categoryName = (code: string): string => ATTACHMENT_CATEGORY_LABELS[code] ?? code;

export interface StageEvidence {
	/** нет требований / всё приложено / не хватает */
	kind: 'none' | 'ok' | 'missing';
	text: string;
	tone: StageTone;
}

/** Чек-лист вложений для перехода вперёд: что требуется, что уже приложено и чего не хватает. */
export function stageEvidence(item: Pick<StageItem, 'evidence'>): StageEvidence {
	const { required = [], attached = [], ok } = item.evidence;
	if (required.length === 0) return { kind: 'none', text: '—', tone: 'neutral' };
	if (ok) return { kind: 'ok', text: required.map(categoryName).join(', '), tone: 'success' };
	const missing = required.filter((c) => !attached.includes(c));
	return { kind: 'missing', text: `Нет: ${(missing.length ? missing : required).map(categoryName).join(', ')}`, tone: 'warning' };
}

/** Короткая сводка над таблицей: пройдено из скольких, просрочки. */
/**
 * `commentsTotal` — сколько комментариев в сделке всего (вкладка «Обсуждение»): столбец «Комм.» считает только оставленные на этапах, остальные
 * (например, до первого перехода или на шаге, где сделки уже нет) в нём не видны, и без пояснения цифры расходятся (ST-2).
 */
export function stagesSummary(data: Pick<DealStages, 'summary' | 'items'>, commentsTotal?: number | null): string {
	const { done, skipped, sla_breached } = data.summary;
	const parts = [`Пройдено ${done} из ${data.items.length}`];
	if (skipped) parts.push(`пропущено ${skipped}`);
	parts.push(sla_breached ? `просрочено по сроку: ${sla_breached}` : 'просрочек нет');
	const onStages = data.items.reduce((sum, i) => sum + i.comments_count, 0);
	if (commentsTotal != null && commentsTotal > onStages) parts.push(`комментарии на этапах: ${onStages} из ${commentsTotal}, остальные — во вкладке «Обсуждение»`);
	return parts.join(' · ');
}
