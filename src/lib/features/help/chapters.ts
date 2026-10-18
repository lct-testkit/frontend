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

const ADMIN = ['settings:write'];

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

	{ slug: 'admin-overview', file: 'admin/01-overview.md', title: 'Обзор и требования', group: 'admin', needs: ADMIN },
	{ slug: 'admin-install', file: 'admin/02-install.md', title: 'Установка: онлайн и офлайн', group: 'admin', needs: ADMIN, keywords: 'install docker compose офлайн bundle install.sh' },
	{ slug: 'admin-profiles', file: 'admin/03-profiles.md', title: 'Профили demo и prod', group: 'admin', needs: ADMIN, keywords: 'APP_PROFILE APP_MODE' },
	{ slug: 'admin-env', file: 'admin/04-env.md', title: 'Переменные .env и секреты', group: 'admin', needs: ADMIN, keywords: 'env настройки пароли ключи' },
	{ slug: 'admin-tls', file: 'admin/05-tls.md', title: 'TLS и домен', group: 'admin', needs: ADMIN, keywords: 'https сертификат certificate acme Caddy шрифты' },
	{ slug: 'admin-keycloak', file: 'admin/06-keycloak.md', title: 'Keycloak и пользователи', group: 'admin', needs: ADMIN, keywords: 'вход первый администратор' },
	{ slug: 'admin-smtp', file: 'admin/07-smtp.md', title: 'Почта и SMTP', group: 'admin', needs: ADMIN, keywords: 'письма email' },
	{ slug: 'admin-backup', file: 'admin/08-backup.md', title: 'Резервные копии и восстановление', group: 'admin', needs: ADMIN, keywords: 'бэкап backup restore' },
	{ slug: 'admin-upgrade', file: 'admin/09-upgrade.md', title: 'Обновление и откат', group: 'admin', needs: ADMIN, keywords: 'update rollback deploy' },
	{ slug: 'admin-monitoring', file: 'admin/10-monitoring.md', title: 'Мониторинг и логи', group: 'admin', needs: ADMIN, keywords: 'Prometheus Grafana метрики журналы' },
	{ slug: 'admin-scaling', file: 'admin/11-scaling.md', title: 'Масштабирование', group: 'admin', needs: ADMIN, keywords: 'scale реплики' },
	{ slug: 'admin-ha', file: 'admin/12-ha.md', title: 'Высокая доступность на трёх узлах', group: 'admin', needs: ADMIN, keywords: 'HA Patroni etcd SeaweedFS отказоустойчивость failover' },
	{ slug: 'admin-security', file: 'admin/13-security.md', title: 'Безопасность и аудит', group: 'admin', needs: ADMIN },
	{ slug: 'admin-troubleshooting', file: 'admin/14-troubleshooting.md', title: 'Неполадки', group: 'admin', needs: ADMIN, keywords: 'ошибки проблемы troubleshooting' },
	{ slug: 'admin-checklist', file: 'admin/15-checklist.md', title: 'Чек-лист ввода в эксплуатацию', group: 'admin', needs: ADMIN },

	{ slug: 'errors', file: '15-errors.md', title: 'Коды ошибок', group: 'reference' },
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
