import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './chapters';
import { extractToc, splitTitle } from './toc';

const ROOT = resolve(process.cwd(), 'src/lib/content/help');
const read = (file: string) => readFileSync(join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

const admin = CHAPTERS.filter((c) => c.group === 'admin');
const all = CHAPTERS.map((c) => ({ c, text: read(c.file) }));

/** Скрипты и утилиты репозитория deploy, на которые можно ссылаться из руководства. */
const KNOWN_SCRIPTS = new Set([
	'backup.sh',
	'restore_test.sh',
	'deploy.sh',
	'gen_env.sh',
	'set_host.sh',
	'smoke.sh',
	'seed_demo.sh',
	'install_autodeploy.sh',
	'provision_vm.sh',
	'render_env_images.py',
	'build_offline_bundle.sh',
	'registry_load.sh',
	'bundle_install.sh'
]);

function codeBlocks(text: string): string[] {
	return [...text.matchAll(/```[\w-]*\n([\s\S]*?)```/g)].map((m) => m[1]);
}

describe('руководство администратора', () => {
	it('15 глав, нумерация подряд, все в admin/', () => {
		expect(admin.map((c) => c.file)).toEqual(Array.from({ length: 15 }, (_, i) => expect.stringMatching(new RegExp(`^admin/${String(i + 1).padStart(2, '0')}-`))));
		for (const c of admin) expect(c.file.startsWith('admin/')).toBe(true);
	});

	it('в каждой главе есть «Что понадобится», «Шаги», «Как проверить», «Если не получилось» и строка «Сверено»', () => {
		for (const c of admin) {
			const text = read(c.file);
			expect(text, c.slug).toMatch(/^## Что понадобится$/m);
			expect(text, c.slug).toMatch(/^## Шаги/m);
			expect(text, c.slug).toMatch(/^## Как проверить$/m);
			expect(text, c.slug).toMatch(/^## Если не получилось$/m);
			expect(text, c.slug).toMatch(/^Сверено с .*\d{2}\.\d{2}\.\d{4}/m);
		}
	});

	it('демонстрационных секретов в тексте нет', () => {
		const forbidden = ['change-me-in-prod', 'crm-bff-secret', 'crm-admin-secret', 'crm_secret_key', 'crm_access', 'Admin12345678', 'Kam123456789', 'Head12345678', 'Volkov12345678', 'Audit12345678'];
		for (const c of admin) {
			const text = read(c.file);
			for (const word of forbidden) expect(text.includes(word), `${c.slug}: ${word}`).toBe(false);
		}
	});

	it('в блоках кода нет паролей и токенов со значением', () => {
		for (const c of admin) {
			for (const block of codeBlocks(read(c.file))) {
				expect(block, c.slug).not.toMatch(/(PASSWORD|SECRET|TOKEN|_KEY)=(?!<)\S/);
			}
		}
	});

	it('команды scripts/<имя> ссылаются на скрипты репозитория deploy', () => {
		for (const c of admin) {
			for (const m of read(c.file).matchAll(/scripts\/([\w.-]+\.(?:sh|py))/g)) expect(KNOWN_SCRIPTS.has(m[1]), `${c.slug}: scripts/${m[1]}`).toBe(true);
		}
	});

	it('картинки в тексте существуют в static/help', () => {
		for (const { c, text } of all) {
			for (const m of text.matchAll(/!\[[^\]]*\]\((\/help\/[^)]+)\)/g)) {
				expect(existsSync(resolve(process.cwd(), 'static', m[1].slice(1))), `${c.slug}: ${m[1]}`).toBe(true);
			}
		}
	});
});

describe('ссылки между главами', () => {
	const slugs = new Map(CHAPTERS.map((c) => [c.slug, c]));
	const anchors = new Map(
		all.map(({ c, text }) => [
			c.slug,
			new Set(extractToc(splitTitle(text).body).map((i) => i.id)).add('')
		])
	);

	it('?s=<глава>#h-<якорь> ведут на существующую главу и раздел', () => {
		for (const { c, text } of all) {
			for (const m of text.matchAll(/\]\(\?s=([a-z0-9-]+)(?:#(h-[a-z0-9-]+))?\)/g)) {
				expect(slugs.has(m[1]), `${c.slug}: глава ${m[1]}`).toBe(true);
				if (m[2]) expect(anchors.get(m[1])?.has(m[2]), `${c.slug}: якорь ${m[2]} в ${m[1]}`).toBe(true);
			}
		}
	});
});
