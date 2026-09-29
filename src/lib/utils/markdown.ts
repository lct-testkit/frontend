// Markdown → sanitized HTML (comments, policy, help). Raw HTML from the author is dropped; links open in a new tab.
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

let hooked = false;
function hook() {
	if (hooked) return;
	hooked = true;
	DOMPurify.addHook('afterSanitizeAttributes', (node) => {
		if (node.tagName === 'A') {
			node.setAttribute('target', '_blank');
			node.setAttribute('rel', 'noopener noreferrer nofollow');
		}
		// an image is only ever allowed with `allowImages` (our own /help articles, not user input) — even there, only a local
		// path (no scheme, no `//`): the help pages must not become a way to pull a tracking pixel from someone else's server
		if (node.tagName === 'IMG') {
			const src = node.getAttribute('src') ?? '';
			if (!src.startsWith('/') || src.startsWith('//')) node.remove();
		}
	});
}

export function renderMarkdown(source: string, options: { allowImages?: boolean } = {}): string {
	hook();
	const html = marked.parse(source ?? '', { async: false }) as string;
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', ...(options.allowImages ? [] : ['img'])],
		FORBID_ATTR: ['style']
	});
}
