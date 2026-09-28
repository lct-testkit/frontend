import { describe, expect, it } from 'vitest';
import { columnIndex, decodeXml, fromReportData, readXlsx, XlsxError } from './xlsx';
import { OPENPYXL_REPORT_BASE64 } from './xlsx.fixture';

// --- минимальный сборщик zip для проверки разных вариантов упаковки ------------------------

const encoder = new TextEncoder();

async function deflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
	const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function makeZip(files: Record<string, string>, opts: { method?: 0 | 8; comment?: string } = {}): Promise<Uint8Array<ArrayBuffer>> {
	const method = opts.method ?? 8;
	const parts: Uint8Array<ArrayBuffer>[] = [];
	const central: Uint8Array<ArrayBuffer>[] = [];
	let offset = 0;
	const u16 = (v: number) => [v & 255, (v >> 8) & 255];
	const u32 = (v: number) => [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255];
	for (const [name, text] of Object.entries(files)) {
		const nameBytes = encoder.encode(name);
		const raw = encoder.encode(text);
		const data = method === 8 ? await deflateRaw(new Uint8Array(raw)) : new Uint8Array(raw);
		const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...nameBytes, ...data]);
		central.push(
			new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(method), ...u16(0), ...u16(0), ...u32(0), ...u32(data.length), ...u32(raw.length), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameBytes])
		);
		parts.push(local);
		offset += local.length;
	}
	const directory = central.flatMap((c) => [...c]);
	const comment = encoder.encode(opts.comment ?? '');
	const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(directory.length), ...u32(offset), ...u16(comment.length), ...comment]);
	return new Uint8Array([...parts.flatMap((p) => [...p]), ...directory, ...end]);
}

const MAIN = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const workbook = (name: string) => `<workbook ${MAIN} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId7"/></sheets></workbook>`;
const relations = (target: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId7" Type="worksheet" Target="${target}"/></Relationships>`;
const sheet = (rows: string) => `<worksheet ${MAIN}><sheetData>${rows}</sheetData></worksheet>`;

const base64ToBytes = (b64: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// --- тесты ----------------------------------------------------------------------------

describe('readXlsx: файл openpyxl (как отдаёт бэкенд)', () => {
	it('читает заголовок, строки, пустые ячейки, числа, булево и спецсимволы', async () => {
		const table = await readXlsx(base64ToBytes(OPENPYXL_REPORT_BASE64));
		expect(table.sheetName).toBe('Воронка по статусам');
		expect(table.columns).toEqual(['Статус', 'Сейчас в статусе', 'Конверсия шага, %', 'Среднее время, дн.']);
		expect(table.rows).toEqual([
			['Идентификация вуза', 1, 100, null],
			['Квалификация & <проверка>', 3, 87.5, 0],
			['Договор «Тест» "кавычки"', 0, null, 2.25],
			['Итого', 4, true, 1200000]
		]);
		expect(table.truncated).toBe(false);
	});

	it('принимает ArrayBuffer и Uint8Array одинаково', async () => {
		const bytes = base64ToBytes(OPENPYXL_REPORT_BASE64);
		const fromBuffer = await readXlsx(bytes.buffer);
		const fromView = await readXlsx(bytes);
		expect(fromView).toEqual(fromBuffer);
	});
});

describe('readXlsx: варианты упаковки и типов ячеек', () => {
	it('общие строки, формульные строки, булевы, ошибки, дыры в колонках, rich text', async () => {
		const zip = await makeZip({
			'xl/workbook.xml': workbook('Лист &amp; 1'),
			'xl/_rels/workbook.xml.rels': relations('worksheets/data.xml'),
			'xl/sharedStrings.xml': `<sst ${MAIN}><si><t>Регион</t></si><si><r><t>Санкт-</t></r><r><t xml:space="preserve">Петербург</t></r><rPh><t>фонетика</t></rPh></si><si><t>Кол-во</t></si><si><t>&#x41;&amp;B _x000D_</t></si></sst>`,
			'xl/worksheets/data.xml': sheet(
				`<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row>` +
					`<row r="2"><c r="A2" t="s"><v>1</v></c><c r="C2"><v>15</v></c></row>` +
					`<row r="3"><c r="A3" t="s"><v>3</v></c><c r="B3" t="b"><v>1</v></c><c r="C3" t="e"><v>#DIV/0!</v></c></row>` +
					`<row r="4"><c r="A4" t="str"><f>A1</f><v>Формула</v></c><c r="C4"><v>2.5e3</v></c></row>` +
					`<row r="5"/>`
			)
		});
		const table = await readXlsx(zip);
		expect(table.sheetName).toBe('Лист & 1');
		expect(table.columns).toEqual(['Регион', 'Колонка 2', 'Кол-во']);
		expect(table.rows).toEqual([
			['Санкт-Петербург', null, 15],
			['A&B \r', true, '#DIV/0!'],
			['Формула', null, 2500]
		]);
	});

	it('без сжатия (stored), комментарий архива, пустые строки до заголовка, хвостовые пустые срезаются', async () => {
		const zip = await makeZip(
			{
				'xl/worksheets/sheet1.xml': sheet(
					`<row r="1"><c r="A1"/></row><row r="2"><c r="A2" t="inlineStr"><is><t>Месяц</t></is></c><c r="B2" t="inlineStr"><is><t>Создано</t></is></c></row>` +
						`<row r="3"><c r="A3" t="inlineStr"><is><t>2026-09</t></is></c><c r="B3"><v>33</v></c></row><row r="4"><c r="A4" t="inlineStr"></c></row>`
				)
			},
			{ method: 0, comment: 'zip-комментарий' }
		);
		const table = await readXlsx(zip);
		expect(table.sheetName).toBe('');
		expect(table.columns).toEqual(['Месяц', 'Создано']);
		expect(table.rows).toEqual([['2026-09', 33]]);
	});

	it('теги с префиксом пространства имён', async () => {
		const zip = await makeZip({
			'xl/worksheets/sheet1.xml': `<x:worksheet xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:sheetData><x:row r="1"><x:c r="A1" t="inlineStr"><x:is><x:t>Имя</x:t></x:is></x:c></x:row><x:row r="2"><x:c r="A2" t="inlineStr"><x:is><x:t>Анна</x:t></x:is></x:c></x:row></x:sheetData></x:worksheet>`
		});
		expect(await readXlsx(zip)).toMatchObject({ columns: ['Имя'], rows: [['Анна']] });
	});

	it('лист без данных', async () => {
		const zip = await makeZip({ 'xl/worksheets/sheet1.xml': sheet('') });
		expect(await readXlsx(zip)).toMatchObject({ columns: [], rows: [] });
	});

	it('ограничивает число строк и колонок', async () => {
		const rows = Array.from({ length: 8 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c><c r="C${i + 1}"><v>${i}</v></c></row>`).join('');
		const table = await readXlsx(await makeZip({ 'xl/worksheets/sheet1.xml': sheet(rows) }), { maxRows: 3, maxCols: 2 });
		expect(table.columns).toEqual(['0']);
		expect(table.rows).toEqual([[1], [2], [3]]);
		expect(table.truncated).toBe(true);
	});

	it('отвергает распаковку сверх предела', async () => {
		const zip = await makeZip({ 'xl/worksheets/sheet1.xml': sheet(`<row r="1"><c r="A1"><v>1</v></c></row>`) });
		await expect(readXlsx(zip, { maxEntryBytes: 20 })).rejects.toThrow(XlsxError);
	});
});

describe('fromReportData', () => {
	it('JSON бэкенда (`GET /reports/{id}/data`) в тот же вид, что и разбор файла', () => {
		expect(fromReportData({ columns: ['Статус', 'Сумма'], rows: [['Новая', 1000]] })).toEqual({
			columns: ['Статус', 'Сумма'],
			rows: [['Новая', 1000]],
			sheetName: '',
			truncated: false
		});
	});
});

describe('readXlsx: ошибки', () => {
	it('не zip', async () => {
		await expect(readXlsx(encoder.encode('это точно не архив, просто текст достаточной длины'))).rejects.toThrow(/не файл xlsx/);
		await expect(readXlsx(new Uint8Array(4))).rejects.toThrow(XlsxError);
	});

	it('нет листов', async () => {
		await expect(readXlsx(await makeZip({ 'docProps/app.xml': '<x/>' }))).rejects.toThrow(/нет листов/);
	});
});

describe('вспомогательное', () => {
	it('columnIndex', () => {
		expect(columnIndex('A1')).toBe(0);
		expect(columnIndex('Z9')).toBe(25);
		expect(columnIndex('AA10')).toBe(26);
		expect(columnIndex('ab3')).toBe(27);
		expect(columnIndex('12')).toBe(-1);
	});

	it('decodeXml', () => {
		expect(decodeXml('a &amp; b &lt;c&gt; &quot;d&quot; &apos;e&apos; &#1057;&#x41; _x0041_')).toBe('a & b <c> "d" \'e\' СA A');
		expect(decodeXml('&неизвестная; &#99999999;')).toBe('&неизвестная; &#99999999;');
	});
});
