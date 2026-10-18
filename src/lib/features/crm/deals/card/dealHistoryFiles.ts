// Файлы в истории сделки: чистые функции (без запросов).
//
// Запись истории статусов знает только число файлов (`attachments_count`); сами файлы — `GET /api/deals/{id}/history/{history_id}/attachments`.
// Событие «Добавлен файл» (FILE_ADDED) создаётся при загрузке файла в сделку — ещё до перехода, поэтому в его данных нет записи истории,
// только `attachment_id`: файл, который уже показан под записью статуса, из ленты событий скрываем, чтобы он не выводился дважды.
import { ATTACHMENT_CATEGORY_LABELS } from '../../shared/labels';
import type { Attachment, DealEvent } from '../../types';

export const attachmentName = (a: Pick<Attachment, 'file' | 'description'>): string => a.file?.original_filename || a.description || 'Файл';

/** Файлы записи по времени загрузки, от раннего к позднему. */
export function sortFiles<T extends { created_at: string }>(files: readonly T[]): T[] {
	return [...files].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Идентификаторы вложений из `payload` события; события без `attachment_id` вернут `null`. */
export const eventAttachmentId = (event: Pick<DealEvent, 'payload'>): string | null => {
	const id = event.payload?.attachment_id;
	return typeof id === 'string' ? id : null;
};

/** Убрать из ленты события «Добавлен файл», чей файл уже показан под записью статуса. Остальные события и файлы вне перехода остаются. */
export function hideDuplicatedEvents<E extends Pick<DealEvent, 'event_type' | 'payload'>>(events: readonly E[], shown: ReadonlySet<string>): E[] {
	return events.filter((e) => {
		if (e.event_type !== 'FILE_ADDED') return true;
		const id = eventAttachmentId(e);
		return !(id && shown.has(id));
	});
}

/** Вторая строка события файла: «договор.pdf · Договор». */
export function fileEventSummary(event: Pick<DealEvent, 'payload'>): string {
	const p = event.payload ?? {};
	const name = typeof p.filename === 'string' ? p.filename : '';
	const category = typeof p.category === 'string' ? (ATTACHMENT_CATEGORY_LABELS[p.category] ?? p.category) : '';
	return [name, category].filter(Boolean).join(' · ');
}
