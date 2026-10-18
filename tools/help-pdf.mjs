// PDF руководств из markdown и картинок репозитория, без запущенного стенда и без входа в приложение.
//   node tools/help-pdf.mjs --guide admin --out help-pdf       руководство администратора → help-pdf/rtk-crm-admin.pdf
//   node tools/help-pdf.mjs --guide user|all
// Нужен Chrome или Edge (как у остальных инструментов: PW_CHANNEL) и кириллические шрифты на машине сборки. Готовые PDF в git не кладём.
// Индекс глав берётся из src/lib/features/help/chapters.ts (F6-1), пока его нет — из имён файлов каталога глав.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';
import { GUIDE_TITLES, escapeHtml, indexFromFiles, parseChapterIndex, pickChapters, sectionsOf } from './help-pdf-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const guide = opt('guide', 'user');
if (!(guide in GUIDE_TITLES)) throw new Error(`--guide: admin | user | all, получено «${guide}»`);
const out = resolve(root, opt('out', 'help-pdf'));
const content = resolve(root, 'src/lib/content/help');
const FILE = { user: 'rtk-crm-user.pdf', admin: 'rtk-crm-admin.pdf', all: 'rtk-crm-guides.pdf' }[guide];

// без кириллических шрифтов страницы выйдут пустыми квадратами: на Linux проверяем заранее
if (process.platform === 'linux') {
	try {
		if (execFileSync('fc-list', [':lang=ru'], { encoding: 'utf8' }).trim() === '') {
			throw new Error('На машине нет шрифтов с кириллицей (fc-list :lang=ru пуст): установите, например, fonts-dejavu или fonts-liberation.');
		}
	} catch (e) {
		if (/шрифтов/.test(String(e.message))) throw e;
		// fc-list нет: проверим по тексту готового PDF
	}
}

async function listFiles(dir, prefix = '') {
	const result = [];
	for (const e of await readdir(dir, { withFileTypes: true })) {
		if (e.isDirectory()) result.push(...(await listFiles(resolve(dir, e.name), `${prefix}${e.name}/`)));
		else if (e.name.endsWith('.md')) result.push(`${prefix}${e.name}`);
	}
	return result;
}
const firstHeading = (text, fallback) => /^#\s+(.+?)\s*$/m.exec(text)?.[1] ?? fallback;

const indexFile = resolve(root, 'src/lib/features/help/chapters.ts');
let chapters = existsSync(indexFile) ? parseChapterIndex(await readFile(indexFile, 'utf8')) : [];
if (!chapters.length) {
	const files = await listFiles(content);
	const titles = new Map(await Promise.all(files.map(async (f) => [f, firstHeading(await readFile(resolve(content, f), 'utf8'), f)])));
	chapters = indexFromFiles(files, (f) => titles.get(f));
}
const plan = pickChapters(chapters, guide);
if (!plan.length) throw new Error(`В руководстве «${GUIDE_TITLES[guide]}» нет глав`);

const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.gif': 'image/gif' };
async function embedImages(html) {
	const srcs = [...new Set([...html.matchAll(/src="(\/help\/[^"]+)"/g)].map((m) => m[1]))];
	for (const src of srcs) {
		const file = resolve(root, 'static', src.slice(1));
		const type = mime[file.slice(file.lastIndexOf('.')).toLowerCase()];
		if (!existsSync(file) || !type) {
			console.warn(`  нет картинки ${src}`);
			continue;
		}
		html = html.split(`src="${src}"`).join(`src="data:${type};base64,${(await readFile(file)).toString('base64')}"`);
	}
	return html;
}

const docs = [];
for (const c of plan) {
	const text = await readFile(resolve(content, c.file), 'utf8');
	// вход — наш же репозиторий, не пользовательский ввод: без DOMPurify
	const body = await embedImages(marked.parse(text.replace(/^#\s+.+\n+/, ''), { async: false, gfm: true, breaks: true }));
	docs.push({ ...c, title: firstHeading(text, c.title), sections: sectionsOf(text), body });
}

// печатные правила повторяют экранный лист (features/help-print): A4, глава с новой страницы, картинки, таблицы и код не разрезаются
const css = `
@page { size: A4; margin: 18mm 15mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #000; background: #fff; font: 10.5pt/1.5 'Rostelecom Basis', 'Segoe UI', 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif; }
h1, h2, h3, h4 { line-height: 1.25; break-after: avoid; }
h1 { font-size: 26pt; margin: 0 0 8pt; }
h2 { font-size: 16pt; margin: 18pt 0 6pt; }
h3 { font-size: 12.5pt; margin: 14pt 0 4pt; }
.title { min-height: 230mm; display: flex; flex-direction: column; justify-content: center; break-after: page; }
.title p { margin: 0 0 6pt; font-size: 12pt; }
.toc { break-after: page; }
.toc ol { padding-left: 18pt; } .toc li { margin: 4pt 0; font-weight: 600; }
.toc ul { margin: 2pt 0 0; font-weight: 400; font-size: 9.5pt; }
article { break-before: page; }
article > h2:first-child { margin-top: 0; font-size: 20pt; }
img { max-width: 100%; break-inside: avoid; border: 0.5pt solid #bbb; }
table { border-collapse: collapse; width: 100%; break-inside: avoid; font-size: 9.5pt; }
th, td { border: 0.5pt solid #999; padding: 3pt 5pt; text-align: left; vertical-align: top; }
pre { white-space: pre-wrap; word-break: break-word; break-inside: avoid; background: #f3f3f3; padding: 6pt; font: 9pt/1.4 'DejaVu Sans Mono', Consolas, monospace; }
code { font-family: 'DejaVu Sans Mono', Consolas, monospace; font-size: 0.92em; }
a { color: #000; text-decoration: none; }
a[href^='http']::after { content: ' (' attr(href) ')'; word-break: break-all; }
blockquote { margin: 6pt 0; padding: 2pt 10pt; border-left: 2pt solid #999; }
`;
const today = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const toc = docs.map((d) => `<li>${escapeHtml(d.title)}${d.sections.length ? `<ul>${d.sections.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}</li>`).join('');
const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(GUIDE_TITLES[guide])}</title><style>${css}</style></head><body>
<section class="title"><p>RTK School · CRM по работе с вузами</p><h1>${escapeHtml(GUIDE_TITLES[guide])}</h1><p>Сформировано ${today}</p></section>
<nav class="toc"><h2>Оглавление</h2><ol>${toc}</ol></nav>
${docs.map((d) => `<article id="${escapeHtml(d.slug)}"><h2>${escapeHtml(d.title)}</h2>${d.body}</article>`).join('\n')}
</body></html>`;

await mkdir(out, { recursive: true });
const file = resolve(out, FILE);
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'chrome', headless: true });
try {
	const page = await browser.newPage();
	await page.setContent(html, { waitUntil: 'load' });
	await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
	await page.pdf({
		path: file,
		format: 'A4',
		printBackground: true,
		displayHeaderFooter: true,
		headerTemplate: '<span></span>',
		footerTemplate: '<div style="width:100%;font-size:9px;text-align:center;color:#555"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
		margin: { top: '18mm', bottom: '18mm', left: '15mm', right: '15mm' }
	});
} finally {
	await browser.close();
}

// проверка результата: размер, число страниц не меньше числа глав, на первой странице русский текст
const size = (await stat(file)).size;
if (size > 10 * 1024 * 1024) throw new Error(`PDF больше 10 МБ: ${(size / 1048576).toFixed(1)} МБ`);
let pages = null;
try {
	const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
	const pdf = await pdfjs.getDocument({ data: new Uint8Array(await readFile(file)), useSystemFonts: true, disableFontFace: true }).promise;
	pages = pdf.numPages;
	const first = (await (await pdf.getPage(1)).getTextContent()).items.map((i) => i.str).join(' ');
	if (!/[а-яё]/i.test(first)) throw new Error('В тексте первой страницы нет русских букв: на машине нет кириллических шрифтов');
	if (pages < docs.length) throw new Error(`Страниц (${pages}) меньше, чем глав (${docs.length})`);
} catch (e) {
	if (/русских|Страниц/.test(String(e.message))) throw e;
	console.warn('  проверка PDF через pdfjs-dist пропущена:', String(e.message).split('\n')[0]);
}
console.log(`✓ ${file} — ${docs.length} глав${pages ? `, ${pages} стр.` : ''}, ${(size / 1024).toFixed(0)} КБ`);
