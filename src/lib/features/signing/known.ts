// Списка «все мои документы» у бэкенда всё ещё нет (backend-issues C-5, часть про документы по
// пользователю), поэтому «мои документы» собираем из трёх источников: то, что создавали в этом
// браузере (localStorage), запросы, где я подписант, и (для аудит-ролей) журнал. Сами карточки по
// собранным id — batch-запросом (GET /signature-documents/batch, до BATCH_LIMIT id за запрос), а
// не по одному: раньше здесь был пул на N воркеров по одному GET на документ — 300 документов на
// вкладке «Документы» значило 300 запросов (продовый инцидент). Кэш документов — на время сессии
// вкладки, чтобы карточка сделки и список не запрашивали одно и то же дважды.
import { getDocument, getDocumentsBatch } from './api';
import type { SignatureDocument } from './types';

const KEY = 'rtk.signing.docs';
const LIMIT = 100;
// Лимит бэкенда на число id в одном batch-запросе (`_MAX_BATCH_IDS` в signing/router.py) — при
// большем количестве известных id разбиваем на несколько запросов, а не получаем 422.
const BATCH_LIMIT = 100;

interface Known {
	id: string;
	entity_id: string | null;
}

function read(): Known[] {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
		return Array.isArray(raw) ? (raw.filter((x) => x && typeof (x as Known).id === 'string') as Known[]) : [];
	} catch {
		return [];
	}
}

/** Запоминаем созданный документ: без этого карточка сделки не найдёт его после перезагрузки. */
export function rememberDocument(id: string, entityId: string | null): void {
	const list = [{ id, entity_id: entityId }, ...read().filter((k) => k.id !== id)].slice(0, LIMIT);
	try {
		localStorage.setItem(KEY, JSON.stringify(list));
	} catch {
		// хранилище закрыто — документ останется доступным по ссылке
	}
}

export function knownDocumentIds(entityId?: string): string[] {
	return read()
		.filter((k) => !entityId || k.entity_id === entityId)
		.map((k) => k.id);
}

const cache = new Map<string, SignatureDocument>();
// И одиночный `fetchDocument`, и batch-группы `fetchDocuments` пишут в один и тот же реестр:
// если карточка уже летит (одним GET или внутри чужой группы), второй запрос за тем же id не уходит.
const inflight = new Map<string, Promise<SignatureDocument | null>>();

export const cachedDocument = (id: string): SignatureDocument | undefined => cache.get(id);

export function putDocument(doc: SignatureDocument): void {
	cache.set(doc.id, doc);
}

/** Один документ; недоступный (404/403) даёт null — такое в списке просто пропускаем. */
export function fetchDocument(id: string, fresh = false): Promise<SignatureDocument | null> {
	if (!fresh && cache.has(id)) return Promise.resolve(cache.get(id)!);
	const running = inflight.get(id);
	if (running && !fresh) return running;
	const job = getDocument(id)
		.then((doc) => {
			cache.set(id, doc);
			return doc;
		})
		.catch(() => null)
		.finally(() => inflight.delete(id));
	inflight.set(id, job);
	return job;
}

/**
 * Одна группа (≤ BATCH_LIMIT id) через один batch-запрос. Регистрирует каждый id в `inflight`
 * синхронно (до первого await), чтобы параллельный `fetchDocument`/`fetchDocuments` на тот же id
 * присоединился, а не запросил его снова. Сеть/сервер недоступны — как и `fetchDocument`, отдаём
 * «не нашлось», а не бросаем: один сбойный чанк не должен валить всю вкладку.
 */
function fetchGroup(ids: string[]): Promise<SignatureDocument | null>[] {
	const job = getDocumentsBatch(ids)
		.catch(() => [] as SignatureDocument[])
		.then((docs) => {
			for (const doc of docs) cache.set(doc.id, doc);
			return docs;
		});
	job.finally(() => {
		for (const id of ids) inflight.delete(id);
	});
	const perId = ids.map((id) => job.then(() => cache.get(id) ?? null));
	ids.forEach((id, index) => inflight.set(id, perId[index]));
	return perId;
}

/**
 * Пачка документов: неизвестные id уходят группами по ≤ BATCH_LIMIT одним запросом на группу
 * (а не по одному, см. заголовок файла). Уже закэшированные и уже летящие (в том числе одиночным
 * `fetchDocument`) id повторно не запрашиваются. `concurrency` — сколько групп уходит параллельно
 * (нужен только когда известных id больше сотни; сегодня вкладка «Документы» сама режет их до 60,
 * то есть обычно уходит один запрос).
 */
export async function fetchDocuments(ids: string[], concurrency = 4): Promise<SignatureDocument[]> {
	const unique = [...new Set(ids)];
	const joined: Promise<unknown>[] = [];
	const toStart: string[] = [];
	for (const id of unique) {
		if (cache.has(id)) continue;
		const running = inflight.get(id);
		if (running) joined.push(running);
		else toStart.push(id);
	}

	const groups: string[][] = [];
	for (let i = 0; i < toStart.length; i += BATCH_LIMIT) groups.push(toStart.slice(i, i + BATCH_LIMIT));

	let next = 0;
	async function worker(): Promise<void> {
		while (next < groups.length) {
			await Promise.all(fetchGroup(groups[next++]));
		}
	}
	await Promise.all([...Array.from({ length: Math.min(concurrency, groups.length) }, worker), ...joined]);

	return unique.map((id) => cache.get(id)).filter((d): d is SignatureDocument => d !== undefined);
}
