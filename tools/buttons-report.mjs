// Human report from tools/buttons.mjs output: what looks dead, what still needs a look, and the plain inventory.
//   node tools/buttons-report.mjs .shots/buttons                 → one summary of every *-*.jsonl file in the folder
//   node tools/buttons-report.mjs .shots/buttons --full          → + every row of the "needs a look" bucket, not just the count
//   node tools/buttons-report.mjs .shots/buttons/kam-desktop.jsonl → one file
// Note: PATCH/POST are answered by a stub «ok», so a screen that trusts the full shape of that answer (rather than only its
// success) can throw where the real backend never would — such rows carry note "stub-shape" once you have checked them once
// and recorded the key in KNOWN_STUB_ARTIFACTS below; until then they show up as real findings, on purpose.
import { readFile, readdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const target = args[0] ?? '.shots/buttons';
const full = args.includes('--full');

const files = target.endsWith('.jsonl')
	? [target]
	: (await readdir(target)).filter((f) => f.endsWith('.jsonl')).map((f) => `${target}/${f}`).sort();
if (!files.length) {
	console.log(`no .jsonl files in ${target}`);
	process.exit(1);
}

const rows = [];
for (const f of files) {
	const text = await readFile(f, 'utf8').catch(() => '');
	for (const line of text.split('\n')) {
		if (!line.trim()) continue;
		try {
			rows.push({ ...JSON.parse(line), _file: f });
		} catch {
			/* a partial last line of a run still in progress */
		}
	}
}

const label = (r) => `${r.who ?? '?'} ${r.route ?? ''} d${r.depth ?? 0} ${r.area ?? ''} <${r.tag ?? '?'}${r.role ? ` role=${r.role}` : ''}> "${(r.name ?? '').slice(0, 60)}"`;
const has = (r, e) => (r.effect ?? []).includes(e);

// -------------------------------------------------------------------------------------------------------------- buckets
// a page that trusts the full shape of a write's answer can throw on our stub where the real backend never would (see tools/buttons.mjs);
// such a row is set apart here rather than mixed into real findings — a numeric HTTP status in `errors` is never from our own stub
// (it always answers 200/201/204), so it stays a real error even on a stubbed write.
const isStubArtifact = (r) => r.stubWrite && r.errors?.every((e) => e.startsWith('pageerror:') || e.startsWith('console:'));
const errors = rows.filter((r) => r.errors?.length && !isStubArtifact(r));
const stubArtifacts = rows.filter((r) => r.errors?.length && isStubArtifact(r));
const noEsc = rows.filter((r) => has(r, 'no-esc'));
const crashes = rows.filter((r) => has(r, 'crash'));
const truncated = rows.filter((r) => has(r, 'truncated'));
const redirects = rows.filter((r) => has(r, 'redirect'));
const vanished = rows.filter((r) => has(r, 'vanished'));
const blocked = rows.filter((r) => has(r, 'blocked'));
// "did nothing at all" minus the ones a role legitimately cannot use and minus fields (focus is the field's whole job)
const none = rows.filter((r) => (has(r, 'none') || has(r, 'class-only')) && !r.disabled);
const externalNoRel = rows.filter((r) => has(r, 'external') && r.note);
const unnamed = rows.filter((r) => !r.name && !r.disabled && r.tag !== 'input' && !has(r, 'listed'));

const needsLook = [...errors, ...noEsc, ...crashes, ...truncated, ...vanished, ...blocked, ...none, ...externalNoRel, ...unnamed];
const seen = new Set();
const dedup = needsLook.filter((r) => {
	const k = JSON.stringify([r._file, r.route, r.depth, r.name, r.tag, r.effect]);
	if (seen.has(k)) return false;
	seen.add(k);
	return true;
});

// -------------------------------------------------------------------------------------------------------------- print
const byFile = new Map();
for (const f of files) byFile.set(f, rows.filter((r) => r._file === f));
console.log(`${files.length} file(s), ${rows.length} rows\n`);
for (const [f, rs] of byFile) {
	const total = rs.filter((r) => r.depth > 0).length;
	const effects = {};
	for (const r of rs) for (const e of r.effect ?? []) effects[e] = (effects[e] ?? 0) + 1;
	console.log(`${f}  —  ${total} elements pressed`);
	console.log(
		'  ' +
			Object.entries(effects)
				.sort((a, b) => b[1] - a[1])
				.map(([k, v]) => `${k}:${v}`)
				.join('  ')
	);
}

function section(title, list, why) {
	if (!list.length) return;
	console.log(`\n${'─'.repeat(70)}\n${title} — ${list.length}${why ? `  (${why})` : ''}`);
	const show = full ? list : list.slice(0, 25);
	for (const r of show) {
		console.log(`  ${label(r)}`);
		if (r.errors?.length) for (const e of r.errors) console.log(`      ${e}`);
		if (r.note) console.log(`      note: ${r.note}`);
		if (r.html) console.log(`      ${r.html.slice(0, 150)}`);
	}
	if (!full && list.length > show.length) console.log(`  … +${list.length - show.length} more (--full to list all)`);
}

section('Pageerrors / failed requests / 4xx-5xx from a stub-free request', errors, 'crash or a real HTTP error while pressing');
section('Pageerror right after a stubbed write', stubArtifacts, 'likely our generic stub answer, not a real bug — open the real flow by hand once to be sure (see the note in tools/buttons-report.mjs)');
section('Window does not close on Escape', noEsc, 'keyboard trap: a keyboard user cannot leave it');
section('Crawler crash (script bug, not the app)', crashes);
section('Route ran out of its time budget (--budget)', truncated, 'raise --budget or shrink --per-sig for this route');
section('Blocked: something visually covers the element', blocked, 'z-index / hit-area problem, or the crawler pressed something stale');
section('Vanished between listing and pressing', vanished, 'likely fine: the row it pointed at was one of many and the list re-sorted — confirm by hand if it repeats');
section('No effect at all (not disabled)', none, 'dead button, or the crawler missed an effect it should recognize — check by hand');
section('target="_blank" without rel="noopener"', externalNoRel, 'the opened page can reach back via window.opener');
section('No accessible name (icon button without aria-label, or empty link)', unnamed);
section('Route redirected on load', redirects, 'expected for a few routes (e.g. AUDITOR at "/"); look twice at any other one');

console.log(`\n${'─'.repeat(70)}\nneeds a look, deduplicated: ${dedup.length} of ${rows.length} rows${full ? '' : ' (use --full on one file at a time for every row)'}`);
