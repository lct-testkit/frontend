// Помощники сценариев агента A: поля rt-ui по подписи, выбор в Select, ожидание тостов.
import { BASE, newBrowser, newPage } from '../lib.mjs';
export { BASE, newBrowser, newPage };

export const field = (page, label) =>
	page.locator(`.atmr-input:has(.atmr-input__label span:text-is("${label}")) :is(input, textarea)`).first();

/** Открывает Select по подписи, (опционально) вводит текст и выбирает пункт по тексту. */
export async function choose(page, label, option, { type } = {}) {
	const input = field(page, label);
	await input.click();
	if (type) await input.fill(type);
	const item = page.locator('.atmr-dropdown-menu__item, [class*=dropdown-menu] [role=option], .atmr-dropdown-menu-item').filter({ hasText: option }).first();
	await item.waitFor({ timeout: 8000 });
	await item.click();
}

export const step = (msg) => console.log(`• ${msg}`);
export const expect = (cond, msg) => {
	if (!cond) throw new Error(`ASSERT: ${msg}`);
	console.log(`  ✓ ${msg}`);
};
export const toasts = (page) => page.locator('.atmr-notification, [class*=notification]').allInnerTexts();
