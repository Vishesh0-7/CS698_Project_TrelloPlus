import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const EMAIL = `rt_${Date.now()}@flowboard.test`;
const PASSWORD = 'Realtime#123';
const FULL_NAME = 'Realtime Tester';
const PROJECT_NAME = `RT Project ${Date.now()}`;
const PROJECT_DESC = 'This project validates real time board synchronization across two browser windows.';
const NEW_COLUMN = `RT_COL_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const ctx1 = await browser.newContext();
const ctx2 = await browser.newContext();
const p1 = await ctx1.newPage();
const p2 = await ctx2.newPage();

const log = (...args) => console.log('[RT-TEST]', ...args);

async function registerFirstWindow() {
  await p1.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
  await p1.fill('#register-full-name', FULL_NAME);
  await p1.fill('#register-email', EMAIL);
  await p1.fill('#register-password', PASSWORD);
  await p1.fill('#register-confirm-password', PASSWORD);
  await p1.getByRole('button', { name: 'Create account' }).click();
  await p1.waitForURL(/\/$/, { timeout: 20000 });
  log('Registered and logged in window 1 as', EMAIL);
}

async function createProjectInWindow1() {
  const createBtn = p1.getByRole('button', { name: /Create New Project|Create Project/i }).first();
  await createBtn.click();
  await p1.waitForURL(/\/create-project$/, { timeout: 20000 });

  await p1.fill('#project-name', PROJECT_NAME);
  await p1.fill('#project-description', PROJECT_DESC);
  await p1.getByRole('button', { name: 'Create Empty Board' }).click();

  await p1.waitForURL(/\/project\/.+\?tab=board/, { timeout: 25000 });
  const projectUrl = p1.url();
  log('Created project, board URL:', projectUrl);
  return projectUrl;
}

async function loginSecondWindow() {
  await p2.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await p2.fill('#login-email', EMAIL);
  await p2.fill('#login-password', PASSWORD);
  await p2.getByRole('button', { name: 'Sign in' }).click();
  await p2.waitForURL(/\/$/, { timeout: 20000 });
  log('Logged in window 2 as same user');
}

async function verifyRealtime(projectUrl) {
  await p2.goto(projectUrl, { waitUntil: 'domcontentloaded' });
  await p1.goto(projectUrl, { waitUntil: 'domcontentloaded' });

  const boardTab1 = p1.getByRole('button', { name: /^Board$/i });
  if (await boardTab1.isVisible().catch(() => false)) {
    await boardTab1.click();
  }
  const boardTab2 = p2.getByRole('button', { name: /^Board$/i });
  if (await boardTab2.isVisible().catch(() => false)) {
    await boardTab2.click();
  }

  await p1.getByRole('button', { name: /Add Column/i }).click();
  const input = p1.getByPlaceholder('Column name...');
  await input.fill(NEW_COLUMN);
  await input.press('Enter');

  await p1.getByText(NEW_COLUMN, { exact: true }).waitFor({ timeout: 15000 });
  log('Window 1 created column:', NEW_COLUMN);

  await p2.getByText(NEW_COLUMN, { exact: true }).waitFor({ timeout: 20000 });
  log('Window 2 received realtime update for column:', NEW_COLUMN);
}

try {
  await registerFirstWindow();
  const projectUrl = await createProjectInWindow1();
  await loginSecondWindow();
  await verifyRealtime(projectUrl);

  console.log('\nRESULT: REALTIME_SYNC_PASS');
  console.log(`User: ${EMAIL}`);
  console.log(`Project: ${PROJECT_NAME}`);
  console.log(`Change observed in both windows: ${NEW_COLUMN}`);
} catch (err) {
  console.error('\nRESULT: REALTIME_SYNC_FAIL');
  console.error(err?.message || err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
