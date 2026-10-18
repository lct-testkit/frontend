// Откуда печатная версия берёт главы: индекс и тексты. Пока это каталог `src/lib/content/help/**` (группа и права — по имени файла),
// когда индекс справки `features/help/chapters.ts` (F6-1) попадёт в ветку, тело `printChapters`/`loadPrintText` заменяется на `CHAPTERS`/`loadChapter` оттуда.
import { ADMIN_GROUP } from './print';

export interface PrintChapter {
	slug: string;
	file: string;
	group: string;
	/** главу видит тот, у кого есть любое из этих прав (пусто — всем) */
	needs?: string[];
}

const files = import.meta.glob('../../content/help/**/*.md', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>;
const PREFIX = '../../content/help/';

const REFERENCE = new Set(['shortcuts', 'errors', 'design-system', 'about']);
const NEEDS: Record<string, string[]> = { admin: ['user:read'], workflows: ['workflow:write'] };

/** Главы по порядку имён файлов; группа и права — по имени (индекс F6-1 задаёт их явно). */
export function printChapters(): PrintChapter[] {
	return Object.keys(files)
		.map((path) => path.slice(PREFIX.length))
		.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
		.map((file) => {
			const inAdmin = file.startsWith('admin/');
			const base = file.replace(/^admin\//, '').replace(/^\d+-/, '').replace(/\.md$/, '');
			const slug = inAdmin ? `admin-${base}` : base;
			const group = inAdmin ? ADMIN_GROUP : base === 'start' ? 'start' : base.startsWith('role-') ? 'roles' : REFERENCE.has(base) ? 'reference' : 'user';
			return { slug, file, group, needs: inAdmin ? ['settings:write'] : NEEDS[base] };
		});
}

export async function loadPrintText(chapter: Pick<PrintChapter, 'file'>): Promise<string> {
	const load = files[PREFIX + chapter.file];
	if (!load) throw new Error(`Нет файла главы: ${chapter.file}`);
	return load();
}
