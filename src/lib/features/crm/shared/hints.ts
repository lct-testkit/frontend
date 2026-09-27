// Что значат статусы, приоритеты и сроки CRM — простыми словами: подсказка над плашкой (StatusChip `hint`). Тексты взяты из new_spec §4.10, §5 и
// перечислений бэкенда (crm/models.py, catalog/models.py). Ключи — значения из API, как в labels.ts; тест следит, чтобы ни одно значение не осталось без текста.
import { STATUS_TYPE_LABELS, PRIORITY_LABELS, SLA_STATE_LABELS, SIGNATURE_STATUS_LABELS, REGISTRY_STATUS_LABELS } from './labels';

export const PRIORITY_HINTS: Record<keyof typeof PRIORITY_LABELS, string> = {
	low: 'Не срочно: можно заняться после остальных дел.',
	normal: 'Обычный порядок работы.',
	high: 'Срочнее обычного: возьмите в работу в первую очередь.',
	critical: 'Самое срочное: требует внимания сейчас.'
};

/** SLA — срок, который сделка может пробыть в одном статусе воронки. */
export const SLA_STATE_HINTS: Record<keyof typeof SLA_STATE_LABELS, string> = {
	ok: 'Срок пребывания сделки в этом статусе (SLA) идёт, времени достаточно.',
	warning: 'Израсходовано больше 75% срока в этом статусе (SLA). Продвиньте сделку, пока срок не нарушен.',
	breached: 'Срок в этом статусе (SLA) вышел, сделка «зависла». Вам и руководителю отправлено уведомление.',
	paused: 'Срок (SLA) остановлен, пока сделка заморожена. Накопленное время сохранено.'
};

/** Тип статуса воронки: что он значит для сделки. */
export const STATUS_TYPE_HINTS: Record<keyof typeof STATUS_TYPE_LABELS, string> = {
	initial: 'Начальный статус воронки: сюда попадает новая сделка.',
	intermediate: 'Рабочий этап воронки: сделка идёт к успешному закрытию, отказу или заморозке.',
	won: 'Сделка закрыта успешно: воронка пройдена до конца.',
	lost: 'Сделка закрыта отказом. Причину отказа указывают при переходе.',
	parked: 'Сделка заморожена до нужной даты. Срок (SLA) в этом статусе не идёт.'
};

/** Статус подписи по сделке: сводка по её документам. */
export const SIGNATURE_STATUS_HINTS: Record<keyof typeof SIGNATURE_STATUS_LABELS, string> = {
	none: 'По сделке нет документов, которые нужно подписывать.',
	pending: 'Документ отправлен подписантам, подписей пока нет.',
	partially_signed: 'Часть подписантов уже подписала, ждём остальных.',
	signed: 'Все подписанты подписали документ.',
	rejected: 'Кто-то из подписантов отказался подписывать.',
	expired: 'Срок на подпись вышел, документ не подписан. Отправьте его заново.',
	void: 'Документ аннулирован инициатором: подписи по нему недействительны.'
};

/** Статус организации в ЕГРЮЛ (единый государственный реестр юридических лиц) по последней выгрузке ФНС. */
export const REGISTRY_STATUS_HINTS: Record<keyof typeof REGISTRY_STATUS_LABELS, string> = {
	active: 'По данным ЕГРЮЛ организация действует.',
	reorganizing: 'В ЕГРЮЛ отмечена реорганизация (слияние, разделение и т. п.): реквизиты могут измениться.',
	liquidating: 'В ЕГРЮЛ отмечен процесс ликвидации: риск, что организация перестанет существовать.',
	liquidated: 'Организация ликвидирована по данным ЕГРЮЛ.',
	invalid: 'Запись в ЕГРЮЛ отмечена как недействительная.'
};

const has = (map: Record<string, string>, key: string | null | undefined): string | undefined => (key ? map[key] : undefined);

export const priorityHint = (key: string): string | undefined => has(PRIORITY_HINTS, key);
/** Обычный рабочий этап (`intermediate`) без подсказки: общий текст ничего не говорит о конкретном статусе. */
export const statusTypeHint = (key: string | null | undefined): string | undefined => (key === 'intermediate' ? undefined : has(STATUS_TYPE_HINTS, key));
export const signatureStatusHint = (key: string | null | undefined): string | undefined => has(SIGNATURE_STATUS_HINTS, key);
export const registryStatusHint = (key: string | null | undefined): string | undefined => has(REGISTRY_STATUS_HINTS, key);

/** Подсказка SLA: что значит состояние + точный срок (если он известен). */
export function slaHint(state: string, dueLabel?: string | null, shortLabel?: string | null): string | undefined {
	const base = has(SLA_STATE_HINTS, state);
	if (!base) return undefined;
	return [shortLabel ? `${shortLabel}.` : '', base, dueLabel ? `Срок: ${dueLabel}.` : ''].filter(Boolean).join(' ');
}
