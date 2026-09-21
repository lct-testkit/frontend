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
	});
}

export function renderMarkdown(source: string): string {
	hook();
	const html = marked.parse(source ?? '', { async: false }) as string;
	return DOMPurify.sanitize(html, {
		USE_PROFILES: { html: true },
		FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'input', 'img'],
		FORBID_ATTR: ['style']
	});
}

export async function sha256Hex(text: string): Promise<string> {
	const bytes = new TextEncoder().encode(text);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
