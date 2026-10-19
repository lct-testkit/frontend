// Демо: вход по логину и паролю через Keycloak/BFF (сценарий приглашённого пользователя): кнопка на /login → Keycloak → cookie-сессия → вход в приложение.
//   APP_URL=http://localhost:5281 node tools/demo-oidc-login.mjs [--out dir]   (учётка kam.ivanov из static/config.json)
import { mkdir } from 'node:fs/promises';
import { ACCOUNTS, BASE, newBrowser } from './lib.mjs';

const i = process.argv.indexOf('--out');
const out = i > -1 ? process.argv[i + 1] : '.shots/oidc';
await mkdir(out, { recursive: true });
const browser = await newBrowser();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.on('requestfailed', (r) => console.log('FAILED', r.url().slice(0, 100), r.failure()?.errorText));
page.on('framenavigated', (f) => f === page.mainFrame() && console.log('nav', f.url().slice(0, 140)));
await page.goto(`${BASE}/login`);
await page.click('[data-testid="oidc-login"]');
await page.waitForSelector('#username', { timeout: 20000 });
await page.screenshot({ path: `${out}/keycloak.png` });
await page.fill('#username', ACCOUNTS.kam.username);
await page.fill('#password', ACCOUNTS.kam.password);
await page.click('#kc-login');
// callback BFF ставит cookie-сессию (cookie не изолируются по порту) и возвращает на свой хост; у стенда на :8080 нет SPA, поэтому дальше открываем приложение сами
await page.waitForURL((u) => !u.pathname.startsWith('/auth/'), { timeout: 30000, waitUntil: 'commit' }).catch(() => {});
await page.waitForTimeout(1500);
console.log('после Keycloak:', page.url());
await page.goto(`${BASE}/`);
await page.waitForTimeout(3500);
console.log('url:', page.url());
console.log('final', page.url());
const tokens = await page.evaluate(() => localStorage.getItem('rtk.demo.tokens'));
console.log('demo-токенов нет (cookie-сессия):', tokens === null);
await page.screenshot({ path: `${out}/after-login.png` });
const onLogin = new URL(page.url()).pathname.startsWith('/login');
console.log(onLogin ? 'FAIL: остался на /login' : 'OK: вошёл, не на /login');
await browser.close();
process.exit(onLogin ? 1 : 0);
