// Список документов по сделке и по пользователю у бэкенда закрыт лидом (backend-issues C-5), поэтому «мои документы» собираем из
// трёх источников: то, что создавали в этом браузере (localStorage), запросы, где я подписант, и (для аудит-ролей) журнал.
// Кэш документов — на время сессии вкладки, чтобы карточка сделки и список не запрашивали одно и то же дважды.
import { getDocument } from './api';
import type { SignatureDocument } from './types';

const KEY = 'rtk.signing.docs';
const LIMIT = 100;

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

/** Пачка документов с ограничением параллельности (не заваливаем API N запросами разом). */
export async function fetchDocuments(ids: string[], concurrency = 4): Promise<SignatureDocument[]> {
	const unique = [...new Set(ids)];
	const out: (SignatureDocument | null)[] = new Array(unique.length).fill(null);
	let next = 0;
	async function worker() {
		while (next < unique.length) {
			const index = next++;
			out[index] = await fetchDocument(unique[index]);
		}
	}
	await Promise.all(Array.from({ length: Math.min(concurrency, unique.length) }, worker));
	return out.filter((d): d is SignatureDocument => d !== null);
}
