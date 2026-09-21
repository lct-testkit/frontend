// Цвета статусов. В БД `color` — строка до 16 символов, поэтому храним hex; значения — базовые цвета дизайн-системы (`--atmr-base-*`),
// выбирать можно только из палитры. Без цвета статус красится по типу (токены темы).
import type { StatusDraft, StatusType } from './graph';

export const STATUS_COLORS: readonly { key: string; name: string }[] = [
	{ key: '#1f69ff', name: 'Синий' },
	{ key: '#1898a9', name: 'Бирюзовый' },
	{ key: '#00ac43', name: 'Зелёный' },
	{ key: '#fda610', name: 'Янтарный' },
	{ key: '#ff2626', name: 'Красный' },
	{ key: '#d9206f', name: 'Малиновый' },
	{ key: '#7700ff', name: 'Фиолетовый' },
	{ key: '#585d69', name: 'Серый' }
];

const TYPE_COLOR: Record<StatusType, string> = {
	initial: 'var(--atmr-info-default)',
	intermediate: 'var(--atmr-neutral-default)',
	won: 'var(--atmr-success-default)',
	lost: 'var(--atmr-error-default)',
	parked: 'var(--atmr-warning-default)'
};

export const statusColor = (s: Pick<StatusDraft, 'color' | 'type'>): string => s.color || TYPE_COLOR[s.type];
