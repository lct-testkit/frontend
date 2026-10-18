// XSS-векторы в тексте комментария сделки на мок-стенде: приложение (production-сборка или dev по APP_URL) должно показать их безвредными.
// Путь тот же, что у пользователя: комментарий → renderMarkdown (marked + DOMPurify) → {@html}. Живой бэкенд не нужен.
//   APP_URL=http://127.0.0.1:4273 node tools/xss-check.mjs
import { BASE } from './lib.mjs';
import { newBrowser, newMockPage } from './mock/page.mjs';
import { createSampler, loadSpec, uuidFor } from './mock/sample.mjs';

const VECTORS = [
	['IMG-ONERROR', '<img src=x onerror="window.__pwned=\'img\'">'],
	['JS-LINK', '[нажми](javascript:window.__pwned=\'link\')'],
	['SVG-ONLOAD', '<svg onload="window.__pwned=\'svg\'"></svg>'],
	['IFRAME', '<iframe src="//evil.example/x"></iframe>'],
	['REMOTE-IMAGE', '![x](https://evil.example/p.png)'],
	['STYLE-ATTR', '<span style="background:url(https://evil.example/s.png)">STYLE-VECTOR</span>'],
	['SCRIPT', '<script>window.__pwned=\'script\'</script>'],
	['FORM', '<form action="https://evil.example/"><input name="p"></form>'],
	['PLAIN-LINK', '[сайт](https://example.com/page)']
];

const spec = loadSpec();
const sampler = createSampler(spec);
const dealId = uuidFor('xss-deal');
const schema = spec.paths['/api/deals/{deal_id}/comments'].get.responses['200'].content['application/json'].schema;
const tpl = sampler.sample(schema, 'comments').items[0];
const comments = VECTORS.map(([name, md], i) => ({ ...tpl, id: uuidFor(`c${i}`), deal_id: dealId, body: `${name}: ${md}`, body_format: 'markdown', is_system: false, is_internal: false, parent_id: null, mentions: [] }));
const override = { method: 'GET', re: /^\/api\/deals\/[^/]+\/comments$/, list: true, reply: () => ({ items: comments, next_cursor: null }) };

const browser = await newBrowser();
let bad = 0;
try {
	const page = await newMockPage(browser, 'kam', { overrides: [override] });
	await page.addInitScript(() => {
		window.__pwned = null;
		window.alert = () => (window.__pwned = 'alert');
	});
	await page.goto(`${BASE}/deals/${dealId}?tab=comments`, { waitUntil: 'load' });
	await page.getByText('IMG-ONERROR').first().waitFor({ timeout: 15000 });
	await page.waitForTimeout(500);
	const report = await page.evaluate(() => {
		const q = (sel) => document.querySelectorAll(sel).length;
		const link = [...document.querySelectorAll('a')].find((a) => a.textContent?.trim() === 'сайт');
		const styled = [...document.querySelectorAll('span')].find((s) => s.textContent?.trim() === 'STYLE-VECTOR');
		return {
			pwned: window.__pwned,
			onHandlers: q('[onerror],[onload],[onclick],[onmouseover]'),
			jsLinks: q('a[href^="javascript:" i]'),
			iframes: q('iframe'),
			scripts: [...document.querySelectorAll('script')].filter((s) => s.textContent?.includes('__pwned')).length,
			foreignImages: [...document.querySelectorAll('img')].filter((i) => /evil\.example/.test(i.getAttribute('src') ?? '')).length,
			formsWithAction: q('form[action*="evil.example"]'),
			styleAttrKept: styled ? styled.hasAttribute('style') : null,
			linkRel: link?.getAttribute('rel') ?? null,
			linkTarget: link?.getAttribute('target') ?? null
		};
	});
	const checks = [
		['скрипт не выполнился', report.pwned === null],
		['нет обработчиков on*', report.onHandlers === 0],
		['нет javascript:-ссылок', report.jsLinks === 0],
		['нет iframe', report.iframes === 0],
		['нет script из комментария', report.scripts === 0],
		['чужая картинка удалена', report.foreignImages === 0],
		['форма с чужим action удалена', report.formsWithAction === 0],
		['атрибут style снят', report.styleAttrKept === false],
		['у обычной ссылки rel=noopener noreferrer nofollow', report.linkRel === 'noopener noreferrer nofollow' && report.linkTarget === '_blank']
	];
	for (const [name, ok] of checks) {
		console.log(`${ok ? '✓' : '✗'} ${name}`);
		if (!ok) bad++;
	}
	if (bad) console.log(JSON.stringify(report, null, 2));
} finally {
	await browser.close();
}
process.exitCode = bad ? 1 : 0;
