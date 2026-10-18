// Черновики диалога перехода: комментарий, значения полей и файлы, приложенные в диалоге. Живут только в памяти вкладки браузера
// (в sessionStorage и localStorage не пишутся: в комментариях бывают персональные данные) и привязаны к паре «сделка + переход».
// Диалог восстанавливает черновик при открытии, обновляет при вводе и стирает после успешного перехода и после подтверждённой отмены;
// уход по подсказке («К подписанию», «К задачам») черновик не трогает.

/** Файл, приложенный к сделке в диалоге перехода и ещё не привязанный к записи истории. */
export interface DraftFile {
	attachmentId: string;
	fileId: string;
	name: string;
	size: number;
	category: string;
}

export interface TransitionDraft {
	comment: string;
	values: Record<string, unknown>;
	files: DraftFile[];
}

const drafts = new Map<string, TransitionDraft>();

export const draftKey = (dealId: string, transitionId: string) => `${dealId}:${transitionId}`;

export function getDraft(key: string): TransitionDraft | undefined {
	const d = drafts.get(key);
	return d ? { comment: d.comment, values: { ...d.values }, files: [...d.files] } : undefined;
}

export function setDraft(key: string, draft: TransitionDraft): void {
	const empty = !draft.comment.trim() && !draft.files.length && !Object.values(draft.values).some((v) => v !== null && v !== undefined && v !== '');
	if (empty) drafts.delete(key);
	else drafts.set(key, { comment: draft.comment, values: { ...draft.values }, files: [...draft.files] });
}

export function clearDraft(key: string): void {
	drafts.delete(key);
}

/** Все черновики сразу: при выходе из системы и смене пользователя. */
export function clearAllDrafts(): void {
	drafts.clear();
}
