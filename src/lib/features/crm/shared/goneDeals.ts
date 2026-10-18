// Удалённые сделки (ответ 404 на `GET /api/deals/{id}`). Колокольчик, «Недавние» и журнал спрашивают название сделки по id;
// если сделку удалили, ответ всегда 404 — запоминаем id на вкладку (sessionStorage) и после перезагрузки страницы не спрашиваем снова.
// Хранилище недоступно (приватное окно) — остаётся память модуля.
const KEY = 'rtk.crm.gone-deals';
const MAX = 500;

const memory = new Set<string>();

function read(): string[] {
	try {
		const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]');
		return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

let loaded = false;

export function isGone(id: string): boolean {
	if (!loaded) {
		loaded = true;
		for (const stored of read()) memory.add(stored);
	}
	return memory.has(id);
}

export function markGone(id: string): void {
	isGone(id);
	memory.add(id);
	try {
		const list = read().filter((x) => x !== id);
		list.push(id);
		sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
	} catch {
		// хранилище недоступно — достаточно памяти модуля
	}
}

export function clearGone(): void {
	loaded = true;
	memory.clear();
	try {
		sessionStorage.removeItem(KEY);
	} catch {
		// нечего чистить
	}
}
