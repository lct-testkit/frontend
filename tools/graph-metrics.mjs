// Читаемость графа воронки в числах: рёбер, пересечений линий и рёбер сквозь чужие узлы по слоям (основной путь, пропуски, возвраты, отказ, возобновление).
//   node tools/graph-metrics.mjs [id воронки]       (по умолчанию — воронка B2B по умолчанию; граф берётся из GET /api/workflows/{id})
// Линии — прямые от центра узла к центру (приближение: на холсте это кривые Безье, на глаз проверять всё равно нужно). Положения — автораскладка `layoutByLevels`.
// Импортирует graph.ts напрямую: в нём только типовые импорты, Node запускает его без сборки.
import { BASE, accessToken, findB2bWorkflow } from './lib.mjs';
import { EDGE_LAYERS, defaultLayers, edgeLayerOf, fromServer, layoutByLevels } from '../src/lib/features/config/workflows/graph.ts';

const NODE = { w: 288, h: 64 }; // узел холста: w-72, высота по содержимому

const token = await accessToken('admin');
const api = async (path) => (await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } })).json();
const id = process.argv[2] ?? (await findB2bWorkflow(api))?.id;
if (!id) throw new Error('воронка не найдена');
const graph = await api(`/api/workflows/${id}`);
const draft = fromServer(graph);
const pos = layoutByLevels(draft);
const center = (key) => ({ x: pos[key].x + NODE.w / 2, y: pos[key].y + NODE.h / 2 });
const layerOf = edgeLayerOf(draft);
const live = new Set(draft.statuses.filter((s) => !s.is_archived).map((s) => s.key));
const edges = draft.transitions.filter((t) => live.has(t.from) && live.has(t.to)).map((t) => ({ t, a: center(t.from), b: center(t.to), layer: layerOf(t) }));

const orient = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
const cross = (e, f) => {
	if (e.t.from === f.t.from || e.t.from === f.t.to || e.t.to === f.t.from || e.t.to === f.t.to) return false; // общий конец — не пересечение
	return orient(e.a, e.b, f.a) !== orient(e.a, e.b, f.b) && orient(f.a, f.b, e.a) !== orient(f.a, f.b, e.b);
};
// отрезок пересекает прямоугольник узла: ищем по точкам вдоль отрезка (достаточно для оценки)
const through = (e) => {
	let n = 0;
	for (const s of draft.statuses) {
		if (!live.has(s.key) || s.key === e.t.from || s.key === e.t.to) continue;
		const r = { x0: pos[s.key].x, y0: pos[s.key].y, x1: pos[s.key].x + NODE.w, y1: pos[s.key].y + NODE.h };
		for (let i = 1; i < 60; i += 1) {
			const x = e.a.x + ((e.b.x - e.a.x) * i) / 60;
			const y = e.a.y + ((e.b.y - e.a.y) * i) / 60;
			if (x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1) {
				n += 1;
				break;
			}
		}
	}
	return n > 0;
};
const measure = (list) => ({ edges: list.length, crossings: list.reduce((n, e, i) => n + list.slice(i + 1).filter((f) => cross(e, f)).length, 0), throughNodes: list.filter(through).length });

console.log(`Воронка ${graph.workflow.name}: ${live.size} статусов, ${edges.length} переходов`);
console.log('слой'.padEnd(10), 'рёбер'.padStart(6), 'пересечений'.padStart(12), 'сквозь узлы'.padStart(12));
for (const layer of EDGE_LAYERS) {
	const m = measure(edges.filter((e) => e.layer === layer));
	console.log(layer.padEnd(10), String(m.edges).padStart(6), String(m.crossings).padStart(12), String(m.throughNodes).padStart(12));
}
const shown = defaultLayers(edges.length);
const def = measure(edges.filter((e) => shown.has(e.layer)));
console.log(`по умолчанию (${[...shown].join('+')})`.padEnd(10), String(def.edges).padStart(6), String(def.crossings).padStart(12), String(def.throughNodes).padStart(12));
const all = measure(edges);
console.log('все'.padEnd(10), String(all.edges).padStart(6), String(all.crossings).padStart(12), String(all.throughNodes).padStart(12));
