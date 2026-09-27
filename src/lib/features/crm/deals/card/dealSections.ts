// Раскладка «Обзора» сделки по смыслу: что относится к самой сделке, что — к заморозке / отказу, что — дополнительные поля воронки.
// Приоритет и «Изменена» — внутренняя оценка и служебная дата CRM, а не факты сделки: приоритет живёт чипом в шапке, «Изменена» — тихой строкой внизу.

/** Пользовательские поля, которые сид воронки просит при заморозке (условие «Заморозить»: дата возобновления или причина). */
const FREEZE_FIELD_CODES = ['resume_at', 'park_reason'];

export type StatusGroup = 'frozen' | 'lost' | null;

/** К какой группе относится текущий статус: заморозка, отказ или ни к какой (открытая / успешно закрытая сделка). */
export function statusGroup(type: string | null | undefined): StatusGroup {
	return type === 'parked' ? 'frozen' : type === 'lost' ? 'lost' : null;
}

export const STATUS_GROUP_TITLES: Record<Exclude<StatusGroup, null>, string> = { frozen: 'Заморозка', lost: 'Отказ' };

/** Относится ли пользовательское поле к заморозке: известные коды или поле, обязательное для текущего статуса (`custom_fields.<code>`). */
export function isStatusField(code: string, group: StatusGroup, requiredFields: readonly string[] = []): boolean {
	if (!group) return false;
	return (group === 'frozen' && FREEZE_FIELD_CODES.includes(code)) || requiredFields.includes(`custom_fields.${code}`);
}
