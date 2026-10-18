// Идентификаторы заголовков для якорей справки: чистые функции, без DOM и без marked (их используют и рендер, и оглавление, и поиск).

const TRANSLIT: Record<string, string> = {
	а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
	с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya'
};

/** Префикс нужен, потому что DOMPurify вырезает `id`, совпадающие со свойствами `document` (`title`, `forms`…). */
const HEADING_PREFIX = 'h-';

/** `Резервное копирование` → `h-rezervnoe-kopirovanie`. */
export function slugify(text: string): string {
	const base = text
		.normalize('NFKC')
		.toLowerCase()
		.replace(/ё/g, 'е')
		.replace(/[а-я]/g, (ch) => TRANSLIT[ch] ?? '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return `${HEADING_PREFIX}${base || 'razdel'}`;
}

const EXPLICIT = /\s*\{#([a-z0-9][a-z0-9-]*)\}\s*$/i;

/** Заголовок с явным якорем: `CRM-1201 Условия {#crm-1201}` → текст без хвоста и якорь `h-crm-1201`. */
function splitExplicitId(text: string): { text: string; id: string | null } {
	const m = EXPLICIT.exec(text);
	if (!m) return { text, id: null };
	return { text: text.slice(0, m.index), id: `${HEADING_PREFIX}${m[1].toLowerCase()}` };
}

/** Раздаёт идентификаторы по порядку заголовков одного текста: повтор получает суффикс `-2`, `-3`. Явный якорь побеждает. */
export class HeadingIds {
	#seen = new Map<string, number>();

	next(rawText: string): { text: string; id: string } {
		const { text, id: explicit } = splitExplicitId(rawText);
		const base = explicit ?? slugify(text);
		const n = (this.#seen.get(base) ?? 0) + 1;
		this.#seen.set(base, n);
		return { text, id: n === 1 ? base : `${base}-${n}` };
	}
}

/** Ссылка внутри справки или на якорь страницы: открывается в этой же вкладке. */
export function isInternalHref(href: string | null | undefined): boolean {
	if (!href) return false;
	return href.startsWith('?s=') || href.startsWith('?q=') || href === '/help' || href.startsWith('/help?') || href.startsWith('/help#') || href.startsWith('#');
}
