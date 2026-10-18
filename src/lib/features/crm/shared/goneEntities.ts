// Удалённые сущности (ответ 404 на `GET /api/deals|organizations|contacts/{id}`). Колокольчик, «Недавние» и журнал аудита спрашивают
// название по id; если сущность удалили, ответ всегда 404 — запоминаем id на вкладку (sessionStorage) и после перезагрузки страницы
// не спрашиваем снова. Хранилище недоступно (приватное окно) — остаётся память модуля.
export type GoneKind = 'deal' | 'organization' | 'contact';

const KEY = 'rtk.crm.gone';
const MAX = 500;

const memory: Record<GoneKind, Set<string>> = { deal: new Set(), organization: new Set(), contact: new Set() };
let loaded = false;

function readStored(): Partial<Record<GoneKind, unknown>> {
	try {
		const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '{}');
		return parsed && typeof parsed === 'object' ? (parsed as Partial<Record<GoneKind, unknown>>) : {};
	} catch {
		return {};
	}
}

function load(): void {
	if (loaded) return;
	loaded = true;
	const stored = readStored();
	for (const kind of Object.keys(memory) as GoneKind[]) {
		const list = stored[kind];
		if (Array.isArray(list)) for (const id of list) if (typeof id === 'string') memory[kind].add(id);
	}
}

export function isGone(kind: GoneKind, id: string): boolean {
	load();
	return memory[kind].has(id);
}

export function markGone(kind: GoneKind, id: string): void {
	load();
	// порядок вставки Set = порядок давности: самые старые вытесняются первыми
	memory[kind].delete(id);
	memory[kind].add(id);
	try {
		const out: Record<string, string[]> = {};
		for (const k of Object.keys(memory) as GoneKind[]) out[k] = [...memory[k]].slice(-MAX);
		sessionStorage.setItem(KEY, JSON.stringify(out));
	} catch {
		// хранилище недоступно — достаточно памяти модуля
	}
}

export function clearGone(): void {
	loaded = true;
	for (const set of Object.values(memory)) set.clear();
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// нечего чистить
	}
}
