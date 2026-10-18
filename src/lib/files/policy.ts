// Правила загрузки файлов на клиенте: форматы и предельный размер. Проверка идёт ДО запроса upload-intent,
// чтобы заведомо неподходящий файл не создавал запись на сервере.
//
// Отдельной ручки с политикой в API пока нет (`GET /api/files/policy` — запрос к бэкенду), поэтому источник один:
// DEFAULT_POLICY, сверенный с `ALLOWED_FILE_EXTENSIONS` и `files_max_size_bytes` бэкенда. Когда ручка появится,
// достаточно вызвать `setPolicy(...)` при старте сессии. Если администратор сузил список в .env, клиент пропустит файл,
// а сервер откажет 422 — текст сервера всё равно показывается в строке очереди.
import { formatBytes } from '$lib/utils/format';

export interface FilePolicy {
	/** допустимые расширения в нижнем регистре, без точки */
	extensions: ReadonlySet<string>;
	maxBytes: number;
}

const MAX_FILENAME_LENGTH = 255;

export const DEFAULT_POLICY: FilePolicy = {
	extensions: new Set(['png', 'jpeg', 'jpg', 'pdf', 'zip', 'gz', 'gzip', 'rar', 'doc', 'docx', 'xls', 'xlsx', 'xml', 'csv', 'json']),
	maxBytes: 50 * 1024 * 1024
};

/** Сервер всегда запрещает svg (встроенные скрипты), даже если расширение попало в список. */
const ALWAYS_DENIED = new Set(['svg']);

let current: FilePolicy = DEFAULT_POLICY;

export function getPolicy(): FilePolicy {
	return current;
}

/** Подменить политику (ответ будущей ручки политики или тест). Без аргумента — вернуть значения по умолчанию. */
export function setPolicy(next?: { extensions: Iterable<string>; maxBytes: number } | null) {
	current = next
		? { extensions: new Set([...next.extensions].map((e) => e.toLowerCase().replace(/^\./, ''))), maxBytes: next.maxBytes }
		: DEFAULT_POLICY;
}

/** Расширение берётся последним: `archive.tar.gz` → `gz`. Без точки или с точкой в конце — пустая строка. */
export function extensionOf(name: string): string {
	const i = name.lastIndexOf('.');
	return i < 0 || i === name.length - 1 ? '' : name.slice(i + 1).toLowerCase();
}

const FRIENDLY: Array<[string, string[]]> = [
	['PDF', ['pdf']],
	['PNG', ['png']],
	['JPEG', ['jpeg', 'jpg']],
	['Word', ['doc', 'docx']],
	['Excel', ['xls', 'xlsx']],
	['ZIP', ['zip']],
	['GZIP', ['gz', 'gzip']],
	['RAR', ['rar']],
	['XML', ['xml']],
	['CSV', ['csv']],
	['JSON', ['json']]
];

/** «PDF, PNG, JPEG, Word, Excel, ZIP, GZIP, RAR…» — группы, у которых в политике есть хотя бы одно расширение. */
export function allowedLabel(policy: FilePolicy = current): string {
	return FRIENDLY.filter(([, exts]) => exts.some((e) => policy.extensions.has(e)))
		.map(([label]) => label)
		.join(', ');
}

/** Значение для атрибута `accept` у `<input type="file">`. */
export function acceptAttr(policy: FilePolicy = current): string {
	return [...policy.extensions].filter((e) => !ALWAYS_DENIED.has(e)).map((e) => `.${e}`).join(',');
}

export type FileProblemCode = 'type' | 'size' | 'empty' | 'name';
export type FileCheck = { ok: true } | { ok: false; code: FileProblemCode; message: string };

export function validateFile(file: { name: string; size: number }, policy: FilePolicy = current): FileCheck {
	if (file.name.length > MAX_FILENAME_LENGTH) {
		return { ok: false, code: 'name', message: `Имя файла длиннее ${MAX_FILENAME_LENGTH} символов — сократите его` };
	}
	const ext = extensionOf(file.name);
	if (!ext || ALWAYS_DENIED.has(ext) || !policy.extensions.has(ext)) {
		const shown = ext ? `.${ext}` : file.name.includes('.') ? '.' : 'без расширения';
		const head = ext ? `Тип «${shown}» не поддерживается` : `Файл ${shown} не поддерживается`;
		return { ok: false, code: 'type', message: `${head}. Допустимо: ${allowedLabel(policy)}` };
	}
	if (file.size === 0) return { ok: false, code: 'empty', message: 'Файл пустой' };
	if (file.size > policy.maxBytes) {
		return { ok: false, code: 'size', message: `Файл больше ${formatBytes(policy.maxBytes).replace(/ /g, ' ')}` };
	}
	return { ok: true };
}
