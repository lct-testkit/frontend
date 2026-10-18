import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { NAV } from '$lib/nav';
import { CHAPTERS } from './chapters';

const ROOT = resolve(process.cwd(), 'src/lib/content/help');

function mdFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? mdFiles(full) : name.endsWith('.md') ? [relative(ROOT, full).replaceAll('\\', '/')] : [];
	});
}

// права бэкенда (`app/core/permissions.py`, `Permission`): индекс справки не должен ссылаться на несуществующее право
const BACKEND_PERMISSIONS = new Set(
	[
		'deal:read deal:create deal:update deal:transition deal:reassign deal:reassign_bulk organization:read organization:write organization:reveal organization:restore',
		'organization:assign_owner organization:delete deal:delete contact:read contact:write contact:reveal catalog:read catalog:write license:write license:delete workflow:read',
		'workflow:write workflow:publish workflow:rename_status file:upload file:download file:delete import:run import:rollback report:read report:create org_lookup:use registry:import',
		'integration:ingest integration:admin signature:create signature:read signature:sign signature:void comment:audit_read edm:admin edm:read notification_template:manage',
		'user:read user:write audit:read audit:export settings:write erasure:manage security_event:read access_scope:manage incident:manage incident:read'
	]
		.join(' ')
		.split(/\s+/)
);
const NAV_PERMISSIONS = new Set(NAV.flatMap((s) => s.items.flatMap((i) => (i.permission ? [i.permission].flat() : []))));

describe('индекс справки', () => {
	it('каждый .md есть в индексе и наоборот', () => {
		expect(CHAPTERS.map((c) => c.file).sort()).toEqual(mdFiles(ROOT).sort());
	});

	it('slug и файлы не повторяются', () => {
		expect(new Set(CHAPTERS.map((c) => c.slug)).size).toBe(CHAPTERS.length);
		expect(new Set(CHAPTERS.map((c) => c.file)).size).toBe(CHAPTERS.length);
	});

	it('у каждой главы первая строка — заголовок первого уровня', () => {
		for (const c of CHAPTERS) {
			const first = readFileSync(join(ROOT, c.file), 'utf8').split('\n')[0];
			expect(first, c.file).toMatch(/^# \S/);
		}
	});

	it('главы руководства администратора лежат в admin/ и требуют settings:write', () => {
		for (const c of CHAPTERS) {
			expect(c.file.startsWith('admin/'), c.slug).toBe(c.group === 'admin');
			if (c.group === 'admin') expect(c.needs, c.slug).toEqual(['settings:write']);
		}
	});

	it('needs содержит только известные права', () => {
		for (const c of CHAPTERS) {
			for (const p of c.needs ?? []) expect(BACKEND_PERMISSIONS.has(p) || NAV_PERMISSIONS.has(p), `${c.slug}: ${p}`).toBe(true);
		}
	});
});
