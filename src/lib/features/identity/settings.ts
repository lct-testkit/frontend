// Системные настройки (admin/router.py): значение — JSONB, секреты приходят маркером.
import { sha256Hex } from '../signing/hash';

export const SECRET_PLACEHOLDER = '********';
export const PDN_POLICY_KEY = 'pdn_policy';

export const isSecretPlaceholder = (value: unknown): boolean => value === SECRET_PLACEHOLDER;

export type ParsedSetting = { ok: true; value: unknown } | { ok: false; error: string };

/** Текст из поля → JSON-значение. Пустое поле — пустая строка, не ошибка. */
export function parseSettingValue(text: string): ParsedSetting {
	const trimmed = text.trim();
	if (trimmed === '') return { ok: true, value: '' };
	try {
		return { ok: true, value: JSON.parse(trimmed) };
	} catch {
		// Не JSON — считаем обычной строкой (например, URL или адрес), чтобы не заставлять писать кавычки.
		return { ok: true, value: trimmed };
	}
}

/** Значение → текст для поля: строки без кавычек, остальное — JSON с отступами. */
export function stringifySettingValue(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value;
	return JSON.stringify(value, null, 2);
}

export type SettingKind = 'boolean' | 'number' | 'string' | 'json' | 'secret';

export function settingKind(value: unknown, isSecret: boolean): SettingKind {
	if (isSecret) return 'secret';
	if (typeof value === 'boolean') return 'boolean';
	if (typeof value === 'number') return 'number';
	if (typeof value === 'string') return 'string';
	return 'json';
}

/** Тело `PUT /admin/system-settings/pdn_policy`: версия + sha256 текста политики (проверяется в `POST /me/consent`). */
export async function policyPayload(version: string, text: string): Promise<{ version: string; text_hash: string }> {
	return { version: version.trim(), text_hash: await sha256Hex(text) };
}

/** Простая проверка версии политики вида `1.0`, `2026-09`, `v3`. */
export const isPolicyVersion = (v: string): boolean => /^[A-Za-z0-9._-]{1,32}$/.test(v.trim());
