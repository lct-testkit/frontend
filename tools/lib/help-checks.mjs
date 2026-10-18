// Чистые функции проверок справки (используют tools/check-help.mjs, tools/check-help-drift.mjs и тесты): без обращений к git, сети и диску.

const HELP_PATHS = [/^src\/lib\/content\/help\//, /^static\/help\//, /^src\/lib\/features\/help\/chapters\.ts$/, /^docs\/error-catalog\.json$/];

/** Менялись ли главы, картинки, индекс глав или каталог ошибок: тогда `HELP_REV` нужно поднять. */
export function needsRevBump(changedFiles) {
	return changedFiles.map((f) => f.replaceAll('\\', '/')).some((f) => HELP_PATHS.some((re) => re.test(f)));
}

/** Значение `HELP_REV` из исходника `help-attention.svelte.ts`. */
export function revOf(source) {
	const m = /const HELP_REV = '([^']+)'/.exec(source);
	if (!m) throw new Error('В help-attention.svelte.ts не найдена константа HELP_REV');
	return m[1];
}

/**
 * Картинки, у которых файл-источник менялся позже самой картинки.
 * manifest — [{ name, file, sources: [путь или маска] }], commitTimes — { путь картинки: секунды, 'источник': секунды }
 * (время последнего коммита, `git log -1 --format=%ct`). Пустые `sources` и неизвестное время картинку не выбирают.
 */
export function staleShots(manifest, commitTimes) {
	return manifest.filter((shot) => {
		const own = commitTimes[shot.file];
		if (!own || !shot.sources?.length) return false;
		return shot.sources.some((src) => (commitTimes[src] ?? 0) > own);
	});
}

/** Скрипты репозитория deploy (`scripts/<имя>`), упомянутые в тексте руководства. */
export function scriptsIn(markdown) {
	return [...new Set([...markdown.matchAll(/scripts\/([\w.-]+\.(?:sh|py|mjs))/g)].map((m) => m[1]))];
}

/**
 * Переменные окружения из текста: слова ЗАГЛАВНЫМИ буквами с подчёркиванием в обратных кавычках (`SMTP_HOST`).
 * Коды ошибок (`CRM-1201`), роли (`ADMIN`) и маски (`SMTP_*`) не считаются.
 */
export function envVarsIn(markdown) {
	return [...new Set([...markdown.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((m) => m[1]))];
}
