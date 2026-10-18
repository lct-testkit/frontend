import { describe, expect, it } from 'vitest';
import { explainRowErrors } from './rowErrors';

const explainRowError = (text: string) => explainRowErrors([text])[0];

describe('explainRowError', () => {
	it('вуз не найден: пояснение и ссылка на организации', () => {
		const r = explainRowError("«Название ВУЗа»: значение 'МГУ' не найдено");
		expect(r.fix).toContain('точному названию');
		expect(r.link?.href).toBe('/organizations');
	});

	it('другое поле со справочником: общее пояснение без ссылки на организации', () => {
		const r = explainRowError("«Регион»: значение 'Марс' не найдено");
		expect(r.fix).toContain('справочнике');
		expect(r.link).toBeUndefined();
	});

	it('номер договора у другого вуза', () => {
		expect(explainRowError('Номер договора уже относится к другой организации').fix).toContain('другого вуза');
	});

	it('запись для обновления не найдена', () => {
		expect(explainRowError('Запись для обновления не найдена').fix).toContain('Создать и обновить');
	});

	it('пропущена: уже существует', () => {
		expect(explainRowError('Пропущена при применении: уже существует').fix).toContain('Только создать');
	});

	it('статус по передаче: допустимые значения', () => {
		const r = explainRowError('«Статус по передаче»: допустимые значения — declined, in_progress, not_started, transferred');
		expect(r.fix).toContain('в работе');
		expect(explainRowError('«кое-что»: статус по передаче не распознан. Допустимо: передано').fix).toContain('отказ');
	});

	it('подписание, срок, дата', () => {
		expect(explainRowError('«x»: «Подписание лицензии» не распознано — ожидается да/нет или дата').fix).toContain('да, нет');
		expect(explainRowError('«x»: срок действия не распознан. Укажите срок в годах (1–50)').fix).toContain('бессрочно');
		expect(explainRowError('«Дата» — нераспознанный формат даты').fix).toContain('ДД.ММ.ГГГГ');
	});

	it('неизвестный текст остаётся как есть', () => {
		expect(explainRowError('Что-то новое от сервера')).toEqual({ text: 'Что-то новое от сервера' });
	});
});

describe('explainRowErrors', () => {
	it('несколько замечаний — по порядку; пусто — пустой список', () => {
		const list = explainRowErrors(["«Название ВУЗа»: значение 'Х' не найдено", 'Запись для обновления не найдена', 'новое']);
		expect(list.map((r) => Boolean(r.fix))).toEqual([true, true, false]);
		expect(explainRowErrors(null)).toEqual([]);
		expect(explainRowErrors([])).toEqual([]);
	});
});
