// Заготовка таблицы главы «Воронка из 14 шагов» (src/lib/content/help/18-funnel.md) по опубликованной воронке живого стенда:
//   APP_URL=http://localhost:5275 node tools/gen-funnel-table.mjs [код воронки, по умолчанию b2b_university_v2]
// Печатает строки markdown: номер, название статуса, код, срок SLA в днях, условия и действия исходящих переходов вперёд.
// Формулировки «чтобы перейти дальше» правит человек; срок на стенде мог быть изменён вручную (проверьте по сиду бэкенда).
import { accessToken } from './lib.mjs';

const code = process.argv[2] ?? 'b2b_university_v2';
const token = await accessToken('admin');
const headers = { Authorization: `Bearer ${token.access_token ?? token}` };
const base = process.env.API_URL ?? 'http://localhost:8080';
const get = async (path) => (await fetch(base + path, { headers })).json();

const list = await get('/api/workflows?limit=100');
const wf = (list.items ?? list).find((w) => w.code === code);
if (!wf) {
	console.error(`воронка ${code} не найдена`);
	process.exit(1);
}
const graph = await get(`/api/workflows/${wf.id}`);
const byId = new Map(graph.statuses.map((s) => [s.id, s]));
const sla = new Map(graph.sla_rules.map((r) => [r.status_id, r]));
const steps = graph.statuses.filter((s) => s.type === 'initial' || s.type === 'intermediate').sort((a, b) => a.sort_order - b.sort_order);

const leaf = (c) => (c.all || c.any ? [...(c.all ?? []), ...(c.any ?? [])].flatMap(leaf) : [`${c.field} ${c.op}${c.value !== undefined ? ` ${JSON.stringify(c.value)}` : ''}`]);

steps.forEach((s, i) => {
	const next = graph.transitions.filter((t) => t.from_status_id === s.id && byId.get(t.to_status_id)?.sort_order > s.sort_order && byId.get(t.to_status_id)?.sort_order < 1000);
	const hours = sla.get(s.id)?.max_duration_hours;
	const conditions = next.flatMap((t) => (t.conditions && Object.keys(t.conditions).length ? leaf(t.conditions) : [])).join('; ') || '—';
	const actions = next.flatMap((t) => (t.actions ?? []).map((a) => a.type + (a.title ? `: ${a.title}` : a.event_code ? `: ${a.event_code}` : ''))).join('; ') || '—';
	console.log(`| ${i + 1} | ${s.name} | ${s.code} | ${hours != null ? +(hours / 24).toFixed(2) : '—'} | ${conditions} | ${actions} |`);
});
