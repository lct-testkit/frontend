// Поведение общих блоков на реальных экранах мок-стенда (замена тестам компонентов в браузере, пока в проекте нет @vitest/browser):
// пустое состояние, ошибка с «Повторить», доступные имена элементов и доступность с клавиатуры. Бэкенд не нужен.
//   APP_URL=http://127.0.0.1:4273 node tools/mock/ui-checks.mjs
import { BASE } from '../lib.mjs';
import { newBrowser, newMockPage } from './page.mjs';

const browser = await newBrowser();
let bad = 0;
const check = (name, ok, detail = '') => {
	console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : detail ? `: ${detail}` : ''}`);
	if (!ok) bad++;
};

async function open(mode, path = '/deals', role = 'kam') {
	const page = await newMockPage(browser, role, { mode });
	await page.goto(BASE + path, { waitUntil: 'load' });
	await page.waitForLoadState('networkidle').catch(() => {});
	await page.waitForTimeout(500);
	return page;
}

try {
	// 1. EmptyState: пустой список сообщает об этом и предлагает действие
	{
		const page = await open('empty');
		const alert = page.getByRole('status').filter({ hasText: 'Сделок пока нет' });
		check('пусто: сообщение «Сделок пока нет» видно скринридеру (role=status)', (await alert.count()) > 0);
		check('пусто: действие «Новая сделка» доступно по имени', (await alert.getByRole('button', { name: 'Новая сделка' }).count()) > 0);
		await page.context().close();
	}

	// 2. ErrorState: ошибка списка — понятный текст и «Повторить», который шлёт запрос заново
	{
		const page = await open('error');
		check('ошибка: «Не удалось загрузить» в role=alert', (await page.getByRole('alert').filter({ hasText: 'Не удалось загрузить' }).count()) > 0);
		// код ошибки (CRM-XXXX) теперь показывается намеренно — рядом «Что это значит» ведёт в справку (F6-5); сырых технических слов быть не должно
		const errText = await page.locator('main').innerText();
		check('ошибка: нет технических слов (payload, null, undefined)', !/payload|null|undefined/.test(errText));
		check('ошибка: код показан вместе с «Что это значит» (F6-5)', !/CRM-\d{4}/.test(errText) || /Что это значит/.test(errText));
		const before = page.__mockCalls.filter((c) => c.startsWith('GET /api/deals?')).length;
		await page.getByRole('button', { name: 'Повторить' }).first().click();
		await page.waitForTimeout(700);
		check('ошибка: «Повторить» шлёт запрос списка заново', page.__mockCalls.filter((c) => c.startsWith('GET /api/deals?')).length > before);
		await page.context().close();
	}

	// 3. DataTable: у сортируемых заголовков есть имя, список доступен с клавиатуры
	{
		const page = await open('ok');
		const sort = page.getByRole('button', { name: /^Сортировать: / });
		check('таблица: у сортируемых колонок кнопки «Сортировать: …»', (await sort.count()) >= 2);
		await page.getByRole('button', { name: 'Новая сделка' }).first().focus();
		const focused = await page.evaluate(() => document.activeElement?.textContent?.trim());
		check('клавиатура: «Новая сделка» получает фокус', focused === 'Новая сделка', String(focused));
		// Tab проходит по панели вкладок и фильтров: фокус всегда на видимом элементе с именем
		const unnamed = [];
		for (let i = 0; i < 25; i++) {
			await page.keyboard.press('Tab');
			const info = await page.evaluate(() => {
				const el = document.activeElement;
				if (!el || el === document.body) return null;
				// DS-ISSUE rt-ui: внешняя рамка TagInput («Статус» в фильтрах) — div с tabindex=0 без имени, имя есть у вложенного input; правило «rt-ui как есть» — не чиним
				if (el.classList.contains('atmr-tags-container')) return null;
				const r = el.getBoundingClientRect();
				const name = el.getAttribute('aria-label') || el.textContent?.trim() || el.getAttribute('title') || el.getAttribute('placeholder') || '';
				return { visible: r.width > 0 && r.height > 0, name, tag: el.tagName };
			});
			if (info && (!info.visible || !info.name)) unnamed.push(`${info.tag}:${info.visible ? 'без имени' : 'невидим'}`);
		}
		check('клавиатура: 25 нажатий Tab — фокус только на видимых элементах с именем', unnamed.length === 0, unnamed.join(', '));
		await page.context().close();
	}

	// 4. Кнопка переключения вида: «Доска» меняет вид и сообщает состояние
	{
		const page = await open('ok');
		await page.getByRole('button', { name: 'Доска' }).first().click();
		await page.waitForTimeout(600);
		check('доска: после «Доска» адрес или список отражают вид', /board|view=/.test(page.url()) || (await page.getByRole('button', { name: 'Таблица' }).count()) > 0);
		await page.context().close();
	}
} finally {
	await browser.close();
}
process.exitCode = bad ? 1 : 0;
