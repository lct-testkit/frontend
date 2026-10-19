// Tap-target audit for a phone: every visible interactive element whose TAPPABLE area (the box plus the invisible zone around it, measured with elementFromPoint) is smaller than 44×44 CSS px, grouped by what it is.
// «w×h→W×H» is the box and the measured tappable area.
//   node tools/taps.mjs --as kam --urls /deals,/tasks,/contacts [--size 390x844] [--min 44]
// The page is opened with the touch emulation of tools/lib.mjs (pointer: coarse), so the `pointer-coarse:` rules of the app apply, as on a real phone.
// Inline links inside a sentence are not counted (they are as big as the text); everything else that can be tapped is.
import { BASE, SIZES, newBrowser, newPage } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
	const i = args.indexOf(`--${name}`);
	return i > -1 ? args[i + 1] : fallback;
};
const who = opt('as', 'kam');
const urls = opt('urls', '/').split(',');
const [w, h] = (SIZES[opt('size', 'phone')] ?? opt('size', '390x844').split('x').map(Number));
const min = Number(opt('min', '44'));

const browser = await newBrowser();
try {
	const page = await newPage(browser, { who, width: w, height: h });
	for (const raw of urls) {
		const url = raw.replace(/^[A-Za-z]:[/]+Program Files[/]+Git/i, '');
		await page.goto(BASE + url, { waitUntil: 'load' });
		await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
		await page.waitForTimeout(600);
		if (opt('debug', '')) { await page.evaluate(() => (window.__tapsDebug = true)); page.on('console', (m) => m.text().startsWith('TAP ') && console.log(m.text())); }
		const found = await page.evaluate((min) => {
			const SEL = 'button, a[href], [role=button], [role=tab], [role=menuitem], input:not([type=hidden]):not([type=file]), select, textarea, summary, label';
			const out = new Map();
			for (const el of document.querySelectorAll(SEL)) {
				let r = el.getBoundingClientRect();
				if (r.width === 0 || r.height === 0 || el.classList.contains('sr-only')) continue;
				const cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
				// a native input hidden behind a DS box (checkbox / radio / switch): the label or the box is the target
				if (el.tagName === 'INPUT' && r.width <= 1) continue;
				// a label without a control is not tappable
				if (el.tagName === 'LABEL' && !el.querySelector('input,select,textarea') && !el.htmlFor) continue;
				// inline link in a sentence
				if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && /^(P|SPAN|LI|DD|DIV)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 2) continue;
				// a field of the DS: the input is 21 px high inside a 36–48 px box, the box is what is tapped
				const box = el.closest('.atmr-input__container, .atmr-number-stepper__inner');
				if (box && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
					const br = box.getBoundingClientRect();
					if (br.width >= min - 0.5 && br.height >= min - 0.5) continue;
				}
				if (r.width >= min - 0.5 && r.height >= min - 0.5) continue;
				// elementFromPoint only sees what is on screen: bring the control into view first
				{ // always the middle of the screen: fixed bars (a sticky footer, the bottom navigation) would otherwise cover the zone of a control near the edge

					el.scrollIntoView({ block: 'center', inline: 'nearest' });
					r = el.getBoundingClientRect();
				}
				// The tappable area is MEASURED, not guessed from a ::after rule: from the centre of the control walk outwards in four directions while
				// `elementFromPoint` still answers with this control (or something inside it). A zone drawn by CSS that is covered by a neighbour, clipped by an
				// overflow:hidden parent or cut by the edge of the screen does not count. (The first version trusted any ::after of 44 px and was blind to such cases.)
				const hits = (x, y) => {
					const hit = document.elementFromPoint(x, y);
					if (!hit) return false;
					if (hit === el || el.contains(hit)) return true;
					const owner = hit.closest(SEL);
					if (owner === el) return true;
					// the invisible zone of a NEIGHBOUR control (rows of a settings list, 40 px apart): the point is not on its box, so it is free space between the two
					// and either control can claim it; only the box of another control stops the walk
					if (owner) {
						const nr = owner.getBoundingClientRect();
						return !(x >= nr.left && x <= nr.right && y >= nr.top && y <= nr.bottom);
					}
					return false;
				};
				const cx = r.left + r.width / 2;
				const cy = r.top + r.height / 2;
				const reach = (dx, dy, from) => {
					let n = 0;
					while (n < 48 && hits(cx + dx * (from + n), cy + dy * (from + n))) n++;
					return n;
				};
				const ext = { l: reach(-1, 0, r.width / 2 + 1), r: reach(1, 0, r.width / 2), u: reach(0, -1, r.height / 2 + 1), d: reach(0, 1, r.height / 2) };
				const hitW = Math.round(r.width) + ext.l + ext.r;
				const hitH = Math.round(r.height) + ext.u + ext.d;
				if (hitW >= min - 0.5 && hitH >= min - 0.5) continue;
				// inside the viewport width only (things scrolled away are measured on their own page anyway)
				const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
				const cls = [...el.classList].filter((c) => c.startsWith('atmr-')).slice(0, 2).join('.') || [...el.classList].slice(0, 2).join('.');
				const key = `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
				const entry = out.get(key) ?? { key, n: 0, sizes: new Set(), names: new Set() };
				entry.n++;
				entry.sizes.add(`${Math.round(r.width)}×${Math.round(r.height)}→${hitW}×${hitH}`);
				if (window.__tapsDebug) console.log(`TAP ${key} "${name}" y=${Math.round(r.top)} reach l${ext.l} r${ext.r} u${ext.u} d${ext.d}`);
				if (entry.names.size < 3 && name) entry.names.add(name);
				out.set(key, entry);
			}
			return [...out.values()].map((e) => ({ key: e.key, n: e.n, sizes: [...e.sizes].slice(0, 4).join(' '), names: [...e.names].join(' | ') }));
		}, min);
		console.log(`\n${url} — ${found.reduce((s, f) => s + f.n, 0)} small targets`);
		for (const f of found.sort((a, b) => b.n - a.n)) console.log(`  ${String(f.n).padStart(3)} × ${f.key}  [${f.sizes}]  ${f.names}`);
	}
} finally {
	await browser.close();
}
