import { describe, expect, it } from 'vitest';
import { ANONYMIZED_MARK, DECISION_MAKER_MARK, contactMark } from './contactHints';

describe('пометки контакта', () => {
	it('у обычного контакта пометки нет', () => {
		expect(contactMark({ is_anonymized: false, is_decision_maker: false })).toBeNull();
	});

	it('ЛПР получает пометку с расшифровкой', () => {
		const mark = contactMark({ is_anonymized: false, is_decision_maker: true });
		expect(mark).toBe(DECISION_MAKER_MARK);
		expect(mark?.hint).toMatch(/принимающее решения/);
	});

	it('обезличенный важнее ЛПР', () => {
		expect(contactMark({ is_anonymized: true, is_decision_maker: true })).toBe(ANONYMIZED_MARK);
	});

	it('у каждой пометки есть короткая подпись и объяснение', () => {
		for (const mark of [DECISION_MAKER_MARK, ANONYMIZED_MARK]) {
			expect(mark.label.length).toBeGreaterThan(0);
			expect(mark.hint.length).toBeGreaterThan(20);
		}
	});
});
