// Alignment guides for a screenshot: vertical lines at the edges that must line up, plus a printed report of the numbers.
//   node tools/shot.mjs --as kam --url /deals/<id> --guides            (lines on the picture + report in the console)
//   node tools/shot.mjs ... --guides --guides-blocks 6                  (how many top-level blocks of the page to list, default 5)
// The page frame (`main#content > div`) has a content box: its LEFT and RIGHT edges are the axes of the page (red lines).
// Every block of the page (header, steps, tabs, filters, table, cards) must start on the left axis and end on the right one.
// Text that starts elsewhere (blue lines, with the x on top) is either a deliberate inset (padding of a card) or a crooked edge:
// the report lists the box edge AND the first text edge of every text element in the first blocks, so a 4 px slip is a number, not a feeling.
export async function applyGuides(page, { blocks = 5 } = {}) {
	return page.evaluate((maxBlocks) => {
		const main = document.querySelector('main#content') ?? document.body;
		const frame = main.firstElementChild;
		if (!frame) return { error: 'no page frame' };
		const fr = frame.getBoundingClientRect();
		const cs = getComputedStyle(frame);
		const L = fr.left + parseFloat(cs.paddingLeft);
		const R = fr.right - parseFloat(cs.paddingRight);
		const round = (n) => Math.round(n * 2) / 2;

		const textLeft = (el) => {
			const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				if (n.parentElement !== el || !n.textContent.trim()) continue;
				const range = document.createRange();
				range.selectNodeContents(n);
				const rect = [...range.getClientRects()][0];
				if (rect && rect.width > 0) return { left: rect.left, top: rect.top };
			}
			return null;
		};
		const describe = (el) => {
			const id = el.getAttribute('data-testid');
			const cls = typeof el.className === 'string' ? el.className.split(/\s+/).find((c) => c && !c.startsWith('max-') && !c.startsWith('md:')) : '';
			return `${el.tagName.toLowerCase()}${id ? `[${id}]` : cls ? `.${cls}` : ''}`;
		};

		const children = [...frame.children].filter((el) => {
			const r = el.getBoundingClientRect();
			return r.width > 0 && r.height > 0 && getComputedStyle(el).position !== 'fixed';
		});
		const report = { frame: { left: round(L), right: round(R), width: round(R - L) }, blocks: [], gaps: [], text: [] };
		let prevBottom = null;
		children.slice(0, maxBlocks).forEach((el, i) => {
			const r = el.getBoundingClientRect();
			report.blocks.push({ i, el: describe(el), left: round(r.left), right: round(r.right), top: round(r.top), bottom: round(r.bottom), flag: Math.abs(r.left - L) > 0.5 || Math.abs(r.right - R) > 0.5 ? 'OFF-AXIS' : '' });
			if (prevBottom !== null) report.gaps.push(`${i - 1}→${i}: ${round(r.top - prevBottom)}px`);
			prevBottom = r.bottom;

			// every text-owning element of the first blocks: its box edge and its first text edge
			for (const t of el.querySelectorAll('h1,h2,h3,h4,p,dt,dd,span,a,button,label,th,li,legend')) {
				const tl = textLeft(t);
				if (!tl) continue;
				const box = t.getBoundingClientRect();
				report.text.push({ block: i, el: describe(t), text: t.textContent.trim().replace(/\s+/g, ' ').slice(0, 22), boxLeft: round(box.left), textLeft: round(tl.left), top: round(tl.top) });
			}
		});

		// the picture: page axes red, every other text edge of the headings/first lines blue
		document.getElementById('__guides')?.remove();
		const layer = document.createElement('div');
		layer.id = '__guides';
		layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647';
		const line = (x, color, label, dashed) => {
			const l = document.createElement('div');
			l.style.cssText = `position:absolute;top:0;bottom:0;left:${x}px;width:0;border-left:1px ${dashed ? 'dashed' : 'solid'} ${color}`;
			const t = document.createElement('div');
			t.textContent = label;
			t.style.cssText = `position:absolute;top:${dashed ? 14 : 2}px;left:${x + 3}px;font:10px/12px monospace;color:${color};background:rgba(255,255,255,.85);padding:0 2px`;
			layer.append(l, t);
		};
		line(L, '#e00000', `L ${round(L)}`, false);
		line(R, '#e00000', `R ${round(R)}`, false);
		const seen = new Set([round(L), round(R)]);
		for (const t of report.text) {
			for (const x of [t.textLeft]) {
				if (seen.has(x) || x < L - 8 || x > L + 64) continue;
				seen.add(x);
				line(x, '#0050ff', String(x), true);
			}
		}
		document.body.append(layer);
		return report;
	}, blocks);
}

export function printGuides(report) {
	if (report.error) return console.log(`  guides: ${report.error}`);
	console.log(`  guides: page axis L=${report.frame.left} R=${report.frame.right} (width ${report.frame.width})`);
	for (const b of report.blocks) console.log(`    block ${b.i} ${b.el.padEnd(28)} left ${String(b.left).padStart(6)} right ${String(b.right).padStart(7)} top ${String(b.top).padStart(6)} bottom ${String(b.bottom).padStart(6)} ${b.flag}`);
	console.log(`    gaps between blocks: ${report.gaps.join(' · ') || '—'}`);
	// group the text lines by their first-text edge: the "who starts where" table
	const byX = new Map();
	for (const t of report.text) {
		if (!byX.has(t.textLeft)) byX.set(t.textLeft, []);
		byX.get(t.textLeft).push(t);
	}
	for (const [x, items] of [...byX].sort((a, b) => a[0] - b[0])) {
		console.log(`    text starts at ${String(x).padStart(6)}: ${items.slice(0, 5).map((t) => `b${t.block} ${t.el} «${t.text}»`).join(' | ')}${items.length > 5 ? ` … +${items.length - 5}` : ''}`);
	}
}
