// What a number / amount field keeps of the typed or pasted text: digits, one decimal separator («,» or «.», none for an integer) and a leading minus
// (only when a negative number is allowed). Spaces (a pasted «1 250 000») and letters are dropped; a typographic minus «−» counts as «-».
export function sanitizeNumber(raw: string, { integer = false, negative = true }: { integer?: boolean; negative?: boolean } = {}): string {
	const s = raw.replace(/\s/g, '').replace(/[−–]/g, '-');
	const minus = negative && s.startsWith('-');
	let body = s.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, '');
	const sep = body.search(/[.,]/);
	if (sep >= 0) body = body.slice(0, sep + 1) + body.slice(sep + 1).replace(/[.,]/g, '');
	return (minus ? '-' : '') + body;
}
