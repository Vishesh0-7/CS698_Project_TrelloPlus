import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const EMAIL = `rt_diag_${Date.now()}@flowboard.test`;
const PASSWORD = 'Realtime#123';
const FULL_NAME = 'Realtime Diagnostic';
const PROJECT_NAME = `RT Diag ${Date.now()}`;
const PROJECT_DESC = 'Diagnostic run for realtime board sync between two browser windows.';
const NEW_COLUMN = `RT_DIAG_COL_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const ctx1 = await browser.newContext();
const ctx2 = await browser.newContext();
const p1 = await ctx1.newPage();
const p2 = await ctx2.newPage();

for (const [name, page] of [["W1", p1], ["W2", p2]]) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${name} CONSOLE ${msg.type().toUpperCase()}]`, msg.text());
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[${name} PAGEERROR]`, err.message);
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('/ws') || url.includes('sockjs')) {
      console.log(`[${name} REQ FAILED]`, req.method(), url, req.failure()?.errorText || 'unknown');
    }
  });
}

const log = (...args) => console.log('[RT-DIAG]', ...args);

try {
  await p1.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await p1.fill('#register-full-name', FULL_NAME);
  await p1.fill('#register-email', EMAIL);
  await p1.fill('#register-password', PASSWORD);
  await p1.fill('#register-confirm-password', PASSWORD);
  await p1.getByRole('button', { name: 'Create account' }).click();
  await p1.waitForURL(/\/$/, { timeout: 20000 });

  await p1.getByRole('button', { name: /Create New Project|Create Project/i }).first().click();
  await p1.waitForURL(/\/create-project$/, { timeout: 20000 });
  await p1.fill('#project-name', PROJECT_NAME);
  await p1.fill('#project-description', PROJECT_DESC);
  await p1.getByRole('button', { name: 'Create Empty Board' }).click();
  await p1.waitForURL(/\/project\/.+\?tab=board/, { timeout: 25000 });
  const projectUrl = p1.url();
  log('Project URL', projectUrl);

  await p2.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p2.fill('#login-email', EMAIL);
  await p2.fill('#login-password', PASSWORD);
  await p2.getByRole('button', { name: 'Sign in' }).click();
  await p2.waitForURL(/\/$/, { timeout: 20000 });

  await p2.goto(projectUrl, { waitUntil: 'domcontentloaded' });
  await p1.goto(projectUrl, { waitUntil: 'domcontentloaded' });

  const boardTab1 = p1.getByRole('button', { name: /^Board$/i });
  if (await boardTab1.isVisible().catch(() => false)) await boardTab1.click();
  const boardTab2 = p2.getByRole('button', { name: /^Board$/i });
  if (await boardTab2.isVisible().catch(() => false)) await boardTab2.click();

  await p1.getByRole('button', { name: /Add Column/i }).click();
  await p1.getByPlaceholder('Column name...').fill(NEW_COLUMN);
  await p1.getByPlaceholder('Column name...').press('Enter');
  await p1.getByText(NEW_COLUMN, { exact: true }).first().waitFor({ timeout: 10000 });
  log('Window1 change created:', NEW_COLUMN);

  let realtimeSeen = true;
  try {
    await p2.getByText(NEW_COLUMN, { exact: true }).first().waitFor({ timeout: 12000 });
    log('Window2 saw change in realtime');
  } catch {
    realtimeSeen = false;
    log('Window2 did NOT see change in realtime window');
  }

  let seenAfterRefresh = false;
  if (!realtimeSeen) {
    await p2.reload({ waitUntil: 'domcontentloaded' });
    const boardTab2b = p2.getByRole('button', { name: /^Board$/i });
    if (await boardTab2b.isVisible().catch(() => false)) await boardTab2b.click();
    try {
      await p2.getByText(NEW_COLUMN, { exact: true }).first().waitFor({ timeout: 12000 });
      seenAfterRefresh = true;
      log('Window2 saw change after refresh');
    } catch {
      log('Window2 still missing change after refresh');
    }
  }

  await p1.screenshot({ path: './Screenshots/rt-diag-window1.png', fullPage: true });
  await p2.screenshot({ path: './Screenshots/rt-diag-window2.png', fullPage: true });

  console.log('RESULT_SUMMARY', JSON.stringify({
    user: EMAIL,
    projectUrl,
    newColumn: NEW_COLUMN,
    realtimeSeen,
    seenAfterRefresh,
    p1Url: p1.url(),
    p2Url: p2.url()
  }));
} catch (err) {
  console.error('RESULT_SUMMARY', JSON.stringify({ error: err?.message || String(err), p1Url: p1.url(), p2Url: p2.url() }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
