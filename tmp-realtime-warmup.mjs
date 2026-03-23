import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const EMAIL = `rt_warm_${Date.now()}@flowboard.test`;
const PASSWORD = 'Realtime#123';
const FULL_NAME = 'Realtime Warmup';
const PROJECT_NAME = `RT Warm ${Date.now()}`;
const PROJECT_DESC = 'Warmup run for realtime websocket verification.';
const COL1 = `RT_WARM_COL1_${Date.now()}`;
const COL2 = `RT_WARM_COL2_${Date.now()}`;

const browser = await chromium.launch({ headless: true });
const c1 = await browser.newContext();
const c2 = await browser.newContext();
const p1 = await c1.newPage();
const p2 = await c2.newPage();

const addColumn = async (page, title) => {
  await page.getByRole('button', { name: /Add Column/i }).click();
  await page.getByPlaceholder('Column name...').fill(title);
  await page.getByPlaceholder('Column name...').press('Enter');
};

try {
  await p1.goto(`${BASE}/register`);
  await p1.fill('#register-full-name', FULL_NAME);
  await p1.fill('#register-email', EMAIL);
  await p1.fill('#register-password', PASSWORD);
  await p1.fill('#register-confirm-password', PASSWORD);
  await p1.getByRole('button', { name: 'Create account' }).click();
  await p1.waitForURL(/\/$/);

  await p1.getByRole('button', { name: /Create New Project|Create Project/i }).first().click();
  await p1.waitForURL(/\/create-project$/);
  await p1.fill('#project-name', PROJECT_NAME);
  await p1.fill('#project-description', PROJECT_DESC);
  await p1.getByRole('button', { name: 'Create Empty Board' }).click();
  await p1.waitForURL(/\/project\/.+\?tab=board/);
  const projectUrl = p1.url();

  await p2.goto(`${BASE}/login`);
  await p2.fill('#login-email', EMAIL);
  await p2.fill('#login-password', PASSWORD);
  await p2.getByRole('button', { name: 'Sign in' }).click();
  await p2.waitForURL(/\/$/);

  await p1.goto(projectUrl);
  await p2.goto(projectUrl);

  const boardTab1 = p1.getByRole('button', { name: /^Board$/i });
  if (await boardTab1.isVisible().catch(() => false)) await boardTab1.click();
  const boardTab2 = p2.getByRole('button', { name: /^Board$/i });
  if (await boardTab2.isVisible().catch(() => false)) await boardTab2.click();

  await p1.waitForTimeout(8000);
  await p2.waitForTimeout(8000);

  await addColumn(p1, COL1);
  await p1.getByText(COL1, { exact: true }).waitFor({ timeout: 12000 });
  let col1Realtime = true;
  try {
    await p2.getByText(COL1, { exact: true }).waitFor({ timeout: 15000 });
  } catch {
    col1Realtime = false;
  }

  await p1.waitForTimeout(2500);
  await addColumn(p1, COL2);
  await p1.getByText(COL2, { exact: true }).waitFor({ timeout: 12000 });
  let col2Realtime = true;
  try {
    await p2.getByText(COL2, { exact: true }).waitFor({ timeout: 15000 });
  } catch {
    col2Realtime = false;
  }

  console.log('RESULT_WARMUP', JSON.stringify({ projectUrl, col1Realtime, col2Realtime, col1: COL1, col2: COL2 }));
} catch (err) {
  console.log('RESULT_WARMUP', JSON.stringify({ error: err?.message || String(err) }));
  process.exitCode = 1;
} finally {
  await browser.close();
}
