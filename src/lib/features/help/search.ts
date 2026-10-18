// Поиск по справке: чистые функции. Все слова запроса должны встретиться в главе (И); слово в названии главы весит ×10,
// в заголовке раздела ×5, в тексте ×1. Результат — глава, якорь лучшего раздела и фрагмент с подсветкой (текст экранирован до `<mark>`).
import type { Chapter } from './chapters';
import { HeadingIds } from '$lib/utils/headings';
import { splitTitle } from './toc';

export interface SearchResult {
	slug: string;
	title: string;
	/** `h-…` лучшего раздела или `null` — начало главы */
	anchor: string | null;
	/** безопасный HTML: текст экранирован, найденные слова в `<mark>` */
	snippet: string;
	score: number;
}

const WEIGHT_TITLE = 10;
const WEIGHT_HEADING = 5;
const SNIPPET_RADIUS = 60;

/** Нижний регистр, `ё` → `е` (длина строки не меняется — по ней режем фрагмент). */
export const fold = (s: string): string => s.toLowerCase().replace(/ё/g, 'е');

/** Слова запроса: `1201`, `crm 1201`, `CRM-1201` → `crm-1201`; знаки препинания отбрасываются. */
export function queryWords(query: string): string[] {
	const folded = fold(query).replace(/crm[\s-]*(\d{4})/g, 'crm-$1');
	return folded
		.split(/[^a-zа-я0-9-]+/)
		.map((w) => w.replace(/^-+|-+$/g, ''))
		.filter(Boolean);
}

/** Грубое «основа слова»: убирает до двух гласных или мягких окончаний, чтобы «пароль» находил «пароля», а «сделка» — «сделки». Коды и цифры не трогает. */
export function stem(word: string): string {
	if (!/^[а-я]{5,}$/.test(word)) return word;
	let out = word;
	for (let i = 0; i < 2 && out.length > 4 && /[аяоеиыуюьйэ]$/.test(out); i++) out = out.slice(0, -1);
	return out;
}

export interface Section {
	/** заголовок раздела (`null` — вступление до первого заголовка) */
	heading: string | null;
	anchor: string | null;
	body: string;
}

/** Текст markdown без разметки: ссылки, картинки, код, таблицы — в обычные слова. */
export function plain(md: string): string {
	return md
		.replace(/```[\w-]*\n([\s\S]*?)```/g, ' $1 ')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/^\s*>+\s?/gm, '')
		.replace(/[`*_|#]/g, ' ')
		.replace(/^\s*[-+]\s+/gm, '')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Делит главу на разделы по заголовкам; якоря — те же, что у рендера (общий счётчик `HeadingIds`). */
export function sectionsOf(markdown: string): { title: string | null; sections: Section[] } {
	const { title, body } = splitTitle(markdown);
	const ids = new HeadingIds();
	const sections: Section[] = [{ heading: null, anchor: null, body: '' }];
	let fenced = false;
	for (const line of body.split('\n')) {
		if (/^\s*```/.test(line)) fenced = !fenced;
		const m = !fenced && /^(#{1,6})\s+(.+?)\s*$/.exec(line);
		if (m) {
			const { text, id } = ids.next(m[2]);
			sections.push({ heading: plain(text), anchor: id, body: '' });
		} else {
			sections[sections.length - 1].body += `${line}\n`;
		}
	}
	for (const s of sections) s.body = plain(s.body);
	return { title, sections: sections.filter((s) => s.heading !== null || s.body) };
}

const escapeHtml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Фрагмент ±60 символов вокруг первого найденного слова; найденные слова в `<mark>`. Экранирование — по кускам, до подсветки. */
export function makeSnippet(text: string, words: string[]): string {
	const lower = fold(text);
	let first = -1;
	for (const w of words) {
		const i = lower.indexOf(w);
		if (i !== -1 && (first === -1 || i < first)) first = i;
	}
	const centre = Math.max(first, 0);
	const from = Math.max(0, centre - SNIPPET_RADIUS);
	const to = Math.min(text.length, centre + SNIPPET_RADIUS * 2);
	const piece = text.slice(from, to);
	const low = lower.slice(from, to);
	const ranges: [number, number][] = [];
	for (const w of words) {
		for (let i = low.indexOf(w); i !== -1; i = low.indexOf(w, i + w.length)) {
			// подсвечиваем слово целиком, а не только его основу
			let end = i + w.length;
			while (end < low.length && /[a-zа-я0-9]/.test(low[end])) end++;
			ranges.push([i, end]);
		}
	}
	ranges.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [];
	for (const r of ranges) {
		const last = merged[merged.length - 1];
		if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
		else merged.push([r[0], r[1]]);
	}
	let html = '';
	let at = 0;
	for (const [a, b] of merged) {
		html += `${escapeHtml(piece.slice(at, a))}<mark>${escapeHtml(piece.slice(a, b))}</mark>`;
		at = b;
	}
	html += escapeHtml(piece.slice(at));
	return `${from > 0 ? '…' : ''}${html}${to < text.length ? '…' : ''}`;
}

/** Ищет по переданным (уже видимым) главам; `texts` — slug → markdown. Пустой запрос результатов не даёт. */
export function searchChapters(chapters: Chapter[], texts: Record<string, string>, query: string): SearchResult[] {
	const words = queryWords(query).map(stem);
	if (!words.length) return [];
	const out: SearchResult[] = [];
	for (const chapter of chapters) {
		const source = texts[chapter.slug];
		if (source === undefined) continue;
		const { sections } = sectionsOf(source);
		const title = fold(`${chapter.title} ${chapter.keywords ?? ''}`);
		const whole = fold(`${title} ${sections.map((s) => `${s.heading ?? ''} ${s.body}`).join(' ')}`);
		if (!words.every((w) => whole.includes(w))) continue;

		let score = 0;
		for (const w of words) if (title.includes(w)) score += WEIGHT_TITLE;
		let best: { section: Section; score: number } | null = null;
		for (const section of sections) {
			const head = fold(section.heading ?? '');
			const body = fold(section.body);
			let s = 0;
			for (const w of words) {
				if (head.includes(w)) s += WEIGHT_HEADING;
				if (body.includes(w)) s += 1;
			}
			if (s > 0 && (!best || s > best.score)) best = { section, score: s };
		}
		score += best?.score ?? 0;
		// все слова в названии главы — открываем её с начала; иначе — на лучшем разделе
		const titleHit = words.every((w) => title.includes(w));
		const text = best && !titleHit ? [best.section.heading, best.section.body].filter(Boolean).join('. ') : (sections.find((s) => s.body)?.body ?? chapter.title);
		out.push({ slug: chapter.slug, title: chapter.title, anchor: titleHit ? null : (best?.section.anchor ?? null), snippet: makeSnippet(text, words), score });
	}
	return out.sort((a, b) => b.score - a.score);
}
