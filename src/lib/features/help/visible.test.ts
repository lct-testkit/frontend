import { describe, expect, it } from 'vitest';
import { CHAPTERS, groupChapters, isChapterVisible, visibleChapters, type Chapter } from './chapters';

// права ролей по `ROLE_PERMISSIONS` бэкенда — только те, что нужны индексу справки
const ROLE_RIGHTS: Record<string, string[]> = {
	KAM: ['deal:read', 'deal:transition', 'catalog:read', 'report:read'],
	HEAD: ['deal:read', 'deal:transition', 'deal:reassign', 'catalog:read', 'report:read', 'audit:read', 'import:run', 'workflow:rename_status'],
	AUDITOR: ['audit:read', 'audit:export', 'edm:read', 'signature:read'],
	ADMIN: [...CHAPTERS.flatMap((c) => c.needs ?? []), 'user:read', 'user:write', 'workflow:write', 'integration:admin', 'settings:write']
};
const viewer = (role: string) => ({ can: (p: string) => ROLE_RIGHTS[role].includes(p), role });
const slugs = (role: string) => visibleChapters(CHAPTERS, viewer(role)).map((c) => c.slug);

describe('видимость глав', () => {
	it('КАМ не видит глав администратора, интеграций и конструктора воронок', () => {
		const s = slugs('KAM');
		expect(s).toContain('deals');
		expect(s).not.toContain('integrations');
		expect(s).not.toContain('workflows');
		expect(s.some((x) => x.startsWith('admin-'))).toBe(false);
	});

	it('руководитель не видит руководство администратора, но видит журнал аудита', () => {
		expect(slugs('HEAD').some((x) => x.startsWith('admin-'))).toBe(false);
		expect(slugs('HEAD')).toContain('audit');
	});

	it('аудитор не видит сделок и организаций, но видит журнал аудита и справочник ошибок', () => {
		const s = slugs('AUDITOR');
		expect(s).not.toContain('deals');
		expect(s).not.toContain('funnel');
		expect(s).not.toContain('files');
		expect(s).toContain('audit');
		expect(s).toContain('errors');
	});

	it('администратор видит всё', () => {
		expect(slugs('ADMIN')).toEqual(CHAPTERS.map((c) => c.slug));
	});

	it('ролевые главы: КАМ — своя, руководитель — КАМ, своя и аудитора, аудитор — своя, администратор — все четыре', () => {
		const roleChapters = (role: string) => slugs(role).filter((x) => x.startsWith('role-'));
		expect(roleChapters('KAM')).toEqual(['role-kam']);
		expect(roleChapters('HEAD')).toEqual(['role-kam', 'role-head', 'role-auditor']);
		expect(roleChapters('AUDITOR')).toEqual(['role-auditor']);
		expect(roleChapters('ADMIN')).toEqual(['role-kam', 'role-head', 'role-admin', 'role-auditor']);
	});

	it('роль из audience сужает видимость', () => {
		const only: Chapter = { slug: 'x', file: 'x.md', title: 'X', group: 'user', audience: ['HEAD'] };
		expect(isChapterVisible(only, viewer('HEAD'))).toBe(true);
		expect(isChapterVisible(only, viewer('KAM'))).toBe(false);
	});

	it('пустые группы в меню не показываются', () => {
		const groups = groupChapters(visibleChapters(CHAPTERS, viewer('KAM')));
		expect(groups.map((g) => g.key)).not.toContain('admin');
		expect(groups.every((g) => g.chapters.length > 0)).toBe(true);
	});
});
