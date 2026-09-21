// Шесть справочников: ключ вкладки, подпись, маршрут.
export const CATALOG_TABS = [
	{ key: 'products', label: 'Продукты', href: '/catalog/products' },
	{ key: 'directions', label: 'Направления', href: '/catalog/directions' },
	{ key: 'loss-reasons', label: 'Причины отказа', href: '/catalog/loss-reasons' },
	{ key: 'holidays', label: 'Календарь', href: '/catalog/holidays' },
	{ key: 'custom-fields', label: 'Поля', href: '/catalog/custom-fields' },
	{ key: 'regions', label: 'Регионы', href: '/catalog/regions' }
] as const;

export type CatalogKey = (typeof CATALOG_TABS)[number]['key'];
