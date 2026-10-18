// Индекс справки: какие главы есть, в каком порядке и кому видны. Тексты глав (`src/lib/content/help/**/*.md`) лежат отдельными
// чанками и подгружаются по требованию (`loader.ts`); в бандле страницы остаётся только этот индекс.
// Видимость одна для всех: справка — документация, любую главу (в том числе руководство администратора) видит человек любой роли.
// Права на ДЕЙСТВИЯ описаны в главах и от этого не меняются.

export type ChapterGroup = 'start' | 'user' | 'roles' | 'admin' | 'reference';

export interface Chapter {
	/** адрес главы: `/help?s=<slug>` */
	slug: string;
	/** путь внутри `src/lib/content/help/` */
	file: string;
	title: string;
	group: ChapterGroup;
	/** названия экранов и разделов, о которых глава («Подписание»): поиск находит главу и по ним */
	keywords?: string;
	/** глава с широкими таблицами: на всю ширину карточки, оглавление — списком в начале, а не колонкой справа */
	wide?: boolean;
}

export const GROUPS: { key: ChapterGroup; title: string }[] = [
	{ key: 'start', title: 'Начало работы' },
	{ key: 'user', title: 'Руководство пользователя' },
	{ key: 'roles', title: 'Руководство по ролям' },
	{ key: 'admin', title: 'Руководство администратора' },
	{ key: 'reference', title: 'Справочник' }
];

/** Порядок в массиве — порядок в меню. */
export const CHAPTERS: Chapter[] = [
	{ slug: 'start', file: '01-start.md', title: 'Быстрый старт', group: 'start' },

	{ slug: 'deals', file: '02-deals.md', title: 'Сделки', group: 'user' },
	{ slug: 'funnel', file: '18-funnel.md', title: 'Воронка из 14 шагов', group: 'user', wide: true },
	{ slug: 'files', file: '17-files.md', title: 'Файлы в сделке', group: 'user' },
	{ slug: 'organizations', file: '03-organizations.md', title: 'Организации и контакты', group: 'user' },
	{ slug: 'licenses', file: '14-licenses.md', title: 'Лицензии вуз — вендор — ПО', group: 'user' },
	{ slug: 'signing', file: '04-signing.md', title: 'Электронная подпись (ПЭП)', group: 'user' },
	{ slug: 'import', file: '05-import.md', title: 'Импорт', group: 'user' },
	{ slug: 'reports', file: '16-reports.md', title: 'Отчёты', group: 'user', wide: true },
	{ slug: 'audit', file: '23-audit.md', title: 'Журнал аудита', group: 'user' },
	{ slug: 'admin', file: '06-admin.md', title: 'Администрирование', group: 'user' },
	{ slug: 'workflows', file: '07-workflows.md', title: 'Конструктор воронок', group: 'user' },
	{ slug: 'security', file: '08-security.md', title: 'Безопасность и персональные данные', group: 'user' },
	{ slug: 'tasks', file: '09-tasks.md', title: 'Задачи, уведомления, профиль', group: 'user' },
	{ slug: 'integrations', file: '10-integrations.md', title: 'Интеграции', group: 'user' },

	{ slug: 'role-kam', file: '19-role-kam.md', title: 'Менеджер (КАМ)', group: 'roles' },
	{ slug: 'role-head', file: '20-role-head.md', title: 'Руководитель', group: 'roles' },
	{ slug: 'role-admin', file: '21-role-admin.md', title: 'Администратор', group: 'roles' },
	{ slug: 'role-auditor', file: '22-role-auditor.md', title: 'Аудитор', group: 'roles' },

	{ slug: 'admin-overview', file: 'admin/01-overview.md', title: 'Обзор и требования', group: 'admin' },
	{ slug: 'admin-install', file: 'admin/02-install.md', title: 'Установка: онлайн и офлайн', group: 'admin', keywords: 'install docker compose офлайн bundle install.sh' },
	{ slug: 'admin-profiles', file: 'admin/03-profiles.md', title: 'Профили demo и prod', group: 'admin', keywords: 'APP_PROFILE APP_MODE' },
	{ slug: 'admin-env', file: 'admin/04-env.md', title: 'Переменные .env и секреты', group: 'admin', keywords: 'env настройки пароли ключи' },
	{ slug: 'admin-tls', file: 'admin/05-tls.md', title: 'TLS и домен', group: 'admin', keywords: 'https сертификат certificate acme Caddy шрифты' },
	{ slug: 'admin-keycloak', file: 'admin/06-keycloak.md', title: 'Keycloak и пользователи', group: 'admin', keywords: 'вход первый администратор' },
	{ slug: 'admin-smtp', file: 'admin/07-smtp.md', title: 'Почта и SMTP', group: 'admin', keywords: 'письма email' },
	{ slug: 'admin-backup', file: 'admin/08-backup.md', title: 'Резервные копии и восстановление', group: 'admin', keywords: 'бэкап backup restore' },
	{ slug: 'admin-upgrade', file: 'admin/09-upgrade.md', title: 'Обновление и откат', group: 'admin', keywords: 'update rollback deploy' },
	{ slug: 'admin-monitoring', file: 'admin/10-monitoring.md', title: 'Мониторинг и логи', group: 'admin', keywords: 'Prometheus Grafana метрики журналы' },
	{ slug: 'admin-scaling', file: 'admin/11-scaling.md', title: 'Масштабирование', group: 'admin', keywords: 'scale реплики' },
	{ slug: 'admin-ha', file: 'admin/12-ha.md', title: 'Высокая доступность на трёх узлах', group: 'admin', keywords: 'HA Patroni etcd SeaweedFS отказоустойчивость failover' },
	{ slug: 'admin-security', file: 'admin/13-security.md', title: 'Безопасность и аудит', group: 'admin' },
	{ slug: 'admin-troubleshooting', file: 'admin/14-troubleshooting.md', title: 'Неполадки', group: 'admin', keywords: 'ошибки проблемы troubleshooting' },
	{ slug: 'admin-checklist', file: 'admin/15-checklist.md', title: 'Чек-лист ввода в эксплуатацию', group: 'admin', wide: true },

	{ slug: 'errors', file: '15-errors.md', title: 'Коды ошибок', group: 'reference' },
	{ slug: 'design-system', file: '11-design-system.md', title: 'Дизайн-система rt-ui', group: 'reference' },
	{ slug: 'shortcuts', file: '12-shortcuts.md', title: 'Клавиатура, темы, телефон', group: 'reference' },
	{ slug: 'about', file: '13-about.md', title: 'О проекте', group: 'reference' }
];

/** Главы по группам; пустые группы не возвращаются. */
export function groupChapters(chapters: Chapter[]): { key: ChapterGroup; title: string; chapters: Chapter[] }[] {
	return GROUPS.map((g) => ({ ...g, chapters: chapters.filter((c) => c.group === g.key) })).filter((g) => g.chapters.length > 0);
}
