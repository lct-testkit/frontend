// Минимальное чтение .xlsx для сценариев (без зависимостей): zip → sharedStrings + первый лист → строки значений.
// Нужно, чтобы сверить скачанный файл с тем, что отдал сервер (колонки и число строк).
import { inflateRawSync } from 'node:zlib';

function unzip(buf) {
	let eocd = buf.length - 22;
	while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
	if (eocd < 0) throw new Error('не zip');
	const count = buf.readUInt16LE(eocd + 10);
	let p = buf.readUInt32LE(eocd + 16);
	const files = new Map();
	for (let i = 0; i < count; i++) {
		const method = buf.readUInt16LE(p + 10);
		const compressed = buf.readUInt32LE(p + 20);
		const nameLen = buf.readUInt16LE(p + 28);
		const extraLen = buf.readUInt16LE(p + 30);
		const commentLen = buf.readUInt16LE(p + 32);
		const offset = buf.readUInt32LE(p + 42);
		const name = buf.subarray(p + 46, p + 46 + nameLen).toString('utf8');
		const dataStart = offset + 30 + buf.readUInt16LE(offset + 26) + buf.readUInt16LE(offset + 28);
		const raw = buf.subarray(dataStart, dataStart + compressed);
		files.set(name, method === 0 ? raw : inflateRawSync(raw));
		p += 46 + nameLen + extraLen + commentLen;
	}
	return files;
}

const unescapeXml = (s) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/** Строки первого листа .xlsx: массив массивов значений (текст как есть, числа — строкой). */
export function readXlsxRows(buf) {
	const files = unzip(buf);
	const shared = [];
	const sst = files.get('xl/sharedStrings.xml')?.toString('utf8');
	if (sst) for (const m of sst.matchAll(/<si>([\s\S]*?)<\/si>/g)) shared.push(unescapeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')));
	const sheetName = [...files.keys()].find((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
	if (!sheetName) throw new Error('нет листа');
	const xml = files.get(sheetName).toString('utf8');
	const rows = [];
	for (const row of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
		const cells = [];
		for (const c of row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
			const type = /t="(\w+)"/.exec(c[1])?.[1];
			const ref = /r="([A-Z]+)\d+"/.exec(c[1])?.[1] ?? '';
			const col = [...ref].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
			const body = c[2] ?? '';
			let value;
			if (type === 's') value = shared[Number(/<v>(\d+)<\/v>/.exec(body)?.[1])] ?? '';
			else if (type === 'inlineStr') value = unescapeXml([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
			else value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
			cells[col >= 0 ? col : cells.length] = value;
		}
		rows.push(cells);
	}
	return rows;
}
