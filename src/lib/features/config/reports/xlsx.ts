// Чтение xlsx в браузере без зависимостей: zip (центральный каталог) → DecompressionStream('deflate-raw') → разбор XML листа.
// Дашборд с 28.09 берёт данные из JSON `GET /reports/{id}/data` (`fromReportData` ниже) — этот парсер файла больше не в проде
// (только тесты ниже), но оставлен: тот же XlsxTable нужен, если появится сценарий с реальным файлом, а не готовым JSON.
// XML разбирается небольшим сканером, а не DOMParser: тот же код работает в тестах (Node) и в браузере, а формат листа у нас узкий
// (openpyxl: строки `inlineStr`, числа `n`; Excel: общие строки `s`) — всё это покрыто.

export type Cell = string | number | boolean | null;

export interface XlsxTable {
	/** первая непустая строка листа */
	columns: string[];
	/** остальные строки, добитые до числа колонок; пустая ячейка = null */
	rows: Cell[][];
	sheetName: string;
	/** строк в файле больше, чем `maxRows` — хвост отброшен */
	truncated: boolean;
}

export interface XlsxLimits {
	maxRows?: number;
	maxCols?: number;
	/** предел распакованного размера одной части, байт (защита от zip-бомбы) */
	maxEntryBytes?: number;
}

export class XlsxError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'XlsxError';
	}
}

const DEFAULTS: Required<XlsxLimits> = { maxRows: 10_000, maxCols: 256, maxEntryBytes: 32 * 1024 * 1024 };

// --- zip ------------------------------------------------------------------------------

interface ZipEntry {
	name: string;
	method: number;
	compressedSize: number;
	size: number;
	/** смещение локального заголовка */
	offset: number;
}

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

function readDirectory(view: DataView): ZipEntry[] {
	const length = view.byteLength;
	let eocd = -1;
	// конец каталога: 22 байта + комментарий (≤ 65535), ищем с конца
	for (let i = length - 22; i >= Math.max(0, length - 22 - 0xffff); i--) {
		if (view.getUint32(i, true) === SIG_EOCD) {
			eocd = i;
			break;
		}
	}
	if (eocd < 0) throw new XlsxError('Это не файл xlsx: не найден каталог архива.');
	const total = view.getUint16(eocd + 10, true);
	const directoryOffset = view.getUint32(eocd + 16, true);
	if (total === 0xffff || directoryOffset === 0xffffffff) throw new XlsxError('Архивы zip64 не поддерживаются.');

	const decoder = new TextDecoder('utf-8');
	const entries: ZipEntry[] = [];
	let p = directoryOffset;
	for (let i = 0; i < total; i++) {
		if (p + 46 > length || view.getUint32(p, true) !== SIG_CENTRAL) throw new XlsxError('Повреждён каталог архива xlsx.');
		const nameLength = view.getUint16(p + 28, true);
		const extraLength = view.getUint16(p + 30, true);
		const commentLength = view.getUint16(p + 32, true);
		const name = decoder.decode(new Uint8Array(view.buffer, view.byteOffset + p + 46, nameLength));
		entries.push({
			name,
			method: view.getUint16(p + 10, true),
			compressedSize: view.getUint32(p + 20, true),
			size: view.getUint32(p + 24, true),
			offset: view.getUint32(p + 42, true)
		});
		p += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

async function inflateRaw(data: Uint8Array<ArrayBuffer>, limit: number): Promise<Uint8Array<ArrayBuffer>> {
	const reader = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			throw new XlsxError('Файл слишком большой для просмотра.');
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.byteLength;
	}
	return out;
}

async function extract(bytes: Uint8Array<ArrayBuffer>, entry: ZipEntry, limit: number): Promise<string> {
	if (entry.size > limit) throw new XlsxError('Файл слишком большой для просмотра.');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const at = entry.offset;
	if (at + 30 > bytes.byteLength || view.getUint32(at, true) !== SIG_LOCAL) throw new XlsxError('Повреждён архив xlsx.');
	// длины имени и extra в локальном заголовке могут отличаться от каталога — данные начинаются после них; размеры берём из каталога
	const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
	const raw = bytes.subarray(start, start + entry.compressedSize);
	let content: Uint8Array<ArrayBuffer>;
	if (entry.method === 0) content = new Uint8Array(raw);
	else if (entry.method === 8) content = await inflateRaw(new Uint8Array(raw), limit);
	else throw new XlsxError(`Способ сжатия ${entry.method} не поддерживается.`);
	return new TextDecoder('utf-8').decode(content);
}

// --- XML ------------------------------------------------------------------------------

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Сущности XML и экранирование OOXML `_x000D_`. */
export function decodeXml(value: string): string {
	if (!value.includes('&') && !value.includes('_x')) return value;
	return value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);|_x([0-9A-Fa-f]{4})_/g, (whole, entity?: string, escape?: string) => {
		if (escape) return String.fromCharCode(parseInt(escape, 16));
		if (!entity) return whole;
		if (entity.startsWith('#x')) return safeCodePoint(parseInt(entity.slice(2), 16), whole);
		if (entity.startsWith('#')) return safeCodePoint(parseInt(entity.slice(1), 10), whole);
		return NAMED[entity] ?? whole;
	});
}

function safeCodePoint(code: number, fallback: string): string {
	return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : fallback;
}

/** Необязательный префикс пространства имён (`x:c`). */
const NS = '(?:[\\w.-]+:)?';

function attributes(source: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of source.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[2] ?? m[3] ?? '');
	return out;
}

/** Текст всех `<t>` внутри фрагмента (строка `<si>` / `<is>`), без фонетических подсказок `<rPh>`. */
function textOf(fragment: string): string {
	const clean = fragment.replace(new RegExp(`<${NS}rPh\\b[\\s\\S]*?<\\/${NS}rPh>`, 'g'), '');
	let out = '';
	for (const m of clean.matchAll(new RegExp(`<${NS}t\\b[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/${NS}t>)`, 'g'))) out += decodeXml(m[1] ?? '');
	return out;
}

function parseSharedStrings(xml: string): string[] {
	const out: string[] = [];
	for (const m of xml.matchAll(new RegExp(`<${NS}si\\b[^>]*?(?:\\/>|>([\\s\\S]*?)<\\/${NS}si>)`, 'g'))) out.push(textOf(m[1] ?? ''));
	return out;
}

/** «AB12» → 27 (индекс колонки с нуля); без буквенной части → -1. */
export function columnIndex(ref: string): number {
	let n = 0;
	let letters = 0;
	for (const ch of ref) {
		const code = ch.charCodeAt(0);
		const upper = code >= 97 && code <= 122 ? code - 32 : code;
		if (upper < 65 || upper > 90) break;
		n = n * 26 + (upper - 64);
		letters++;
	}
	return letters ? n - 1 : -1;
}

function cellValue(type: string | undefined, body: string, strings: string[]): Cell {
	const raw = new RegExp(`<${NS}v\\b[^>]*>([\\s\\S]*?)<\\/${NS}v>`).exec(body)?.[1];
	const text = raw === undefined ? undefined : decodeXml(raw);
	switch (type) {
		case 'inlineStr': {
			const inline = new RegExp(`<${NS}is\\b[^>]*>([\\s\\S]*?)<\\/${NS}is>`).exec(body);
			const value = inline ? textOf(inline[1]) : '';
			return value === '' ? null : value;
		}
		case 's': {
			const value = strings[Number(text)];
			return value === undefined || value === '' ? null : value;
		}
		case 'str':
		case 'd':
		case 'e':
			return text === undefined || text === '' ? null : text;
		case 'b':
			return text === undefined ? null : text === '1' || text.toLowerCase() === 'true';
		default: {
			if (text === undefined || text.trim() === '') return null;
			const n = Number(text);
			return Number.isFinite(n) ? n : text;
		}
	}
}

interface ParsedSheet {
	rows: Cell[][];
	truncated: boolean;
}

function parseSheet(xml: string, strings: string[], limits: Required<XlsxLimits>): ParsedSheet {
	const rows: Cell[][] = [];
	let truncated = false;
	const rowPattern = new RegExp(`<${NS}row\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${NS}row>)`, 'g');
	const cellPattern = new RegExp(`<${NS}c\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${NS}c>)`, 'g');
	for (const rowMatch of xml.matchAll(rowPattern)) {
		// +1: первая строка — заголовок
		if (rows.length > limits.maxRows) {
			truncated = true;
			break;
		}
		const cells: Cell[] = [];
		let next = 0;
		for (const cellMatch of (rowMatch[2] ?? '').matchAll(cellPattern)) {
			const attrs = attributes(cellMatch[1]);
			const at = attrs.r ? columnIndex(attrs.r) : -1;
			const index = at >= 0 ? at : next;
			next = index + 1;
			if (index >= limits.maxCols) continue;
			while (cells.length < index) cells.push(null);
			cells[index] = cellValue(attrs.t, cellMatch[2] ?? '', strings);
		}
		rows.push(cells);
	}
	return { rows, truncated };
}

/** Путь части первого листа: workbook.xml → связи → `xl/worksheets/…`; запасной — sheet1. */
function firstSheet(workbook: string | null, relations: string | null, names: string[]): { path: string | null; name: string } {
	let name = '';
	let path: string | null = null;
	const sheet = workbook ? new RegExp(`<${NS}sheet\\b([^>]*?)\\/?>`).exec(workbook) : null;
	if (sheet) {
		const attrs = attributes(sheet[1]);
		name = attrs.name ?? '';
		const relationId = Object.entries(attrs).find(([key]) => key === 'id' || key.endsWith(':id'))?.[1];
		if (relationId && relations) {
			for (const m of relations.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
				const rel = attributes(m[1]);
				if (rel.Id === relationId && rel.Target) {
					path = rel.Target.startsWith('/') ? rel.Target.slice(1) : `xl/${rel.Target}`;
					break;
				}
			}
		}
	}
	if (path && names.includes(path)) return { path, name };
	const fallback = names.filter((n) => /^xl\/worksheets\/[^/]+\.xml$/.test(n)).sort()[0] ?? null;
	return { path: fallback, name };
}

const label = (cell: Cell): string => (cell === null ? '' : String(cell));

/** Читает первый лист xlsx: заголовок → `columns`, остальное → `rows`. */
export async function readXlsx(data: ArrayBuffer | Uint8Array, limits: XlsxLimits = {}): Promise<XlsxTable> {
	const lim = { ...DEFAULTS, ...limits };
	const bytes = new Uint8Array(data);
	if (bytes.byteLength < 22) throw new XlsxError('Это не файл xlsx.');
	const entries = readDirectory(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
	const byName = new Map(entries.map((e) => [e.name, e]));
	const read = async (name: string): Promise<string | null> => {
		const entry = byName.get(name);
		return entry ? extract(bytes, entry, lim.maxEntryBytes) : null;
	};

	const workbook = await read('xl/workbook.xml');
	const relations = await read('xl/_rels/workbook.xml.rels');
	const { path, name } = firstSheet(workbook, relations, [...byName.keys()]);
	if (!path) throw new XlsxError('В файле нет листов.');
	const sheetXml = await read(path);
	if (sheetXml === null) throw new XlsxError('В файле нет листов.');
	const sharedXml = await read('xl/sharedStrings.xml');
	const strings = sharedXml ? parseSharedStrings(sharedXml) : [];

	const { rows: raw, truncated } = parseSheet(sheetXml, strings, lim);
	const headerAt = raw.findIndex((row) => row.some((c) => c !== null));
	if (headerAt < 0) return { columns: [], rows: [], sheetName: name, truncated };
	const header = raw[headerAt];
	let width = header.length;
	while (width > 0 && header[width - 1] === null) width--;
	const columns = header.slice(0, width).map((c, i) => label(c) || `Колонка ${i + 1}`);
	const body = raw
		.slice(headerAt + 1)
		.map((row) => Array.from({ length: columns.length }, (_, i) => row[i] ?? null));
	while (body.length && body[body.length - 1].every((c) => c === null)) body.pop();
	return { columns, rows: body, sheetName: name, truncated };
}

/** JSON `{columns, rows}` от `GET /reports/{id}/data` в форму `XlsxTable` — дашборду всё равно, откуда данные;
 * `sheetName`/`truncated` в JSON-ответе не приходят (у файла нет листов, а лимит строк — как у самого отчёта). */
export function fromReportData(data: { columns: string[]; rows: unknown[][] }): XlsxTable {
	return { columns: data.columns, rows: data.rows as Cell[][], sheetName: '', truncated: false };
}

/** Скачивает файл по подписанной ссылке (без учётных данных: подпись уже в адресе) и читает его. */
export async function fetchXlsx(url: string, signal?: AbortSignal, limits?: XlsxLimits): Promise<XlsxTable> {
	let response: Response;
	try {
		response = await fetch(url, { signal, credentials: 'omit', cache: 'no-store' });
	} catch (e) {
		if (signal?.aborted) throw e;
		throw new XlsxError('Не удалось скачать файл отчёта. Проверьте соединение.');
	}
	if (!response.ok) throw new XlsxError(response.status === 403 || response.status === 404 ? 'Ссылка на файл устарела. Запустите отчёт заново.' : `Хранилище файлов ответило ошибкой ${response.status}.`);
	return readXlsx(await response.arrayBuffer(), limits);
}
