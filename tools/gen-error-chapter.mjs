// Глава справки «Коды ошибок» из docs/error-catalog.json:
//   node tools/gen-error-chapter.mjs          перезаписать src/lib/content/help/15-errors.md
//   node tools/gen-error-chapter.mjs --check  упасть (код 1), если каталог и глава разошлись
// Глава — производное: правьте каталог, а не её текст.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(root, 'docs/error-catalog.json');
const chapterPath = resolve(root, 'src/lib/content/help/15-errors.md');

export function buildChapter(catalog) {
	const byArea = new Map(catalog.areas.map((a) => [a.key, []]));
	for (const c of catalog.codes) {
		if (!byArea.has(c.area)) throw new Error(`${c.code}: неизвестная область «${c.area}»`);
		byArea.get(c.area).push(c);
	}
	const out = [];
	out.push('# Коды ошибок', '');
	out.push(
		'Когда что-то идёт не так, система показывает уведомление или экран ошибки с понятным текстом и кодом вида `CRM-1201`. Код нужен, чтобы быстро найти объяснение в этой главе или назвать проблему администратору и в поддержку.',
		''
	);
	out.push('## Как читать код', '');
	out.push(
		'Код состоит из префикса `CRM` и четырёх цифр `XXYY`: первые две (`XX`) обозначают область, последние две (`YY`) — номер ошибки внутри неё. Область перечислена в таблице ниже: по ней видно, где искать причину.',
		''
	);
	out.push(
		'В уведомлении об ошибке код стоит в подзаголовке («Код ошибки: CRM-1201»), рядом есть кнопка «Что это значит», которая открывает запись об этом коде. На экране ошибки, который заменяет раздел целиком, то же самое: строка с кодом и ссылка «Что это значит». Ошибки заполнения полей формы показываются под самим полем без кода: подсказка под полем и есть объяснение.',
		''
	);
	out.push('Если запись не найдена или недоступна, экран ошибки называет её по-человечески («Сделка не найдена. Возможно, запись удалена, ссылка устарела или у вас нет к ней доступа»), а не показывает идентификатор; для ссылки с неверным идентификатором заголовок «Не удалось открыть». Под текстом кнопка возврата к списку раздела: «К списку сделок», «К списку организаций», «К списку лицензий» и так далее, а если раздел не определён, «На главную».', '');
	out.push('**Код обращения.** Если сбой произошёл на стороне сервера (код `CRM-9000` и другие ответы 5xx), в окне есть ещё «Код обращения»: длинный идентификатор запроса. Сообщите его администратору: в журнале аудита по нему находится запись (поле «ID запроса»), а в журналах сервера — подробности сбоя.', '');
	out.push('**Кто исправляет.** У каждой записи указано, кто должен действовать: вы сами или администратор.', '');
	out.push('## Области кодов', '');
	out.push('| Префикс | Область | Коды |', '| --- | --- | --- |');
	for (const a of catalog.areas) {
		const list = byArea.get(a.key);
		const first = list[0].code.replace('CRM-', '');
		const last = list[list.length - 1].code.replace('CRM-', '');
		out.push(`| ${a.prefix} | ${a.title} | ${list.length === 1 ? `CRM-${first}` : list.length < 4 || a.prefix.includes(',') ? list.map((c) => c.code).join(', ') : `CRM-${first} … CRM-${last}`} |`);
	}
	out.push('');
	for (const a of catalog.areas) {
		out.push(`## ${a.title}`, '');
		for (const c of byArea.get(a.key)) {
			out.push(`### ${c.code} ${c.title} {#${c.code.toLowerCase()}}`, '');
			out.push(`HTTP ${c.status}.${c.reserved ? ' **Зарезервирован.**' : ''} **Что случилось.** ${c.meaning} **Что делать.** ${c.action} *Кто исправляет: ${c.who === 'admin' ? 'администратор' : 'вы'}.*`, '');
		}
	}
	return `${out.join('\n').trimEnd()}\n`;
}

const normalize = (s) => s.replace(/\r\n/g, '\n');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
	const text = buildChapter(catalog);
	if (process.argv.includes('--check')) {
		let current = '';
		try {
			current = normalize(readFileSync(chapterPath, 'utf8'));
		} catch {
			// нет файла — то же расхождение
		}
		if (current !== text) {
			console.error('src/lib/content/help/15-errors.md не совпадает с docs/error-catalog.json: выполните `node tools/gen-error-chapter.mjs`');
			process.exit(1);
		}
		console.log(`глава «Коды ошибок» совпадает с каталогом (${catalog.codes.length} кодов)`);
	} else {
		writeFileSync(chapterPath, text);
		console.log(`записано ${chapterPath}: ${catalog.codes.length} кодов`);
	}
}
