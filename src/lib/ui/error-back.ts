// Куда вести с экрана ошибки «не найдено / нет доступа / неверная ссылка»: к списку раздела, в котором человек был. Боковое меню остаётся, но кнопка рядом с ошибкой — быстрее.
const SECTIONS: { prefix: string; label: string; href: string }[] = [
	{ prefix: '/deals/', label: 'К списку сделок', href: '/deals' },
	{ prefix: '/organizations/', label: 'К списку организаций', href: '/organizations' },
	{ prefix: '/contacts/', label: 'К списку контактов', href: '/contacts' },
	{ prefix: '/licenses/', label: 'К списку лицензий', href: '/licenses' },
	{ prefix: '/workflows/', label: 'К списку воронок', href: '/workflows' },
	{ prefix: '/admin/users/', label: 'К списку пользователей', href: '/admin/users' },
	{ prefix: '/signing/', label: 'К подписанию', href: '/signing' },
	{ prefix: '/imports/', label: 'К списку импортов', href: '/imports' },
	{ prefix: '/reports/dashboards/', label: 'К дашбордам', href: '/reports/dashboards' }
];

export function errorBackLink(pathname: string): { label: string; href: string } {
	const hit = SECTIONS.filter((s) => pathname.startsWith(s.prefix) && pathname.length > s.prefix.length).sort((a, b) => b.prefix.length - a.prefix.length)[0];
	return hit ? { label: hit.label, href: hit.href } : { label: 'На главную', href: '/' };
}
