// Контрольные суммы ИНН / КПП / ОГРН / ОГРНИП (dop.md §11.4).
// Зеркало backend/app/modules/catalog/validators.py: те же правила и те же тексты причин,
// чтобы мгновенная проверка на клиенте совпадала с серверной (`POST /api/org-lookup/validate`).

export interface RequisiteCheck {
	ok: boolean;
	reason?: string;
}

export type RequisiteKind = 'inn' | 'kpp' | 'ogrn' | 'ogrnip';

const INN10_WEIGHTS = [2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_WEIGHTS_11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
const INN12_WEIGHTS_12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

const ok: RequisiteCheck = { ok: true };
const fail = (reason: string): RequisiteCheck => ({ ok: false, reason });

const isDigits = (value: string): boolean => /^\d+$/.test(value);

function checksumDigit(digits: string, weights: number[]): number {
	let total = 0;
	for (let i = 0; i < weights.length; i += 1) total += Number(digits[i]) * weights[i];
	return (total % 11) % 10;
}

/** Убирает пробелы и разделители, которые часто копируют вместе с реквизитом. */
export function normalizeRequisite(value: string | null | undefined): string {
	return (value ?? '').replace(/[\s \-–—]/g, '');
}

/** Похоже ли значение на ИНН по форме (10 или 12 цифр) — без проверки контрольной суммы. */
export function looksLikeInn(value: string | null | undefined): boolean {
	const v = normalizeRequisite(value);
	return /^\d{10}$/.test(v) || /^\d{12}$/.test(v);
}

export function validateInn(value: string | null | undefined): RequisiteCheck {
	const v = normalizeRequisite(value);
	if (!v || !isDigits(v)) return fail('ИНН должен состоять только из цифр');
	if (v.length !== 10 && v.length !== 12) return fail('ИНН должен содержать 10 или 12 цифр');
	if (v === v[0].repeat(v.length)) return fail('ИНН не может состоять из одинаковых цифр');
	const region = Number(v.slice(0, 2));
	if (region < 1 || region > 99) return fail('Некорректный код региона в ИНН');

	if (v.length === 10) {
		return checksumDigit(v, INN10_WEIGHTS) === Number(v[9]) ? ok : fail('Неверная контрольная сумма ИНН');
	}
	const check11 = checksumDigit(v, INN12_WEIGHTS_11);
	const check12 = checksumDigit(v, INN12_WEIGHTS_12);
	if (check11 !== Number(v[10]) || check12 !== Number(v[11])) return fail('Неверная контрольная сумма ИНН');
	return ok;
}

export function validateKpp(value: string | null | undefined): RequisiteCheck {
	const v = normalizeRequisite(value);
	if (!v || !isDigits(v) || v.length !== 9) return fail('КПП должен состоять из 9 цифр');
	return ok;
}

export function validateOgrn(value: string | null | undefined): RequisiteCheck {
	const v = normalizeRequisite(value);
	if (!v || !isDigits(v) || v.length !== 13) return fail('ОГРН должен состоять из 13 цифр');
	// 12 цифр < 2^53 — обычного Number достаточно.
	const expected = (Number(v.slice(0, 12)) % 11) % 10;
	return expected === Number(v[12]) ? ok : fail('Неверная контрольная сумма ОГРН');
}

export function validateOgrnip(value: string | null | undefined): RequisiteCheck {
	const v = normalizeRequisite(value);
	if (!v || !isDigits(v) || v.length !== 15) return fail('ОГРНИП должен состоять из 15 цифр');
	const expected = (Number(v.slice(0, 14)) % 13) % 10;
	return expected === Number(v[14]) ? ok : fail('Неверная контрольная сумма ОГРНИП');
}

const VALIDATORS: Record<RequisiteKind, (value: string | null | undefined) => RequisiteCheck> = {
	inn: validateInn,
	kpp: validateKpp,
	ogrn: validateOgrn,
	ogrnip: validateOgrnip
};

export function validateRequisite(kind: string, value: string | null | undefined): RequisiteCheck {
	const validator = (VALIDATORS as Record<string, (v: string | null | undefined) => RequisiteCheck | undefined>)[kind];
	if (!validator) return fail(`Неизвестный тип реквизита: ${kind}`);
	return validator(value) ?? ok;
}

/** ОГРН (13) для юрлиц, ОГРНИП (15) для ИП — выбор по длине, чтобы одно поле формы принимало оба. */
export function validateOgrnAny(value: string | null | undefined): RequisiteCheck {
	const v = normalizeRequisite(value);
	return v.length === 15 ? validateOgrnip(v) : validateOgrn(v);
}
