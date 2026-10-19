import { describe, expect, it } from 'vitest';
import { nextSnap, visibleError } from './fresh-error';

describe('сообщение под полем живёт, пока значение то, для которого оно появилось', () => {
	it('показывается, пока значение не менялось, и уходит после правки', () => {
		const snap = nextSnap(null, 'Заполните поле', 0, '');
		expect(visibleError(snap, 'Заполните поле', '')).toBe('Заполните поле');
		expect(visibleError(snap, 'Заполните поле', 'a')).toBeUndefined();
	});

	it('до снимка (первый кадр) сообщение показывается', () => {
		expect(visibleError(null, 'Ошибка', 'x')).toBe('Ошибка');
	});

	it('новый текст сообщения — новый снимок: показывается для нового значения', () => {
		const first = nextSnap(null, 'Заполните поле', 0, '');
		const second = nextSnap(first, 'Слишком коротко', 0, 'a');
		expect(second).toEqual({ error: 'Слишком коротко', submit: 0, value: 'a' });
		expect(visibleError(second, 'Слишком коротко', 'a')).toBe('Слишком коротко');
		expect(visibleError(second, 'Слишком коротко', 'ab')).toBeUndefined();
	});

	it('тот же текст после новой отправки формы — снова показывается', () => {
		const first = nextSnap(null, 'Заполните поле', 0, '');
		const again = nextSnap(first, 'Заполните поле', 1, 'a');
		expect(visibleError(again, 'Заполните поле', 'a')).toBe('Заполните поле');
	});

	it('без сообщения снимка нет; тот же снимок не пересоздаётся', () => {
		expect(nextSnap({ error: 'x', submit: 0, value: 1 }, undefined, 0, 1)).toBeNull();
		const snap = nextSnap(null, 'x', 0, 1);
		expect(nextSnap(snap, 'x', 0, 2)).toBe(snap);
	});

	it('массивы сравниваются по содержимому', () => {
		const snap = nextSnap(null, 'Выберите', 0, []);
		expect(visibleError(snap, 'Выберите', [])).toBe('Выберите');
		expect(visibleError(snap, 'Выберите', ['x'])).toBeUndefined();
	});
});
