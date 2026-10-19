// What a number / amount field keeps of the typed or pasted text: digits, one decimal separator («,» or «.», none for an integer) and a leading minus
// (only when a negative number is allowed). Spaces (a pasted «1 250 000») and letters are dropped; a typographic minus «−» counts as «-».
// What stays in the field is exactly what the form sends — nothing is cut or turned into «1e+21» later: an integer part longer than `maxInt` digits (default 15,
// the limit of an exact JS number) and a fraction longer than `maxFrac` digits do not get into the field.
// An integer field drops everything after a separator («12,5» → «12»): «125» would be a different number.
export interface SanitizeOptions {
	integer?: boolean;
	negative?: boolean;
	maxInt?: number;
	maxFrac?: number;
}

export function sanitizeNumber(raw: string, { integer = false, negative = true, maxInt = 15, maxFrac }: SanitizeOptions = {}): string {
	let s = raw.replace(/\s/g, '').replace(/[−–]/g, '-');
	const minus = negative && s.startsWith('-');
	if (integer) s = s.split(/[.,]/)[0];
	let body = s.replace(integer ? /[^0-9]/g : /[^0-9.,]/g, '');
	const sep = body.search(/[.,]/);
	if (sep < 0) return (minus ? '-' : '') + body.slice(0, maxInt);
	const whole = body.slice(0, sep).slice(0, maxInt);
	let frac = body.slice(sep + 1).replace(/[.,]/g, '');
	if (maxFrac !== undefined) frac = frac.slice(0, maxFrac);
	body = maxFrac === 0 ? whole : `${whole}${body[sep]}${frac}`;
	return (minus ? '-' : '') + body;
}
