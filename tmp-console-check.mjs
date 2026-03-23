import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];

page.on('console', (msg) => logs.push(`[console:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}\n${err.stack || ''}`));
page.on('requestfailed', (req) => logs.push(`[requestfailed] ${req.url()} :: ${req.failure()?.errorText}`));

await page.goto('http://localhost:5174/', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(2000);

console.log('URL:', page.url());
console.log('TITLE:', await page.title());
console.log('BODY_TEXT_LEN:', (await page.textContent('body'))?.trim().length || 0);
console.log('LOGS_START');
for (const l of logs) console.log(l);
console.log('LOGS_END');

await browser.close();
