// Что значат статусы воронок, очереди исходящих событий, входящих сообщений и загрузок реестра ЕГРЮЛ — простыми словами: подсказка над плашкой
// (StatusChip `hint`). Ключи — значения из API, как в labels.ts и workflows/graph.ts; тест следит, чтобы ни одно значение не осталось без текста.
import type { DealType, WorkflowState } from './workflows/graph';

export const WORKFLOW_STATE_HINTS: Record<WorkflowState, string> = {
	draft: 'Черновик: правки пока не действуют, пока воронку не опубликуют.',
	published: 'Опубликована: по ней работают сделки.',
	archived: 'В архиве: воронка выведена из работы, новые сделки в неё не попадают.'
};

export const DEAL_TYPE_HINTS: Record<DealType, string> = {
	b2b: 'Воронка для сделок с организациями: вузами, колледжами, компаниями.',
	b2c: 'Воронка для сделок с физическими лицами.'
};

/** Исходящие события: система отправляет их во внешние системы (сайт, LMS, Bitrix24). */
export const OUTBOX_STATUS_HINTS: Record<string, string> = {
	pending: 'Событие ждёт отправки во внешнюю систему.',
	sent: 'Внешняя система приняла событие.',
	failed: 'Отправить не удалось, система повторит попытку.',
	dead: 'Попытки закончились: событие не доставлено.'
};

/** Входящие сообщения от внешних систем. */
export const INBOUND_STATUS_HINTS: Record<string, string> = {
	received: 'Сообщение получено, обработка ещё не закончилась.',
	processed: 'Сообщение обработано: данные попали в CRM.',
	failed: 'Обработать сообщение не удалось.',
	duplicate: 'Такое сообщение уже приходило: повторно оно не обрабатывалось.'
};

/** Версии реестра ЕГРЮЛ (единый государственный реестр юридических лиц): выгрузки ФНС. */
export const REGISTRY_VERSION_HINTS: Record<string, string> = {
	pending: 'Выгрузка в очереди на разбор.',
	running: 'Выгрузка разбирается, это может занять время.',
	completed: 'Выгрузка разобрана: данные доступны для автоподстановки по ИНН.',
	failed: 'Разобрать выгрузку не удалось.'
};

export const outboxHint = (s: string): string | undefined => OUTBOX_STATUS_HINTS[s];
export const inboundHint = (s: string, error?: string | null): string | undefined => {
	const base = INBOUND_STATUS_HINTS[s];
	return base && error ? `${base} Ошибка: ${error}` : base;
};
export const registryVersionHint = (s: string): string | undefined => REGISTRY_VERSION_HINTS[s];

export const workflowStateHint = (s: string): string | undefined => (WORKFLOW_STATE_HINTS as Record<string, string>)[s];
export const dealTypeHint = (t: string): string | undefined => (DEAL_TYPE_HINTS as Record<string, string>)[t];
