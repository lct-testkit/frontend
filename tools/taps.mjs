// Tap-target audit for a phone: every visible interactive element smaller than 44×44 CSS px (the touch minimum), grouped by what it is.
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
		const found = await page.evaluate((min) => {
			const SEL = 'button, a[href], [role=button], [role=tab], [role=menuitem], input:not([type=hidden]):not([type=file]), select, textarea, summary, label';
			const out = new Map();
			for (const el of document.querySelectorAll(SEL)) {
				const r = el.getBoundingClientRect();
				if (r.width === 0 || r.height === 0) continue;
				const cs = getComputedStyle(el);
				if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
				// a native input hidden behind a DS box (checkbox / radio / switch): the label or the box is the target
				if (el.tagName === 'INPUT' && r.width <= 1) continue;
				// a label without a control is not tappable
				if (el.tagName === 'LABEL' && !el.querySelector('input,select,textarea') && !el.htmlFor) continue;
				// inline link in a sentence
				if (el.tagName === 'A' && cs.display === 'inline' && el.parentElement && /^(P|SPAN|LI|DD|DIV)$/.test(el.parentElement.tagName) && el.parentElement.textContent.trim().length > el.textContent.trim().length + 2) continue;
				// a field of the DS: the input is 21 px high inside a 36–48 px box, the box is what is tapped
				const box = el.closest('.atmr-input__container');
				if (box && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
					const br = box.getBoundingClientRect();
					if (br.width >= min - 0.5 && br.height >= min - 0.5) continue;
				}
				// a control with an invisible zone around it (::after — the hit area of the app, or a link stretched over its row)
				const after = getComputedStyle(el, '::after');
				if (after.content !== 'none' && after.position === 'absolute') {
					const aw = parseFloat(after.width);
					const ah = parseFloat(after.height);
					if (aw >= min - 0.5 && ah >= min - 0.5) continue;
				}
				if (r.width >= min - 0.5 && r.height >= min - 0.5) continue;
				// inside the viewport width only (things scrolled away are measured on their own page anyway)
				const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
				const cls = [...el.classList].filter((c) => c.startsWith('atmr-')).slice(0, 2).join('.') || [...el.classList].slice(0, 2).join('.');
				const key = `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
				const entry = out.get(key) ?? { key, n: 0, sizes: new Set(), names: new Set() };
				entry.n++;
				entry.sizes.add(`${Math.round(r.width)}×${Math.round(r.height)}`);
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
