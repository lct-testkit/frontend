import { describe, expect, it } from 'vitest';
import { licenseTermLabel, transferStatusLabel } from './licenseUtils';

// `count()` (src/lib/utils/format.ts) joins the number and the word with a non-breaking space, not a plain one.
const NBSP = ' ';

describe('licenseTermLabel', () => {
	it.each([
		[null, '—'],
		[undefined, '—'],
		[1, `1${NBSP}год`],
		[3, `3${NBSP}года`],
		[5, `5${NBSP}лет`],
		[11, `11${NBSP}лет`],
		[21, `21${NBSP}год`]
	] as const)('%s -> %s', (years, label) => {
		expect(licenseTermLabel(years)).toBe(label);
	});
});

describe('transferStatusLabel', () => {
	it.each([
		[null, '—'],
		[undefined, '—'],
		['not_started', 'Не начата'],
		['in_progress', 'В процессе'],
		['transferred', 'Передана'],
		['declined', 'Не состоялась']
	] as const)('%s -> %s', (status, label) => {
		expect(transferStatusLabel(status)).toBe(label);
	});

	it('неизвестное значение возвращается как есть', () => {
		expect(transferStatusLabel('rescinded' as never)).toBe('rescinded');
	});
});
