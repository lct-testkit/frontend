// Ленивая загрузка текстов глав: каждый `.md` — отдельный чанк, в бандле страницы его нет, пока главу не открыли или не начали искать.
import type { Chapter } from './chapters';

const files = import.meta.glob('../../content/help/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;

const PREFIX = '../../content/help/';
const cache = new Map<string, string>();

/** Текст главы (markdown с `# Названием` в первой строке); повторное открытие не ходит в сеть. Бросает, если файла нет или чанк не загрузился. */
export async function loadChapter(chapter: Pick<Chapter, 'file'>): Promise<string> {
	const hit = cache.get(chapter.file);
	if (hit !== undefined) return hit;
	const load = files[PREFIX + chapter.file];
	if (!load) throw new Error(`Нет файла главы: ${chapter.file}`);
	const text = await load();
	cache.set(chapter.file, text);
	return text;
}

/** Все тексты разом (при первом фокусе поля поиска). Главы, что не загрузились, пропускаются. */
export async function loadAll(chapters: Chapter[]): Promise<Record<string, string>> {
	const entries = await Promise.all(chapters.map(async (c) => [c.slug, await loadChapter(c).catch(() => '')] as const));
	return Object.fromEntries(entries.filter(([, text]) => text));
}
