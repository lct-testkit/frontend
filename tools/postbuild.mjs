// Post-build hardening for the strict CSP that Caddy applies (script-src 'self', no inline scripts):
// SvelteKit's SPA fallback inlines ONE bootstrap <script>; move it into an external file so `script-src 'self'` is enough.
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const build = resolve(dirname(fileURLToPath(import.meta.url)), '../build');

async function walk(dir) {
	const out = [];
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const full = resolve(dir, entry.name);
		if (entry.isDirectory()) out.push(...(await walk(full)));
		else if (entry.name.endsWith('.html')) out.push(full);
	}
	return out;
}

let moved = 0;
for (const file of await walk(build)) {
	const html = await readFile(file, 'utf8');
	const next = html.replace(/<script>([\s\S]*?)<\/script>/g, () => {
		moved++;
		return `<script src="/boot.js"></script>`;
	});
	if (next !== html) {
		const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
		await writeFile(resolve(build, 'boot.js'), code);
		await writeFile(file, next);
	}
}
console.log(`postbuild: ${moved} inline script(s) moved to /boot.js`);
