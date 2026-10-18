// Индекс справки: какие главы есть, в каком порядке и кому видны. Тексты глав (`src/lib/content/help/**/*.md`) лежат отдельными
// чанками и подгружаются по требованию (`loader.ts`); в бандле страницы остаётся только этот индекс.
// Видимость строится на правах человека (`GET /api/me → scopes`), а не на названиях ролей: главу видит тот, у кого есть ЛЮБОЕ из `needs`.

export type ChapterGroup = 'start' | 'user' | 'admin' | 'reference';

export interface Chapter {
	/** адрес главы: `/help?s=<slug>` */
	slug: string;
	/** путь внутри `src/lib/content/help/` */
	file: string;
	title: string;
	group: ChapterGroup;
	/** главу видит тот, у кого есть любое из этих прав (пусто — всем) */
	needs?: string[];
	/** и чья роль входит в этот список (пусто — любая) */
	audience?: string[];
	/** названия экранов и разделов, о которых глава («Подписание»): поиск находит главу и по ним */
	keywords?: string;
}

export const GROUPS: { key: ChapterGroup; title: string }[] = [
	{ key: 'start', title: 'Начало работы' },
	{ key: 'user', title: 'Руководство пользователя' },
	{ key: 'admin', title: 'Руководство администратора' },
	{ key: 'reference', title: 'Справочник' }
];

/** Порядок в массиве — порядок в меню. */
export const CHAPTERS: Chapter[] = [
	{ slug: 'start', file: '01-start.md', title: 'Быстрый старт', group: 'start' },

	{ slug: 'deals', file: '02-deals.md', title: 'Сделки', group: 'user', needs: ['deal:read'] },
	{ slug: 'organizations', file: '03-organizations.md', title: 'Организации и контакты', group: 'user', needs: ['organization:read'] },
	{ slug: 'signing', file: '04-signing.md', title: 'Электронная подпись (ПЭП)', group: 'user', needs: ['signature:read', 'signature:sign', 'signature:create'] },
	{ slug: 'import-reports', file: '05-import-reports.md', title: 'Импорт и отчёты', group: 'user', needs: ['report:read', 'import:run'] },
	{ slug: 'audit', file: '23-audit.md', title: 'Журнал аудита', group: 'user', needs: ['audit:read'] },
	{ slug: 'admin', file: '06-admin.md', title: 'Администрирование', group: 'user', needs: ['user:read'] },
	{ slug: 'workflows', file: '07-workflows.md', title: 'Конструктор воронок', group: 'user', needs: ['workflow:write'] },
	{ slug: 'security', file: '08-security.md', title: 'Безопасность и персональные данные', group: 'user' },
	{ slug: 'tasks', file: '09-tasks.md', title: 'Задачи, уведомления, профиль', group: 'user' },
	{ slug: 'integrations', file: '10-integrations.md', title: 'Интеграции', group: 'user', needs: ['integration:admin'] },

	{ slug: 'design-system', file: '11-design-system.md', title: 'Дизайн-система rt-ui', group: 'reference' },
	{ slug: 'shortcuts', file: '12-shortcuts.md', title: 'Клавиатура, темы, телефон', group: 'reference' },
	{ slug: 'about', file: '13-about.md', title: 'О проекте', group: 'reference' }
];

export interface Viewer {
	can: (permission: string) => boolean;
	role: string | null;
}

export function isChapterVisible(chapter: Chapter, viewer: Viewer): boolean {
	if (chapter.needs?.length && !chapter.needs.some(viewer.can)) return false;
	if (chapter.audience?.length && !(viewer.role && chapter.audience.includes(viewer.role))) return false;
	return true;
}

/** Главы, которые человек видит в меню, в порядке индекса. */
export function visibleChapters(chapters: Chapter[], viewer: Viewer): Chapter[] {
	return chapters.filter((c) => isChapterVisible(c, viewer));
}

/** Главы по группам; пустые группы не возвращаются. */
export function groupChapters(chapters: Chapter[]): { key: ChapterGroup; title: string; chapters: Chapter[] }[] {
	return GROUPS.map((g) => ({ ...g, chapters: chapters.filter((c) => c.group === g.key) })).filter((g) => g.chapters.length > 0);
}
