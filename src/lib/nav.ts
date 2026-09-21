// Single source of truth for navigation: side menu (by permission), page titles, breadcrumbs.
// Permissions are the backend's (`GET /api/me → scopes`); the backend stays the authority, this only hides what a role cannot use.
import type { Component } from 'svelte';
import {
	BarChart,
	Book,
	BookOpen,
	Catalog,
	Connect,
	Contacts,
	DocumentCertificate,
	DocumentSecurity,
	Government,
	Group,
	History,
	Home,
	Mail,
	MarketingFunnel,
	Portfolio,
	SecurityCheck,
	Settings,
	Task,
	Trash,
	Upload,
	Users
} from '@lct-testkit/rt-ui/icons';

export interface NavItem {
	id: string;
	label: string;
	href: string;
	icon: Component<any>; // eslint-disable-line @typescript-eslint/no-explicit-any
	/** visible when the user has ANY of these permissions (omit = everyone signed in) */
	permission?: string | string[];
	/** extra path prefixes that keep this item highlighted */
	also?: string[];
	/** live counter shown at the end of the item */
	badge?: 'signatures';
}

export interface NavSection {
	id: string;
	title?: string;
	items: NavItem[];
}

export const NAV: NavSection[] = [
	{
		id: 'work',
		items: [
			{ id: 'home', label: 'Главная', href: '/', icon: Home, permission: ['deal:read', 'report:read'] },
			{ id: 'deals', label: 'Сделки', href: '/deals', icon: Portfolio, permission: 'deal:read' },
			{ id: 'orgs', label: 'Организации', href: '/organizations', icon: Government, permission: 'organization:read' },
			{ id: 'contacts', label: 'Контакты', href: '/contacts', icon: Contacts, permission: 'contact:read' },
			{ id: 'tasks', label: 'Задачи', href: '/tasks', icon: Task, permission: 'deal:read' },
			{ id: 'signing', label: 'Подписание', href: '/signing', icon: DocumentCertificate, permission: ['signature:sign', 'signature:create'], badge: 'signatures' },
			{ id: 'reports', label: 'Отчёты', href: '/reports', icon: BarChart, permission: 'report:read' },
			{ id: 'imports', label: 'Импорт', href: '/imports', icon: Upload, permission: 'import:run' },
			{ id: 'help', label: 'Справка', href: '/help', icon: BookOpen }
		]
	},
	{
		id: 'setup',
		title: 'Настройка',
		items: [
			{ id: 'workflows', label: 'Воронки', href: '/workflows', icon: MarketingFunnel, permission: 'workflow:write' },
			{ id: 'catalog', label: 'Справочники', href: '/catalog', icon: Catalog, permission: 'catalog:write' },
			{ id: 'integrations', label: 'Интеграции', href: '/admin/integrations', icon: Connect, permission: 'integration:admin' },
			{ id: 'registry', label: 'Реестр ЕГРЮЛ', href: '/admin/registry', icon: Book, permission: 'registry:import' },
			{ id: 'edm', label: 'Соглашения ЭДО', href: '/admin/edm', icon: DocumentSecurity, permission: ['edm:admin', 'edm:read'] },
			{ id: 'templates', label: 'Шаблоны уведомлений', href: '/admin/notification-templates', icon: Mail, permission: 'notification_template:manage' }
		]
	},
	{
		id: 'admin',
		title: 'Администрирование',
		items: [
			{ id: 'users', label: 'Пользователи', href: '/admin/users', icon: Users, permission: 'user:read' },
			{ id: 'teams', label: 'Команды', href: '/admin/teams', icon: Group, permission: 'user:read' },
			{ id: 'approvals', label: 'Согласования', href: '/admin/approvals', icon: SecurityCheck, permission: 'user:write' },
			{ id: 'erasure', label: 'Удаление ПДн', href: '/admin/erasure', icon: Trash, permission: 'erasure:manage' },
			{ id: 'audit', label: 'Журнал аудита', href: '/admin/audit', icon: History, permission: 'audit:read' },
			{ id: 'settings', label: 'Настройки', href: '/admin/settings', icon: Settings, permission: 'settings:write' }
		]
	}
];

export function isVisible(item: NavItem, can: (permission: string) => boolean): boolean {
	if (!item.permission) return true;
	const list = Array.isArray(item.permission) ? item.permission : [item.permission];
	return list.some(can);
}

export function isActive(item: NavItem, pathname: string): boolean {
	const paths = [item.href, ...(item.also ?? [])];
	return paths.some((p) => (p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`)));
}

/** Where a signed-in user lands: the first visible item (AUDITOR has no home → the audit log). */
export function landingFor(can: (permission: string) => boolean): string {
	// the auditor's whole job is the audit log
	if (can('audit:read') && !can('deal:read')) return '/admin/audit';
	// the manual is visible to everyone, so it is never a landing page
	for (const section of NAV) for (const item of section.items) if (item.id !== 'help' && isVisible(item, can)) return item.href;
	return '/profile';
}
