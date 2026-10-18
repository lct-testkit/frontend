// Запоминание прошлого выбора в панели запуска (колонки, формат): localStorage, любой сбой хранилища — «ничего не помним».
const PREFIX = 'rtk.report.';

export const columnsKey = (templateCode: string): string => `${PREFIX}columns.${templateCode}`;
export const formatKey = (templateCode: string): string => `${PREFIX}format.${templateCode}`;

function store(): Storage | null {
	try {
		return globalThis.localStorage ?? null;
	} catch {
		return null;
	}
}

export function recall(key: string): unknown {
	try {
		const raw = store()?.getItem(key);
		return raw == null ? undefined : (JSON.parse(raw) as unknown);
	} catch {
		return undefined;
	}
}

export function remember(key: string, value: unknown): void {
	try {
		if (value === undefined) store()?.removeItem(key);
		else store()?.setItem(key, JSON.stringify(value));
	} catch {
		// приватное окно или переполнено — запоминание не обязательно
	}
}

export const recallStrings = (key: string): string[] | undefined => {
	const v = recall(key);
	return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : undefined;
};
