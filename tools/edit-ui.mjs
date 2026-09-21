// Small CRLF-safe edit helper used while rebuilding the UI layer: node tools/edit-ui.mjs (edits are listed inline below, then this file is reused).
import { readFileSync, writeFileSync } from 'node:fs';

export function edit(path, fn) {
	let s = readFileSync(path, 'utf8');
	const crlf = s.includes('\r\n');
	s = s.replace(/\r\n/g, '\n');
	const next = fn(s);
	if (next === s) console.log(`  (no change) ${path}`);
	writeFileSync(path, crlf ? next.replace(/\n/g, '\r\n') : next);
}
