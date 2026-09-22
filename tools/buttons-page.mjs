// The page side of tools/buttons.mjs: runs inside the browser (addInitScript), so it must not use anything from the module.
// Collects the clickable elements of the page or of one window, watches the DOM, lists the open windows.

/** Runs in the page (addInitScript). Collects the clickable elements of the page or of a window, watches the DOM, lists the open windows. */
export function install() {
	const SEL = [
		'button', 'a[href]', '[role=button]', '[role=tab]', '[role=menuitem]', '[role=menuitemcheckbox]', '[role=menuitemradio]', '[role=option]',
		'[role=switch]', '[role=checkbox]', '[role=radio]', '[role=combobox]', '[role=link]', '[role=treeitem]', 'summary',
		'label:has(input[type=checkbox])', 'label:has(input[type=radio])'
	].join(',');
	const stats = { child: 0, text: 0, attr: 0, cls: 0 };
	new MutationObserver((records) => {
		for (const m of records) {
			if (m.type === 'childList') stats.child += m.addedNodes.length + m.removedNodes.length;
			else if (m.type === 'characterData') stats.text++;
			else {
				const a = m.attributeName || '';
				if (a === 'style' || a === 'tabindex' || a.startsWith('data-btn')) continue;
				if (a === 'class') stats.cls++;
				else stats.attr++;
			}
		}
	}).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });

	const text = (el) => (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ');
	const nameOf = (el) => {
		const aria = el.getAttribute('aria-label');
		if (aria) return aria.trim();
		const by = el.getAttribute('aria-labelledby');
		if (by) {
			const t = by.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? '').join(' ').trim();
			if (t) return t;
		}
		const t = text(el);
		if (t) return t;
		const title = el.getAttribute('title');
		if (title) return title.trim();
		return el.querySelector('img[alt]')?.getAttribute('alt')?.trim() || el.querySelector('svg title')?.textContent?.trim() || '';
	};
	const visible = (el) => {
		const r = el.getBoundingClientRect();
		if (r.width < 1 || r.height < 1) return false;
		if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
		return true;
	};
	// The windows of the DS: Drawer and the lists of Select/DropdownMenu/Popover are put at the end of <body>, but Modal is drawn where it is
	// declared (a fixed full-screen wrapper inside the page), so the whole document is searched.
	const LAYER_SEL = '.atmr-modal-wrapper,.atmr-drawer,.atmr-dropdown-menu,.atmr-popover,[role=dialog],[role=alertdialog],[role=menu],[role=listbox]';
	const layerKind = (el) => {
		const role = el.getAttribute('role') || '';
		const has = (c) => el.classList.contains(c);
		if (has('atmr-drawer')) return 'drawer';
		if (has('atmr-modal-wrapper') || role === 'dialog' || role === 'alertdialog') return 'modal';
		if (has('atmr-dropdown-menu') || role === 'menu' || role === 'listbox') return 'menu';
		if (has('atmr-popover')) return 'popover';
		return null;
	};
	let seq = 0;
	const layers = () => {
		const found = [...document.querySelectorAll(LAYER_SEL)].filter((el) => layerKind(el) && visible(el));
		// a window inside another one (a dialog role inside the modal wrapper) is the same window
		const top = found.filter((el) => !found.some((o) => o !== el && o.contains(el)));
		return top.map((el) => {
			if (!el.dataset.btnlayer) el.dataset.btnlayer = String(++seq);
			const head = el.querySelector('h1,h2,h3,h4,[class*=title]');
			return {
				id: el.dataset.btnlayer,
				kind: layerKind(el),
				name: (el.getAttribute('aria-label') || (head ? text(head) : '') || '').slice(0, 70),
				items: el.querySelectorAll('[role=option],[role=menuitem],li').length,
				buttons: [...el.querySelectorAll('button')].filter(visible).map((b) => nameOf(b)).filter(Boolean).slice(0, 12)
			};
		});
	};
	const area = (el) => {
		if (el.closest('[data-btnlayer]')) return 'layer';
		if (!el.closest('main')) return 'shell';
		if (el.closest('table,[role=table],[role=grid],[role=row],tr')) return 'table';
		if (el.closest('[role=tablist]')) return 'tabs';
		return 'page';
	};
	const hrefSig = (h) => h.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id').replace(/\/\d+/g, '/:n');

	/** The clickable elements of the page (layerId = null) or of one window; every element gets data-btnaudit=<idx> so the script can press it. */
	const collect = (layerId, perSig, deep) => {
		const root = layerId ? document.querySelector(`[data-btnlayer="${layerId}"]`) : document.body;
		if (!root) return { items: [], dropped: 0 };
		document.querySelectorAll('[data-btnaudit]').forEach((e) => e.removeAttribute('data-btnaudit'));
		const occurrence = new Map();
		const perSigCount = new Map();
		const items = [];
		let dropped = 0;
		const seen = new Set();
		const consider = (el, nonsemantic) => {
			if (seen.has(el)) return;
			seen.add(el);
			if (!layerId && el.closest('[data-btnlayer]')) return;
			if (!visible(el)) return;
			const name = nameOf(el);
			const href = el.getAttribute('href') || '';
			const tag = el.tagName.toLowerCase();
			const role = el.getAttribute('role') || '';
			const key0 = `${tag}|${role}|${name}|${href}|${nonsemantic ? 'ns' : ''}`;
			const nth = occurrence.get(key0) ?? 0;
			occurrence.set(key0, nth + 1);
			const sig = `${tag}|${role}|${href ? hrefSig(href) : name.replace(/\d+/g, '#').slice(0, 40)}|${area(el)}`;
			const count = perSigCount.get(sig) ?? 0;
			perSigCount.set(sig, count + 1);
			if (count >= perSig) {
				dropped++;
				return;
			}
			const idx = items.length;
			el.setAttribute('data-btnaudit', String(idx));
			const inControl = el.closest('.atmr-input__container,.atmr-select,.atmr-multiselect,.atmr-input-date');
			items.push({
				idx,
				key: `${key0}|${nth}`,
				tag,
				role,
				type: el.getAttribute('type') || '',
				name,
				href,
				target: el.getAttribute('target') || '',
				rel: el.getAttribute('rel') || '',
				download: el.hasAttribute('download'),
				disabled: el.disabled === true || el.getAttribute('aria-disabled') === 'true' || !!el.closest('fieldset:disabled'),
				title: el.getAttribute('title') || '',
				describedby: !!el.getAttribute('aria-describedby'),
				haspopup: el.getAttribute('aria-haspopup') || '',
				expanded: el.getAttribute('aria-expanded'),
				selected: el.getAttribute('aria-selected'),
				current: el.getAttribute('aria-current'),
				pressed: el.getAttribute('aria-pressed'),
				checked: el.getAttribute('aria-checked') ?? (el.matches('input[type=checkbox],input[type=radio]') ? String(el.checked) : el.querySelector('input[type=checkbox],input[type=radio]') ? String(el.querySelector('input').checked) : null),
				area: area(el),
				select: !!inControl || el.getAttribute('aria-haspopup') === 'listbox' || role === 'combobox',
				cls: [...el.classList].filter((c) => c.startsWith('atmr-')).slice(0, 3).join(' '),
				nonsemantic: !!nonsemantic,
				html: el.outerHTML.replace(/\s+/g, ' ').slice(0, 200)
			});
		};
		// the icons inside a DS field (prefix, suffix — the DS names them "Input-right-icon"): the field around them takes the click
		const inField = (el) => el.matches('.atmr-input__prefix,.atmr-input__suffix') || el.closest('.atmr-input__prefix,.atmr-input__suffix');
		for (const el of root.querySelectorAll(SEL)) if (!inField(el)) consider(el, false);
		// clickable without being a button or a link (a div with cursor:pointer): the top-most such element of a group (slow: first look only)
		if (deep) for (const el of root.querySelectorAll('div,span,li,tr,td,p,img,svg,section,article')) {
			if (seen.has(el) || el.closest(SEL) || inField(el)) continue;
			if (getComputedStyle(el).cursor !== 'pointer') continue;
			const parent = el.parentElement;
			if (parent && getComputedStyle(parent).cursor === 'pointer') continue;
			consider(el, true);
		}
		return { items, dropped };
	};
	const toasts = () => [...document.querySelectorAll('[class*="atmr-notification"]')].filter(visible).length;
	const stateOf = (idx) => {
		const el = document.querySelector(`[data-btnaudit="${idx}"]`);
		if (!el) return null;
		const input = el.matches('input') ? el : el.querySelector('input[type=checkbox],input[type=radio]');
		return [el.getAttribute('aria-expanded'), el.getAttribute('aria-pressed'), el.getAttribute('aria-checked'), el.getAttribute('aria-selected'), input ? input.checked : '', el.disabled].join('|');
	};
	window.__ba = { collect, layers, toasts, stateOf, stats: () => ({ ...stats }), reset: () => Object.assign(stats, { child: 0, text: 0, attr: 0, cls: 0 }) };
}
