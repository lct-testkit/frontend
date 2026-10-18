import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { envVarsIn, needsRevBump, revOf, scriptsIn, staleShots } from '../../../../tools/lib/help-checks.mjs';

describe('needsRevBump', () => {
	it('главы, картинки, индекс и каталог ошибок требуют поднять HELP_REV', () => {
		expect(needsRevBump(['src/lib/content/help/06-admin.md'])).toBe(true);
		expect(needsRevBump(['src/lib/content/help/admin/08-backup.md'])).toBe(true);
		expect(needsRevBump(['static/help/teams.png'])).toBe(true);
		expect(needsRevBump(['src/lib/features/help/chapters.ts'])).toBe(true);
		expect(needsRevBump(['docs/error-catalog.json'])).toBe(true);
	});
	it('остальные файлы — нет', () => {
		expect(needsRevBump(['src/lib/ui/Btn.svelte', 'src/lib/features/help/search.ts'])).toBe(false);
		expect(needsRevBump([])).toBe(false);
	});
	it('пути с обратной косой чертой (Windows) читаются так же', () => {
		expect(needsRevBump(['src\\lib\\content\\help\\01-start.md'])).toBe(true);
	});
});

describe('revOf', () => {
	it('достаёт дату из исходника help-attention.svelte.ts', () => {
		const source = readFileSync(resolve(process.cwd(), 'src/lib/stores/help-attention.svelte.ts'), 'utf8');
		expect(revOf(source)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
	it('без константы бросает понятную ошибку', () => {
		expect(() => revOf('const x = 1')).toThrow(/HELP_REV/);
	});
});

describe('staleShots', () => {
	const manifest = [
		{ name: 'a', file: 'static/help/a.png', sources: ['src/a/'] },
		{ name: 'b', file: 'static/help/b.png', sources: ['src/b/'] },
		{ name: 'c', file: 'static/help/c.png', sources: [] }
	];
	it('источник новее картинки — запись возвращается, старше — нет, пустые sources — нет', () => {
		const times = { 'static/help/a.png': 100, 'src/a/': 200, 'static/help/b.png': 300, 'src/b/': 250, 'static/help/c.png': 100 };
		expect(staleShots(manifest, times).map((s) => s.name)).toEqual(['a']);
	});
	it('неизвестное время картинки не даёт ложного срабатывания', () => {
		expect(staleShots(manifest, { 'src/a/': 200 })).toEqual([]);
	});
});

describe('scriptsIn и envVarsIn', () => {
	const text = ['Запустите `bash scripts/backup.sh --out x` и scripts/restore_test.sh.', '', '```bash', 'bash scripts/deploy.sh rollback', '```', '', 'Задайте `AUDIT_HMAC_KEY`, `SMTP_*` и `CRM-1201`; роль `ADMIN` — не переменная.'].join('\n');
	it('находит скрипты в блоке кода и в тексте, без повторов', () => {
		expect(scriptsIn(text).sort()).toEqual(['backup.sh', 'deploy.sh', 'restore_test.sh']);
		expect(scriptsIn('scripts/deploy.sh и снова scripts/deploy.sh')).toEqual(['deploy.sh']);
	});
	it('находит переменные в обратных кавычках и не берёт слова из обычного текста, роли, коды и маски', () => {
		expect(envVarsIn(text)).toEqual(['AUDIT_HMAC_KEY']);
		expect(envVarsIn('Обычное слово SMTP_HOST без кавычек')).toEqual([]);
	});
});
