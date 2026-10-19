// Код продукта: по нему импорт («Продукты», «Оплаты») находит продукт, поэтому без пробелов и кириллицы — латиница, цифры и «_», «-», «.», до 64 символов.
const PRODUCT_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

export const PRODUCT_CODE_HINT = 'Латиница, цифры и «_», «-», «.», без пробелов';

/** Текст ошибки или `null`, если код годится. */
export function productCodeError(code: string): string | null {
	const v = code.trim();
	if (!v) return 'Укажите код';
	return PRODUCT_CODE.test(v) ? null : 'Код: латиница, цифры и «_», «-», «.», до 64 символов, без пробелов';
}
