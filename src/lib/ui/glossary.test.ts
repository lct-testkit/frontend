import { describe, expect, it } from 'vitest';
import { GLOSSARY } from './glossary';

const entries = Object.entries(GLOSSARY);

describe('словарь терминов', () => {
	it('у каждого термина подпись до 30 символов и пояснение 20–140', () => {
		for (const [key, e] of entries) {
			expect(e.label.length, `${key}.label`).toBeLessThanOrEqual(30);
			expect(e.plural.length, `${key}.plural`).toBeLessThanOrEqual(30);
			expect(e.hint.length, `${key}.hint`).toBeGreaterThanOrEqual(20);
			expect(e.hint.length, `${key}.hint`).toBeLessThanOrEqual(140);
			expect(e.meaning.length, `${key}.meaning`).toBeGreaterThan(20);
		}
	});

	it('подписи уникальны, чтобы поля не путались', () => {
		const labels = entries.map(([, e]) => e.label);
		expect(new Set(labels).size).toBe(labels.length);
	});

	it('слово «ИТ-программа» в интерфейс не вводим (в пояснении полей)', () => {
		for (const [key, e] of entries) {
			expect(e.label, key).not.toMatch(/ИТ-программ/i);
			expect(e.hint, key).not.toMatch(/ИТ-программ/i);
		}
	});

	it('«ПО» объясняет, что это не продукт-курс', () => {
		expect(GLOSSARY.software.hint).toMatch(/не путать с продуктом/);
	});
});
