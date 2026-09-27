// Лицензии/договоры вуз-вендор-ПО (карточка организации, вкладка «Лицензии»): чистое форматирование —
// список только читается (нет create/edit ручек, см. catalog.router), поэтому здесь нет форм и тел запросов.
import { count } from '$lib/utils/format';
import { TRANSFER_STATUS_LABELS } from '../shared/labels';
import type { OrganizationLicense } from '../types';

/** «Срок действия лицензии (год)» из исходного xls — количество лет, не календарный год. `null` — срок не указан. */
export function licenseTermLabel(years: OrganizationLicense['license_valid_year']): string {
	if (years === null || years === undefined) return '—';
	return count(years, ['год', 'года', 'лет']);
}

/** Подпись статуса передачи; неизвестное или пустое значение — как в остальных перечислениях бэкенда. */
export function transferStatusLabel(status: OrganizationLicense['transfer_status']): string {
	if (!status) return '—';
	return TRANSFER_STATUS_LABELS[status] ?? status;
}
