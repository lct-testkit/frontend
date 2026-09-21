// Печатает путь карточки по поисковой строке: node tools/scenarios/a-id.mjs kam deal D-2026-000001 → /deals/<uuid>
import { BASE, accessToken } from '../lib.mjs';
const [who, kind, q] = process.argv.slice(2);
const token = await accessToken(who);
const path = { deal: '/api/deals', org: '/api/organizations', contact: '/api/contacts' }[kind];
const res = await fetch(`${BASE}${path}?q=${encodeURIComponent(q)}&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
const json = await res.json();
const item = json.items?.[0];
if (!item) throw new Error(`not found: ${kind} ${q} (${res.status})`);
console.log(`/${{ deal: 'deals', org: 'organizations', contact: 'contacts' }[kind]}/${item.id}`);
