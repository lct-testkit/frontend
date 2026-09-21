// Убирает следы сценариев: тестовые комментарии/файлы в демо-сделках, переименовывает E2E-сделки в осмысленные названия.
import { BASE, accessToken } from '../lib.mjs';
const H = async (who) => ({ Authorization: `Bearer ${await accessToken(who)}`, 'Content-Type': 'application/json' });
const kam = await H('kam');
const get = async (h, p) => (await fetch(`${BASE}${p}`, { headers: h })).json();

const d = (await get(kam, '/api/deals?q=D-2026-000002&limit=1')).items[0];
const comments = (await get(kam, `/api/deals/${d.id}/comments`)).items;
let removed = 0;
for (const c of comments.filter((c) => /Корневой комментарий|Ответ в треде|Отладка отправки|Удалить меня/.test(c.body))) {
	const r = await fetch(`${BASE}/api/comments/${c.id}`, { method: 'DELETE', headers: kam, body: JSON.stringify({ reason: 'cleanup' }) });
	if (r.ok) removed += 1;
}
console.log('удалено комментариев:', removed);

const NAMES = ['Курс «Введение в DevOps» для колледжа', 'Программа «Основы кибербезопасности» для школьников', 'Обучение сотрудников вуза работе с аналитикой', 'Летняя школа по искусственному интеллекту', 'Стажировка для преподавателей в ИТ-компании'];
const all = (await get(kam, '/api/deals?q=%D0%A1%D1%86%D0%B5%D0%BD%D0%B0%D1%80%D0%B8%D0%B9&limit=50')).items.concat((await get(kam, '/api/deals?q=E2E&limit=50')).items);
let renamed = 0;
for (const deal of all) {
	const title = NAMES[renamed % NAMES.length];
	const r = await fetch(`${BASE}/api/deals/${deal.id}`, { method: 'PATCH', headers: { ...kam, 'If-Match': `"${deal.version}"` }, body: JSON.stringify({ title }) });
	if (r.ok) renamed += 1;
}
console.log('переименовано сделок:', renamed);
