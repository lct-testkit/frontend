// Markdown → sanitized HTML (comments, policy, help). Raw HTML from the author is dropped; external links open in a new tab,
// links inside the help (`?s=…`, `#…`) stay in the same tab.
import { Marked } from 'marked';
import DOMPurify from 'dompurify';
import { HeadingIds, isInternalHref } from './headings';

export { isInternalHref } from './headings';

let hooked = false;
function hook() {
	if (hooked) return;
	hooked = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A') {
			if (isInternalHref(node.getAttribute('href'))) {
				node.removeAttribute('target');
				node.removeAttribute('rel');
			} else {
				node.setAttribute('target', '_blank');
				node.setAttribute('rel', 'noopener noreferrer nofollow');
			}
		}
		// an image is only ever allowed with `allowImages` (our own /help articles, not user input) — even there, only a local
		// path (no scheme, no `//`): the help pages must not become a way to pull a tracking pixel from someone else's server
		if (node.tagName === 'IMG') {
			const src = node.getAttribute('src') ?? '';
			if (!src.startsWith('/') || src.startsWith('//')) node.remove();
		}
	});
}

export interface RenderOptions {
	allowImages?: boolean;
	/** ставить заголовкам `id="h-…"` (якоря справки); явный якорь — `## Текст {#имя}` */
	headingIds?: boolean;
}

export function renderMarkdown(source: string, options: RenderOptions = {}): string {
	hook();
	const md = new Marked({ gfm: true, breaks: true });
	if (options.headingIds) {
		const ids = new HeadingIds();
		md.use({
			renderer: {
				heading({ tokens, depth, text }) {
					const { text: plain, id } = ids.next(text);
					let inner = this.parser.parseInline(tokens);
					// хвост `{#якорь}` убираем и из готового HTML
					if (plain !== text) inner = inner.replace(/\s*\{#[a-z0-9-]+\}\s*$/i, '');
					return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
				}
			}
		});
	}
	const html = md.parse(source ?? '', { async: false }) as string;
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', ...(options.allowImages ? [] : ['img'])],
		FORBID_ATTR: ['style']
	});
}
