// Чистые части сборки PDF руководств (tools/help-pdf.mjs): индекс глав, выбор глав руководства, оглавление. Без браузера и файловой системы — тестируется отдельно.

export const GUIDE_TITLES = {
	user: 'Руководство пользователя',
	admin: 'Руководство системного администратора',
	all: 'Руководства пользователя и администратора'
};

/** Записи индекса `CHAPTERS` из features/help/chapters.ts (F6-1): `{ slug, file, title, group, … }` в порядке объявления. */
export function parseChapterIndex(tsSource) {
	const out = [];
	const re = /\{\s*slug:\s*'([^']+)',\s*file:\s*'([^']+)',\s*title:\s*'((?:[^'\\]|\\.)*)',\s*group:\s*'(\w+)'/g;
	for (const m of tsSource.matchAll(re)) out.push({ slug: m[1], file: m[2], title: m[3].replace(/\\'/g, "'"), group: m[4] });
	return out;
}

/** Индекс без chapters.ts: по именам файлов каталога глав (пути вида `01-start.md`, `admin/02-install.md`). */
export function indexFromFiles(files, titleOf) {
	return [...files]
		.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
		.map((file) => {
			const admin = file.startsWith('admin/');
			const base = file.replace(/^admin\//, '').replace(/^\d+-/, '').replace(/\.md$/, '');
			return { slug: admin ? `admin-${base}` : base, file, title: titleOf(file), group: admin ? 'admin' : 'user' };
		});
}

/** Главы руководства: `admin` — группа администратора, `user` — все остальные, `all` — все. */
export function pickChapters(chapters, guide) {
	return chapters.filter((c) => guide === 'all' || (guide === 'admin') === (c.group === 'admin'));
}

export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Разделы главы (заголовки второго уровня) для оглавления. */
export function sectionsOf(markdown) {
	const out = [];
	let fence = false;
	for (const line of markdown.split('\n')) {
		if (/^\s*(```|~~~)/.test(line)) fence = !fence;
		if (fence) continue;
		const m = /^##\s+(.+?)\s*$/.exec(line);
		if (m) out.push(m[1].replace(/\s*\{#[\w-]+\}\s*$/, '').replace(/[`*_]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
	}
	return out;
}
