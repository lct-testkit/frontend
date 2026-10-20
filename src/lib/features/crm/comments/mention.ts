// «@» в тексте комментария: набранное в конце текста `@Пет` — запрос выбора коллеги; выбранный заменяет его на `@Имя `.

/** `@` в начале текста или после пробела, за ним — недописанное имя (без пробелов) до конца текста */
const TRAILING = /(^|\s)@([^\s@]*)$/;

/** Что набрано после «@» в конце текста; `null` — «@» не набирают (его нет, он внутри слова — `a@b`, или после него уже пробел). */
export function mentionQuery(text: string): string | null {
	const m = TRAILING.exec(text);
	return m ? m[2]! : null;
}

/** Текст с выбранным коллегой: набранное `@Пет` заменяется на `@Имя `, а без набранного «@» имя дописывается в конец. */
export function insertMention(text: string, name: string): string {
	const m = TRAILING.exec(text);
	if (m) return `${text.slice(0, m.index)}${m[1]}@${name} `;
	return `${text}${text && !/\s$/.test(text) ? ' ' : ''}@${name} `;
}

/** Упоминания, которые остались в тексте: «@Имя» могли стереть уже после выбора — такой человек уведомления не получит. */
export function mentionsInText(text: string, ids: string[], nameOf: (id: string) => string): string[] {
	return [...new Set(ids)].filter((id) => text.includes(`@${nameOf(id)}`));
}
