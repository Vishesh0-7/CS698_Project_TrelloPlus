import { chromium } from 'playwright';

const FRONTEND_BASES = (process.env.FRONTEND_BASES || '').trim();
const FRONTEND_BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:5173';
const BACKEND_BASE = process.env.BACKEND_BASE || 'http://127.0.0.1:8080/api/v1';
const USERS = Number(process.env.USERS || 10);
const PASSWORD = process.env.PASSWORD || 'StrongPass!123';
const USER_EMAIL_PREFIX = process.env.USER_EMAIL_PREFIX || 'p4_ui_user';
const USERNAME_PREFIX = process.env.USERNAME_PREFIX || 'p4_ui_user';
const FULL_NAME_PREFIX = process.env.FULL_NAME_PREFIX || 'P4 UI User';
const DEEP_WORKFLOW = (process.env.DEEP_WORKFLOW || 'true').toLowerCase() === 'true';
const DISTINCT_USERS = (process.env.DISTINCT_USERS || 'false').toLowerCase() === 'true';
const SETUP_USERS = (process.env.SETUP_USERS || 'true').toLowerCase() === 'true';
const PRESEED_ONLY = (process.env.PRESEED_ONLY || 'false').toLowerCase() === 'true';

const DEFAULT_FRONTEND_BASES = Array.from({ length: 10 }, (_, i) => `http://127.0.0.1:${5173 + i}`);
const FRONTEND_POOL = FRONTEND_BASES
  ? FRONTEND_BASES.split(',').map((base) => base.trim()).filter(Boolean)
  : DEFAULT_FRONTEND_BASES;

const FEATURE_ROUTES = [
  { path: '/', mustContain: 'Projects' },
  { path: '/meetings', mustContain: 'Meetings' },
  { path: '/create-project', mustContain: 'Create New Project' },
  { path: '/create-meeting', mustContain: 'Create New Meeting' },
  { path: '/profile', mustContain: 'Profile' },
  { path: '/settings', mustContain: 'Settings' },
];

const apiUrl = (path) => `${BACKEND_BASE}${path}`;

const userIdentity = (idx) => {
  const safeIdx = String(idx);
  return {
    email: `${USER_EMAIL_PREFIX}+${safeIdx}@example.com`,
    username: `${USERNAME_PREFIX}_${safeIdx}`,
    fullName: `${FULL_NAME_PREFIX} ${safeIdx}`,
    password: PASSWORD,
  };
};

const frontendForIndex = (idx) => {
  if (FRONTEND_POOL.length === 0) {
    return FRONTEND_BASE;
  }

  return FRONTEND_POOL[(idx - 1) % FRONTEND_POOL.length];
};

async function parseResponseOrThrow(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

async function ensureUsers() {
  const count = DISTINCT_USERS ? USERS : 1;
  const unavailableUsers = [];

  for (let i = 1; i <= count; i += 1) {
    const payload = userIdentity(i);
    await fetch(apiUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Ignore registration errors because user may already exist.
    });

    try {
      await loginViaApi(payload);
    } catch (error) {
      unavailableUsers.push({ index: i, error: String(error) });
    }
  }

  if (unavailableUsers.length > 0) {
    const details = unavailableUsers
      .map((entry) => `u${entry.index}:${entry.error}`)
      .join(' | ');
    throw new Error(`User setup incomplete (${unavailableUsers.length}/${count} unavailable). ${details}`);
  }
}

async function loginViaApi(identity) {
  const response = await fetch(apiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: identity.email, password: identity.password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API login failed (${response.status}): ${text}`);
  }

  return parseResponseOrThrow(response);
}

async function createProjectForSmoke(token, name) {
  const response = await fetch(apiUrl('/projects'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description: 'Parallel frontend smoke project',
      generateTasks: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Project setup failed (${response.status}): ${text}`);
  }

  return parseResponseOrThrow(response);
}

async function createMeetingForProject(token, projectId, title) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const meetingDate = tomorrow.toISOString().slice(0, 10);

  const response = await fetch(apiUrl('/meetings'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      title,
      description: 'Concurrent frontend workflow meeting',
      meetingDate,
      meetingTime: '10:00:00',
      platform: 'Zoom',
      meetingLink: 'https://example.com/room',
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meeting setup failed (${response.status}): ${text}`);
  }

  return parseResponseOrThrow(response);
}

async function endMeetingAndGenerateSummary(token, meetingId) {
  const endResponse = await fetch(apiUrl(`/meetings/${meetingId}/end`), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      meetingId,
      transcript: 'Discussed tasks, agreed priorities, approved follow-up implementation items.',
    }),
  });

  if (!endResponse.ok) {
    const text = await endResponse.text();
    throw new Error(`End meeting failed (${endResponse.status}): ${text}`);
  }

  const summaryResponse = await fetch(apiUrl('/summaries'), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ meetingId }),
  });

  if (!summaryResponse.ok) {
    const text = await summaryResponse.text();
    throw new Error(`Generate summary failed (${summaryResponse.status}): ${text}`);
  }
}

async function visitFeature(page, frontendBase, path, mustContain) {
  await page.goto(`${frontendBase}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 45000 });
  if (mustContain) {
    await page.getByText(mustContain, { exact: false }).first().waitFor({ timeout: 20000 });
  }
}

async function visitProjectView(page, frontendBase, path, projectName) {
  await page.goto(`${frontendBase}${path}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 45000 });

  const text = await page.locator('body').innerText();
  if (text.includes('Project not found')) {
    throw new Error(`Project view failed for ${path}`);
  }

  if (!text.includes(projectName)) {
    throw new Error(`Project name not visible on ${path}`);
  }
}

async function approveSummaryIfAvailable(page) {
  const approveSummaryButton = page.getByRole('button', { name: 'Approve Summary' });
  const isVisible = await approveSummaryButton.isVisible().catch(() => false);
  if (!isVisible) {
    return;
  }

  const isDisabled = await approveSummaryButton.isDisabled();
  if (isDisabled) {
    return;
  }

  await approveSummaryButton.click();
  await page.waitForLoadState('networkidle', { timeout: 45000 });
}

async function reviewChangesIfAvailable(page) {
  const reviewChangesButton = page.getByRole('button', { name: 'Review Changes' });
  const isVisible = await reviewChangesButton.isVisible().catch(() => false);
  if (!isVisible) {
    return;
  }

  await reviewChangesButton.click();
  await page.waitForLoadState('networkidle', { timeout: 45000 });

  const applyToBoardButton = page.getByRole('button', { name: 'Apply to Board' }).first();
  const applyVisible = await applyToBoardButton.isVisible().catch(() => false);
  if (!applyVisible) {
    return;
  }

  const applyDisabled = await applyToBoardButton.isDisabled();
  if (!applyDisabled) {
    await applyToBoardButton.click();
    await page.waitForLoadState('networkidle', { timeout: 45000 });
  }
}

async function runOne(browser, idx) {
  const frontendBase = frontendForIndex(idx);
  const identity = DISTINCT_USERS ? userIdentity(idx) : userIdentity(1);
  const context = await browser.newContext();
  const page = await context.newPage();
  const failedRequests = [];

  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!url.startsWith(BACKEND_BASE)) {
      return;
    }

    const errorText = request.failure()?.errorText || 'unknown';
    if (errorText.includes('ERR_ABORTED')) {
      return;
    }

    failedRequests.push(`${request.method()} ${url} -> ${errorText}`);
  });

  try {
    let projectId = null;
    let projectName = null;
    let meetingId = null;

    await page.goto(`${frontendBase}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#login-email', identity.email);
    await page.fill('#login-password', identity.password);
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/auth/login') && response.request().method() === 'POST',
      { timeout: 120000 },
    );
    await page.getByRole('button', { name: 'Sign in' }).click();

    const loginResponse = await loginResponsePromise;
    if (!loginResponse.ok()) {
      const bodyText = await loginResponse.text().catch(() => '');
      throw new Error(`UI login request failed (${loginResponse.status()}): ${bodyText.slice(0, 180)}`);
    }

    await page.waitForFunction(() => {
      return Boolean(localStorage.getItem('authToken')) || !window.location.pathname.endsWith('/login');
    }, null, { timeout: 120000 });

    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    if (!token) {
      throw new Error('Missing auth token in localStorage');
    }

    const smokeProject = await createProjectForSmoke(token, `P4 Frontend Concurrency ${Date.now()}-${idx}`);
    projectId = smokeProject.id;
    projectName = smokeProject.name;

    if (DEEP_WORKFLOW) {
      const meeting = await createMeetingForProject(token, smokeProject.id, `Concurrency Meeting ${idx}`);
      meetingId = meeting.id;
      await endMeetingAndGenerateSummary(token, meetingId);
    }

    for (const feature of FEATURE_ROUTES) {
      await visitFeature(page, frontendBase, feature.path, feature.mustContain);
    }

    await visitProjectView(page, frontendBase, `/project/${projectId}?tab=board`, projectName);
    await visitProjectView(page, frontendBase, `/project/${projectId}?tab=meetings`, projectName);
    await visitProjectView(page, frontendBase, `/project/${projectId}?tab=decisions`, projectName);

    if (DEEP_WORKFLOW && meetingId) {
      await visitFeature(page, frontendBase, `/meeting-transcript/${meetingId}`, 'Meeting Transcript');
      await visitFeature(page, frontendBase, `/meetings/${meetingId}`, 'Approvals');
      await approveSummaryIfAvailable(page);
      await reviewChangesIfAvailable(page);
    }

    if (failedRequests.length > 0) {
      throw new Error(`Network/API failures: ${failedRequests.slice(0, 5).join(' | ')}`);
    }

    return { idx, ok: true, frontendBase, projectId, meetingId };
  } catch (error) {
    return { idx, ok: false, frontendBase, error: String(error) };
  } finally {
    await context.close();
  }
}

async function main() {
  if (SETUP_USERS || PRESEED_ONLY) {
    await ensureUsers();
    console.log(`USER_SETUP_DONE=true`);
  } else {
    console.log(`USER_SETUP_DONE=false`);
  }

  if (PRESEED_ONLY) {
    console.log('PRESEED_ONLY_DONE=true');
    return;
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const jobs = Array.from({ length: USERS }, (_, i) => runOne(browser, i + 1));
    const results = await Promise.all(jobs);

    const okCount = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);

    console.log(`FRONTEND_PARALLEL_USERS=${USERS}`);
    console.log(`FRONTEND_POOL_SIZE=${FRONTEND_POOL.length}`);
    console.log(`FRONTEND_POOL=${FRONTEND_POOL.join(',')}`);
    console.log(`DEEP_WORKFLOW=${DEEP_WORKFLOW}`);
    console.log(`DISTINCT_USERS=${DISTINCT_USERS}`);
    console.log(`SETUP_USERS=${SETUP_USERS}`);
    console.log(`FRONTEND_SCENARIO_OK=${okCount}`);
    console.log(`FRONTEND_SCENARIO_FAIL=${failed.length}`);

    const succeeded = results.filter((r) => r.ok);
    if (succeeded.length > 0) {
      console.log(`SUCCESS_PROJECT_IDS=${succeeded.map((r) => r.projectId).filter(Boolean).join(',')}`);
      console.log(`SUCCESS_MEETING_IDS=${succeeded.map((r) => r.meetingId).filter(Boolean).join(',')}`);
    }

    if (failed.length > 0) {
      for (const f of failed) {
        console.log(`FAIL_USER_${f.idx}_${f.frontendBase}=${f.error}`);
      }
      process.exit(1);
    }

    console.log('FRONTEND_CONCURRENCY_RESULT=PASS');
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('FRONTEND_CONCURRENCY_RESULT=FAIL');
  console.error(error);
  process.exit(1);
});
