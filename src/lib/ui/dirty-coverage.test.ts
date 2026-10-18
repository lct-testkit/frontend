import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Правило «введённое не пропадает молча» (ТЗ п. 8.1, 8.2): окно с полями и страница с формой «Сохранить / Отмена» спрашивают, прежде чем закрыться.
const SRC = fileURLToPath(new URL('../../', import.meta.url)); // src (файл лежит в src/lib/ui)
const files: { path: string; text: string }[] = [];
(function walk(dir: string) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		if (statSync(full).isDirectory()) walk(full);
		else if (name.endsWith('.svelte')) files.push({ path: relative(SRC, full).replaceAll('\\', '/'), text: readFileSync(full, 'utf8') });
	}
})(join(SRC, 'lib'));

const INPUT = /<(TextField|AreaField|Pick|MultiPick|CheckField|RadioField|Toggle|DateField|NumberField|FileField|Input|TextArea|Select|Checkbox|Switch)\b/;
// окна, в которых вводить нечего или потерять нечего: причина — в значении
const NO_LOSS: Record<string, string> = {
	'lib/ui/FilterBar.svelte': 'панель фильтров на телефоне: значения сразу уходят в адрес',
	'lib/features/signing/SignLinkModal.svelte': 'поле только для копирования ссылки',
	'lib/features/identity/users/InviteLinkModal.svelte': 'поле только для копирования ссылки',
	'lib/features/identity/ProfilePanel.svelte': 'в окне только текст политики; поля страницы — см. PAGES_PENDING'
};
// страницы с формой «Сохранить / Отмена», которым защиту ещё добавляет другая ветка (профиль и настройки уведомлений — зона агента A, спринт F5):
// запись убрать, когда там появится useLeaveGuard (тест тогда сам попросит убрать)
const PAGES_PENDING: Record<string, string> = {
	'lib/features/identity/ProfilePanel.svelte': 'агент A: профиль',
	'lib/features/crm/notifications/NotificationSettingsPage.svelte': 'агент A: уведомления'
};

describe('защита от потери ввода', () => {
	it('окно AppModal/AppDrawer с полями получает dirty или объяснено в NO_LOSS', () => {
		const bad = files.filter(({ path, text }) => /<(AppModal|AppDrawer)\b/.test(text) && INPUT.test(text) && !/\bdirty=\{/.test(text) && !(path in NO_LOSS)).map((f) => f.path);
		expect(bad).toEqual([]);
	});
	it('страница с формой «Сохранить / Отмена» вызывает useLeaveGuard', () => {
		const bad = files
			.filter(({ path, text }) => /const\s+dirty\s*=\s*\$derived\(/.test(text) && !/useLeaveGuard\(/.test(text) && !/<(FormDrawer|FormModal)\b/.test(text) && !/\bdirty=\{/.test(text) && !(path in PAGES_PENDING))
			.map((f) => f.path);
		expect(bad).toEqual([]);
	});
	it('отложенные страницы всё ещё без защиты (иначе уберите запись из PAGES_PENDING)', () => {
		const done = Object.keys(PAGES_PENDING).filter((p) => /useLeaveGuard\(/.test(files.find((f) => f.path === p)?.text ?? ''));
		expect(done).toEqual([]);
	});
	it('записи NO_LOSS и PAGES_PENDING существуют', () => {
		expect([...Object.keys(NO_LOSS), ...Object.keys(PAGES_PENDING)].filter((p) => !files.some((f) => f.path === p))).toEqual([]);
	});
});
