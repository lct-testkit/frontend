// Права на лицензии вуз–вендор–ПО: одно место для экрана, панели и вкладки карточки вуза.
// Права — бэкенда (`GET /api/me → scopes`): чтение каталога, `license:write` (КАМ — по своим вузам), `license:delete` (Руководитель, Администратор),
// `import:run` (мастер импорта) и `report:create` (выгрузка реестра отчётом). Сервер остаётся судьёй, здесь только решается, какие кнопки показать.

export interface LicenseAccess {
	read: boolean;
	create: boolean;
	edit: boolean;
	remove: boolean;
	importFile: boolean;
	exportReport: boolean;
}

export function licenseAccess(can: (permission: string) => boolean): LicenseAccess {
	return {
		read: can('catalog:read'),
		create: can('license:write'),
		edit: can('license:write'),
		remove: can('license:delete'),
		importFile: can('import:run'),
		exportReport: can('report:create')
	};
}
