import { describe, expect, it } from 'vitest';
import { TERM_HINTS } from './terms';

describe('terms', () => {
	it('every abbreviation the product shows has an explanation', () => {
		for (const term of ['ИНН', 'КПП', 'ОГРН', 'ЕГРЮЛ', 'ОПФ', 'ОКВЭД', 'SLA', 'ЭДО', 'LMS', 'ЛПР']) {
			expect(TERM_HINTS[term]?.length, term).toBeGreaterThan(15);
		}
	});
});
