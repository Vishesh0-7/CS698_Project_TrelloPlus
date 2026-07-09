import { chromium } from 'playwright';

function firstNonEmptyEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === 'string' && value.trim() !== '') {
      return value;
    }
  }

  return undefined;
}

const FRONTEND_BASE = firstNonEmptyEnv('FRONTEND_BASE', 'INTEGRATION_FRONTEND_BASE') || 'http://127.0.0.1:5173';
const BACKEND_BASE = firstNonEmptyEnv('BACKEND_BASE', 'INTEGRATION_BACKEND_BASE') || 'http://127.0.0.1:8080/api/v1';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'StrongPass!123';
const TEST_EMAIL_PREFIX = process.env.TEST_EMAIL_PREFIX || 'fullstack.integration';
const TEST_FULL_NAME_PREFIX = process.env.TEST_FULL_NAME_PREFIX || 'Fullstack Integration';
const PRIMARY_TEST_EMAIL = process.env.PRIMARY_TEST_EMAIL || '';
const PRIMARY_TEST_PASSWORD = process.env.PRIMARY_TEST_PASSWORD || TEST_PASSWORD;
const CREATE_PRIMARY_USER_EACH_RUN = (process.env.CREATE_PRIMARY_USER_EACH_RUN || 'true').toLowerCase() === 'true';
const HEADLESS = (process.env.HEADLESS || 'true').toLowerCase() === 'true';
const RUN_AI_CASES = (firstNonEmptyEnv('RUN_AI_CASES', 'INTEGRATION_RUN_AI_CASES') || 'false').toLowerCase() === 'true';
const CLEANUP = (process.env.CLEANUP || 'true').toLowerCase() === 'true';
const RUN_DEPLOYMENT_ONLY_CASES = (firstNonEmptyEnv('RUN_DEPLOYMENT_ONLY_CASES', 'INTEGRATION_DEPLOYMENT_ONLY_CASES') || 'false').toLowerCase() === 'true';
const AUTH_RETRY_ATTEMPTS = Number(process.env.AUTH_RETRY_ATTEMPTS || 12);
const AUTH_RETRY_DELAY_MS = Number(process.env.AUTH_RETRY_DELAY_MS || 2000);

function isLocalHostBase(value) {
  try {
    const parsed = new URL(value);
    return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

const IS_LOCAL_ENV = isLocalHostBase(FRONTEND_BASE) || isLocalHostBase(BACKEND_BASE);
const SHOULD_RUN_DEPLOYMENT_ONLY_CASES = RUN_DEPLOYMENT_ONLY_CASES || !IS_LOCAL_ENV;

const state = {
  primaryIdentity: null,
  secondaryIdentity: null,
  token: '',
  createdProjectId: '',
  createdProjectName: '',
  createdMeetingId: '',
  createdMeetingTitle: '',
  cleanupProjectIds: new Set(),
  cleanupMeetingIds: new Set(),
  lastSummaryGeneratedMeetingId: '',
};

function nowStamp() {
  return Date.now();
}

function newIdentity(tag = 'user') {
  const id = `${tag}.${nowStamp()}.${Math.floor(Math.random() * 10000)}`;
  return {
    email: `${TEST_EMAIL_PREFIX}+${id}@example.com`,
    fullName: `${TEST_FULL_NAME_PREFIX} ${id}`,
    password: TEST_PASSWORD,
  };
}

function apiUrl(path) {
  return `${BACKEND_BASE}${path}`;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function authBackoffMs(attempt) {
  return Math.min(AUTH_RETRY_DELAY_MS * (2 ** (attempt - 1)), 30000);
}

async function parseBody(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return response.json();
}

async function apiRequest(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  const body = await parseBody(response).catch(() => null);
  return { response, body };
}

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function nextDate(days = 1) {
  const dt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return dt.toISOString().slice(0, 10);
}

function shortTimeNowPlusMinutes(minutes = 10) {
  const dt = new Date(Date.now() + minutes * 60 * 1000);
  const h = String(dt.getHours()).padStart(2, '0');
  const m = String(dt.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

async function ensureRegistered(identity) {
  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt += 1) {
    const { response } = await apiRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identity),
    });

    if (response.ok || [400, 409].includes(response.status)) {
      return;
    }

    if (response.status === 429 && attempt < AUTH_RETRY_ATTEMPTS) {
      await delay(authBackoffMs(attempt));
      continue;
    }

    throw new Error(`Register failed unexpectedly (${response.status}) for ${identity.email}`);
  }
}

async function registerFreshIdentity(identity) {
  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt += 1) {
    const { response } = await apiRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identity),
    });

    if (response.ok) {
      return;
    }

    if ([429, 500, 502, 503, 504].includes(response.status) && attempt < AUTH_RETRY_ATTEMPTS) {
      await delay(authBackoffMs(attempt));
      continue;
    }

    throw new Error(`Fresh register failed (${response.status}) for ${identity.email}`);
  }
}

async function loginViaApi(identity) {
  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt += 1) {
    const { response, body } = await apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: identity.email, password: identity.password }),
    });

    if (response.ok && body?.token) {
      return body;
    }

    if (response.status === 429 && attempt < AUTH_RETRY_ATTEMPTS) {
      await delay(authBackoffMs(attempt));
      continue;
    }

    const text = body ? JSON.stringify(body) : await response.text();
    throw new Error(`API login failed (${response.status}): ${text}`);
  }

  throw new Error('API login failed unexpectedly after retries');
}

async function ensurePrimaryIdentityAndToken() {
  if (!state.primaryIdentity) {
    if (CREATE_PRIMARY_USER_EACH_RUN) {
      state.primaryIdentity = newIdentity('primary');
      await registerFreshIdentity(state.primaryIdentity);
    } else if (PRIMARY_TEST_EMAIL) {
      state.primaryIdentity = {
        email: PRIMARY_TEST_EMAIL,
        fullName: 'Primary Test User',
        password: PRIMARY_TEST_PASSWORD,
      };
    } else {
      state.primaryIdentity = newIdentity('primary');
      await ensureRegistered(state.primaryIdentity);
    }
  }

  const login = await loginViaApi(state.primaryIdentity);
  state.token = login.token;
}

async function ensureSecondaryIdentity() {
  if (!state.secondaryIdentity) {
    state.secondaryIdentity = newIdentity('secondary');
    await registerFreshIdentity(state.secondaryIdentity);
  }

  return state.secondaryIdentity;
}

async function listProjects(token = state.token) {
  const { response, body } = await apiRequest('/projects', {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok || !Array.isArray(body)) {
    throw new Error(`Failed to list projects (${response.status})`);
  }

  return body;
}

async function createProjectApi(token, { name, description, generateTasks }) {
  const { response, body } = await apiRequest('/projects', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ name, description, generateTasks }),
  });

  if (!response.ok || !body?.id) {
    const text = body ? JSON.stringify(body) : await response.text();
    throw new Error(`Project creation failed (${response.status}): ${text}`);
  }

  state.cleanupProjectIds.add(body.id);
  return body;
}

async function ensureProjectForPrimaryUser() {
  await ensurePrimaryIdentityAndToken();

  if (state.createdProjectId) {
    return { id: state.createdProjectId, name: state.createdProjectName };
  }

  const projectName = `INT Project ${nowStamp()}`;
  const created = await createProjectApi(state.token, {
    name: projectName,
    description: 'Project created as shared setup for fullstack integration tests.',
    generateTasks: false,
  });

  state.createdProjectId = created.id;
  state.createdProjectName = created.name || projectName;
  return { id: state.createdProjectId, name: state.createdProjectName };
}

async function createMeetingApi(token, payload) {
  const { response, body } = await apiRequest('/meetings', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

  if (!response.ok || !body?.id) {
    const text = body ? JSON.stringify(body) : await response.text();
    throw new Error(`Meeting creation failed (${response.status}): ${text}`);
  }

  state.cleanupMeetingIds.add(body.id);
  return body;
}

async function listProjectMeetings(token, projectId) {
  const { response, body } = await apiRequest(`/meetings/project/${projectId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok || !Array.isArray(body)) {
    throw new Error(`Failed to list project meetings (${response.status})`);
  }

  return body;
}

async function ensureMeetingForPrimaryUser() {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  if (state.createdMeetingId) {
    return { id: state.createdMeetingId, title: state.createdMeetingTitle, projectId: project.id };
  }

  const title = `INT Meeting ${nowStamp()}`;
  const meeting = await createMeetingApi(state.token, {
    projectId: project.id,
    title,
    description: 'Meeting setup for integration tests',
    meetingDate: nextDate(1),
    meetingTime: '10:00:00',
    platform: 'Zoom',
    meetingLink: 'https://example.com/test-meeting',
  });

  state.createdMeetingId = meeting.id;
  state.createdMeetingTitle = meeting.title || title;

  return { id: state.createdMeetingId, title: state.createdMeetingTitle, projectId: project.id };
}

async function cleanupArtifacts() {
  if (!CLEANUP || !state.token) {
    return;
  }

  for (const meetingId of state.cleanupMeetingIds) {
    await apiRequest(`/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` },
    }).catch(() => {
      // Best-effort cleanup.
    });
  }

  for (const projectId of state.cleanupProjectIds) {
    await apiRequest(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${state.token}` },
    }).catch(() => {
      // Best-effort cleanup.
    });
  }
}

async function loginViaUi(page, identity) {
  await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });

  for (let attempt = 1; attempt <= AUTH_RETRY_ATTEMPTS; attempt += 1) {
    await page.fill('#login-email', identity.email);
    await page.fill('#login-password', identity.password);

    const loginResponsePromise = waitForApiResponse(page, '/auth/login', 'POST');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const loginResponse = await loginResponsePromise;

    if (loginResponse.ok()) {
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });
      return;
    }

    if (loginResponse.status() === 429 && attempt < AUTH_RETRY_ATTEMPTS) {
      await delay(authBackoffMs(attempt));
      continue;
    }

    const text = await loginResponse.text().catch(() => '');
    throw new Error(`UI login failed (${loginResponse.status()}): ${text}`);
  }
}

async function waitForApiResponse(page, urlContains, method = 'GET', timeout = 45000) {
  const response = await page.waitForResponse(
    (r) => r.url().includes(urlContains) && r.request().method() === method,
    { timeout },
  );

  return response;
}

async function withNewPage(browser, fn) {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    return await fn(page);
  } finally {
    await context.close();
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function pathIncludes(page, text) {
  return page.url().includes(text);
}

function shouldSkipDeploymentOnlyCase() {
  return !SHOULD_RUN_DEPLOYMENT_ONLY_CASES;
}

function deploymentOnlySkipResult(reason = 'deployment-only case disabled for localhost') {
  return { skipped: true, reason };
}

// INT-001-IT-01
async function test_INT_001_IT_01(browser) {
  const identity = newIdentity('reg-happy');

  // Setup
  // - Fresh identity created above.
  return withNewPage(browser, async (page) => {
    // Execution
    await page.goto(`${FRONTEND_BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#register-full-name', identity.fullName);
    await page.fill('#register-email', identity.email);
    await page.fill('#register-password', identity.password);
    await page.fill('#register-confirm-password', identity.password);

    const registerResponsePromise = waitForApiResponse(page, '/auth/register', 'POST');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Assertions
    const registerResponse = await registerResponsePromise;
    assert(registerResponse.ok(), `Expected 2xx register response, got ${registerResponse.status()}`);

    const skipSecurityQuestions = page.getByRole('button', { name: 'Skip for now' });
    if (await skipSecurityQuestions.isVisible({ timeout: 5000 }).catch(() => false)) {
      await skipSecurityQuestions.click();
    }

    await page.waitForURL((url) => !url.pathname.includes('/register'), { timeout: 45000 });

    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    const user = await page.evaluate(() => localStorage.getItem('user'));
    assert(Boolean(token), 'Expected authToken in localStorage after registration');
    assert(Boolean(user), 'Expected user in localStorage after registration');

    // Reuse this successfully registered user for later auth-dependent cases.
    state.secondaryIdentity = identity;
  });
}

// INT-001-EC-02
async function test_INT_001_EC_02(browser) {
  return withNewPage(browser, async (page) => {
    // Setup
    await page.goto(`${FRONTEND_BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Execution
    await page.fill('#register-full-name', 'Invalid Email User');
    await page.fill('#register-email', 'invalid-email-format');
    await page.fill('#register-password', TEST_PASSWORD);
    await page.fill('#register-confirm-password', TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Assertions
    const stillOnRegister = await pathIncludes(page, '/register');
    assert(stillOnRegister, 'Expected to remain on register page for invalid email');
  });
}

// INT-001-EC-03
async function test_INT_001_EC_03(browser) {
  const identity = newIdentity('reg-mismatch');

  return withNewPage(browser, async (page) => {
    // Setup
    await page.goto(`${FRONTEND_BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Execution
    await page.fill('#register-full-name', identity.fullName);
    await page.fill('#register-email', identity.email);
    await page.fill('#register-password', TEST_PASSWORD);
    await page.fill('#register-confirm-password', `${TEST_PASSWORD}x`);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Assertions
    const stillOnRegister = await pathIncludes(page, '/register');
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    assert(stillOnRegister, 'Expected to remain on register page on password mismatch');
    assert(!token, 'Expected no auth token when password mismatch occurs');
  });
}

// INT-001-EC-04
async function test_INT_001_EC_04() {
  const identity = await ensureSecondaryIdentity();

  // Execution
  const { response } = await apiRequest('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(identity),
  });

  // Assertions
  assert(response.status >= 400, `Expected duplicate register to fail with 4xx, got ${response.status}`);
}

// INT-001-EC-05
async function test_INT_001_EC_05(browser) {
  const identity = newIdentity('reg-5xx');

  return withNewPage(browser, async (page) => {
    // Setup
    await page.route('**/auth/register', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced error"}' });
    });

    await page.goto(`${FRONTEND_BASE}/register`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#register-full-name', identity.fullName);
    await page.fill('#register-email', identity.email);
    await page.fill('#register-password', identity.password);
    await page.fill('#register-confirm-password', identity.password);

    // Execution
    await page.getByRole('button', { name: 'Create account' }).click();

    // Assertions
    await page.waitForTimeout(300);
    const stillOnRegister = await pathIncludes(page, '/register');
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    assert(stillOnRegister, 'Expected register page to remain on backend failure');
    assert(!token, 'Expected no auth token when register API fails');
  });
}

// INT-002-IT-01
async function test_INT_002_IT_01(browser) {
  const identity = await ensureSecondaryIdentity();

  return withNewPage(browser, async (page) => {
    // Execution
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#login-email', identity.email);
    await page.fill('#login-password', identity.password);

    const loginResponsePromise = waitForApiResponse(page, '/auth/login', 'POST');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assertions
    const loginResponse = await loginResponsePromise;
    assert(loginResponse.ok(), `Expected successful login response, got ${loginResponse.status()}`);
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });

    const projectsResp = await waitForApiResponse(page, '/projects', 'GET');
    assert(projectsResp.ok(), `Expected projects fetch success after login, got ${projectsResp.status()}`);
  });
}

// INT-002-EC-02
async function test_INT_002_EC_02(browser) {
  return withNewPage(browser, async (page) => {
    // Setup
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Execution
    await page.fill('#login-email', 'not-an-email');
    await page.fill('#login-password', TEST_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assertions
    const stillOnLogin = await pathIncludes(page, '/login');
    assert(stillOnLogin, 'Expected to remain on login page for malformed email');
  });
}

// INT-002-EC-03
async function test_INT_002_EC_03(browser) {
  const identity = await ensureSecondaryIdentity();

  return withNewPage(browser, async (page) => {
    // Setup
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Execution
    await page.fill('#login-email', identity.email);
    await page.fill('#login-password', `${identity.password}x`);
    const loginResponsePromise = waitForApiResponse(page, '/auth/login', 'POST');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assertions
    const loginResponse = await loginResponsePromise;
    assert(loginResponse.status() === 401 || loginResponse.status() === 403, `Expected unauthorized login, got ${loginResponse.status()}`);
    const stillOnLogin = await pathIncludes(page, '/login');
    assert(stillOnLogin, 'Expected to remain on login page for invalid credentials');
  });
}

// INT-002-EC-04
async function test_INT_002_EC_04(browser) {
  const identity = newIdentity('login-5xx');
  await ensureRegistered(identity);

  return withNewPage(browser, async (page) => {
    // Setup
    await page.route('**/auth/login', async (route) => {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced failure"}' });
    });
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Execution
    await page.fill('#login-email', identity.email);
    await page.fill('#login-password', identity.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Assertions
    await page.waitForTimeout(250);
    const stillOnLogin = await pathIncludes(page, '/login');
    assert(stillOnLogin, 'Expected to remain on login page when backend fails');
  });
}

// INT-003-IT-01
async function test_INT_003_IT_01(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/logout`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 45000 });

    // Assertions
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    const user = await page.evaluate(() => localStorage.getItem('user'));
    assert(!token && !user, 'Expected auth storage keys cleared after logout');
  });
}

// INT-003-EC-02
async function test_INT_003_EC_02(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.route('**/auth/logout', async (route) => {
      await route.abort();
    });

    // Execution
    await page.goto(`${FRONTEND_BASE}/logout`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 45000 });

    // Assertions
    const token = await page.evaluate(() => localStorage.getItem('authToken'));
    assert(!token, 'Expected local token cleared even if logout API fails');
  });
}

// INT-003-IT-03
async function test_INT_003_IT_03(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.goto(`${FRONTEND_BASE}/logout`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 45000 });

    // Execution
    await page.goto(`${FRONTEND_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 45000 });
  });
}

// INT-004-IT-01
async function test_INT_004_IT_01(browser) {
  await ensurePrimaryIdentityAndToken();
  const identity = state.primaryIdentity;
  const projectName = `INT Empty Board ${nowStamp()}`;

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, identity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/create-project`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#project-name', projectName);
    await page.fill('#project-description', 'Create empty board integration test');

    const createRespPromise = waitForApiResponse(page, '/projects', 'POST');
    await page.getByRole('button', { name: 'Create Empty Board' }).click();

    // Assertions
    const createResp = await createRespPromise;
    assert(createResp.ok(), `Expected project creation success, got ${createResp.status()}`);

    const body = await createResp.json().catch(() => null);
    assert(Boolean(body?.id), 'Expected project id in create response');
    state.cleanupProjectIds.add(body.id);

    // Local navigation can be delayed; API-level persistence is the strict integration check.
    await page.waitForTimeout(500);

    const login = await loginViaApi(identity);
    const projects = await listProjects(login.token);
    assert(projects.some((p) => p.id === body.id), 'Expected created project in GET /projects list');
  });
}

// INT-004-IT-02
async function test_INT_004_IT_02(browser) {
  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();
  const projectName = `INT AI Board ${nowStamp()}`;

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.goto(`${FRONTEND_BASE}/create-project`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#project-name', projectName);
    await page.fill('#project-description', 'Build an analytics product with roadmap milestones and engineering tasks for multiple teams.');

    // Execution
    const createRespPromise = waitForApiResponse(page, '/projects', 'POST', 120000);
    await page.getByRole('button', { name: 'Generate AI Board' }).click();

    // Assertions
    const createResp = await createRespPromise;
    assert(createResp.ok(), `Expected AI project create success, got ${createResp.status()}`);

    const body = await createResp.json().catch(() => null);
    assert(Boolean(body?.id), 'Expected AI create to return project id');
    state.cleanupProjectIds.add(body.id);

    const previewVisible = await page.getByText('AI Board Generated Successfully').isVisible().catch(() => false);
    assert(previewVisible, 'Expected AI preview modal after generateTasks=true flow');
  });
}

// INT-004-EC-03
async function test_INT_004_EC_03(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.goto(`${FRONTEND_BASE}/create-project`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Execution
    await page.fill('#project-name', '');
    await page.fill('#project-description', 'A valid description with multiple words included.');
    await page.getByRole('button', { name: 'Create Empty Board' }).click();

    // Assertions
    const url = page.url();
    assert(url.includes('/create-project'), 'Expected to remain on create project page when name is blank');
  });
}

// INT-004-EC-04
async function test_INT_004_EC_04() {
  await ensurePrimaryIdentityAndToken();

  // Setup + Execution
  const { response } = await apiRequest('/projects', {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({ name: '', description: 'Invalid', generateTasks: false }),
  });

  // Assertions
  assert(response.status >= 400, `Expected backend validation 4xx for invalid project payload, got ${response.status}`);
}

// INT-004-EC-05
async function test_INT_004_EC_05(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.route('**/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced create failure"}' });
        return;
      }
      await route.continue();
    });

    await page.goto(`${FRONTEND_BASE}/create-project`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#project-name', `Failing Project ${nowStamp()}`);
    await page.fill('#project-description', 'Description for failure-path test');

    // Execution
    await page.getByRole('button', { name: 'Create Empty Board' }).click();

    // Assertions
    await page.waitForTimeout(300);
    assert(page.url().includes('/create-project'), 'Expected to remain on create-project after backend failure');
  });
}

// INT-005-IT-01
async function test_INT_005_IT_01(browser) {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    await page.getByText(project.name, { exact: false }).first().waitFor({ timeout: 45000 });
  });
}

// INT-005-IT-02
async function test_INT_005_IT_02(browser) {
  const identity = await ensureSecondaryIdentity();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, identity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    await page.getByText('No projects yet', { exact: false }).first().waitFor({ timeout: 45000 });
  });
}

// INT-005-EC-03
async function test_INT_005_EC_03(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.route('**/projects', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced dashboard failure"}' });
        return;
      }
      await route.continue();
    });

    // Execution
    await page.goto(`${FRONTEND_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    await page.waitForTimeout(500);
    const hasContent = await page.locator('body').isVisible();
    assert(hasContent, 'Expected dashboard page to remain stable on backend failure');
  });
}

// INT-005-EC-04
async function test_INT_005_EC_04(browser) {
  await ensurePrimaryIdentityAndToken();

  return withNewPage(browser, async (page) => {
    // Setup
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.fill('#login-email', state.primaryIdentity.email);
    await page.fill('#login-password', state.primaryIdentity.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 45000 });

    await page.evaluate(() => {
      localStorage.setItem('authToken', 'invalid.token.value');
    });

    // Execution
    const projectsRespPromise = waitForApiResponse(page, '/projects', 'GET');
    await page.goto(`${FRONTEND_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    const response = await projectsRespPromise;
    assert([401, 403].includes(response.status()), `Expected unauthorized dashboard fetch, got ${response.status()}`);
  });
}

// INT-006-IT-01
async function test_INT_006_IT_01(browser) {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();
  const meetingTitle = `INT Create Meeting ${nowStamp()}`;

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/create-meeting`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.selectOption('#project', project.id);
    await page.fill('#title', meetingTitle);
    await page.fill('#date', nextDate(1));
    await page.fill('#time', '10:00');
    await page.fill('#agenda', 'Integration meeting agenda');
    await page.fill('#platform', 'Zoom');
    await page.fill('#link', 'https://example.com/int-meeting');

    const createRespPromise = waitForApiResponse(page, '/meetings', 'POST');
    await page.getByRole('button', { name: 'Create Meeting' }).click();

    // Assertions
    const createResp = await createRespPromise;
    assert(createResp.ok(), `Expected meeting create success, got ${createResp.status()}`);

    const meetings = await listProjectMeetings(state.token, project.id);
    const created = meetings.find((m) => m.title === meetingTitle);
    assert(Boolean(created?.id), 'Expected created meeting in project meetings list');

    state.cleanupMeetingIds.add(created.id);
    state.createdMeetingId = created.id;
    state.createdMeetingTitle = created.title;
  });
}

// INT-006-EC-02
async function test_INT_006_EC_02(browser) {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.goto(`${FRONTEND_BASE}/create-meeting`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.selectOption('#project', project.id);

    // Execution
    await page.fill('#title', '');
    await page.fill('#date', nextDate(1));
    await page.fill('#time', '10:00');
    await page.getByRole('button', { name: 'Create Meeting' }).click();

    // Assertions
    await page.waitForTimeout(250);
    assert(page.url().includes('/create-meeting'), 'Expected to remain on create-meeting for missing title');
  });
}

// INT-006-EC-03
async function test_INT_006_EC_03() {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  // Setup + Execution
  const { response } = await apiRequest('/meetings', {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({
      projectId: project.id,
      title: `Past Meeting ${nowStamp()}`,
      description: 'Invalid schedule',
      meetingDate: nextDate(-1),
      meetingTime: '09:00:00',
      platform: 'Zoom',
      meetingLink: 'https://example.com/past',
    }),
  });

  // Assertions
  assert(response.status >= 400 && response.status < 500, `Expected 4xx for past meeting, got ${response.status}`);
}

// INT-006-EC-04
async function test_INT_006_EC_04(browser) {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.route('**/meetings', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced meeting failure"}' });
        return;
      }
      await route.continue();
    });

    await page.goto(`${FRONTEND_BASE}/create-meeting`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.selectOption('#project', project.id);
    await page.fill('#title', `Failure Meeting ${nowStamp()}`);
    await page.fill('#date', nextDate(1));
    await page.fill('#time', '10:00');

    // Execution
    await page.getByRole('button', { name: 'Create Meeting' }).click();

    // Assertions
    await page.waitForTimeout(300);
    assert(page.url().includes('/create-meeting'), 'Expected to remain on create-meeting when backend create fails');
  });
}

// INT-006-IT-05
async function test_INT_006_IT_05() {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  // Setup + Execution
  const meeting = await createMeetingApi(state.token, {
    projectId: project.id,
    title: `No Extra Members ${nowStamp()}`,
    description: 'Meeting without additionalMemberIds',
    meetingDate: nextDate(1),
    meetingTime: '11:00:00',
    platform: 'Zoom',
    meetingLink: 'https://example.com/no-extra-members',
  });

  // Assertions
  assert(Boolean(meeting.id), 'Expected meeting id from create meeting without additional members');

  const meetings = await listProjectMeetings(state.token, project.id);
  assert(meetings.some((m) => m.id === meeting.id), 'Expected meeting persisted even without additional member ids');
}

// INT-007-IT-01
async function test_INT_007_IT_01(browser) {
  if (!RUN_AI_CASES) {
    return { skipped: true, reason: 'RUN_AI_CASES=false' };
  }

  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();
  const meeting = await ensureMeetingForPrimaryUser();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/meeting-transcript/${meeting.id}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByPlaceholder('Paste your meeting transcript here...').fill('Discussed roadmap, accepted action items, and approved implementation plan.');

    const endRespPromise = waitForApiResponse(page, `/meetings/${meeting.id}/end`, 'POST', 120000);
    const summaryRespPromise = waitForApiResponse(page, '/summaries', 'POST', 120000);
    await page.getByRole('button', { name: 'Generate Summary & Approval Items' }).click();

    // Assertions
    const endResp = await endRespPromise;
    const summaryResp = await summaryRespPromise;
    assert(endResp.ok(), `Expected meeting end success, got ${endResp.status()}`);
    assert(summaryResp.ok(), `Expected summary generation success, got ${summaryResp.status()}`);
    await page.waitForURL((url) => url.pathname.includes(`/meetings/${meeting.id}`), { timeout: 120000 });

    state.lastSummaryGeneratedMeetingId = meeting.id;
  });
}

// INT-007-EC-02
async function test_INT_007_EC_02(browser) {
  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();
  const meeting = await ensureMeetingForPrimaryUser();

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);
    await page.route('**/summaries', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"forced summary failure"}' });
        return;
      }
      await route.continue();
    });

    // Execution
    await page.goto(`${FRONTEND_BASE}/meeting-transcript/${meeting.id}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.getByPlaceholder('Paste your meeting transcript here...').fill('Transcript for forced summary failure case.');
    await page.getByRole('button', { name: 'Generate Summary & Approval Items' }).click();

    // Assertions
    await page.waitForTimeout(500);
    assert(page.url().includes(`/meeting-transcript/${meeting.id}`), 'Expected to remain on transcript page when summary generation fails');
  });
}

// INT-007-EC-03
async function test_INT_007_EC_03(browser) {
  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();

  const project = await ensureProjectForPrimaryUser();
  const { response, body } = await apiRequest('/meetings', {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({
      projectId: project.id,
      title: `Already Ended ${nowStamp()}`,
      description: 'Will be ended before transcript action',
      meetingDate: nextDate(1),
      meetingTime: '12:00:00',
      platform: 'Zoom',
      meetingLink: 'https://example.com/ended',
    }),
  });
  assert(response.ok && body?.id, `Expected setup meeting creation success, got ${response.status}`);
  state.cleanupMeetingIds.add(body.id);

  await apiRequest(`/meetings/${body.id}/end`, {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({ meetingId: body.id, transcript: 'Initial ending transcript.' }),
  });

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/meeting-transcript/${body.id}`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    const button = page.getByRole('button', { name: 'Generate Summary & Approval Items' });
    const disabled = await button.isDisabled();
    assert(disabled, 'Expected summary generation button disabled for non-scheduled meeting');
  });
}

// INT-008-IT-01
async function test_INT_008_IT_01(browser) {
  if (!RUN_AI_CASES) {
    return { skipped: true, reason: 'RUN_AI_CASES=false' };
  }

  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();

  if (!state.lastSummaryGeneratedMeetingId) {
    const run = await test_INT_007_IT_01(browser);
    if (run?.skipped) {
      return run;
    }
  }

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/meetings/${state.lastSummaryGeneratedMeetingId}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const approveButton = page.getByRole('button', { name: 'Approve Summary' });
    const isVisible = await approveButton.isVisible().catch(() => false);
    assert(isVisible, 'Expected approve summary button visible');

    if (await approveButton.isDisabled()) {
      return { skipped: true, reason: 'Approval already submitted in current environment state' };
    }

    const approveRespPromise = waitForApiResponse(page, `/summaries/${state.lastSummaryGeneratedMeetingId}/approve`, 'POST', 120000);
    await approveButton.click();

    // Assertions
    const approveResp = await approveRespPromise;
    assert(approveResp.ok(), `Expected approve summary success, got ${approveResp.status()}`);
  });
}

// INT-008-IT-02
async function test_INT_008_IT_02() {
  if (!RUN_AI_CASES) {
    return { skipped: true, reason: 'RUN_AI_CASES=false' };
  }

  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();
  if (!state.lastSummaryGeneratedMeetingId) {
    return { skipped: true, reason: 'No generated summary meeting available' };
  }

  // Setup + Execution
  const { response } = await apiRequest(`/summaries/${state.lastSummaryGeneratedMeetingId}/approve`, {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({ response: 'REJECTED', comments: 'Need changes before approval' }),
  });

  // Assertions
  assert(response.ok || response.status === 409 || response.status === 400, `Expected rejection submit or conflict, got ${response.status}`);
}

// INT-008-EC-03
async function test_INT_008_EC_03() {
  if (!RUN_AI_CASES) {
    return { skipped: true, reason: 'RUN_AI_CASES=false' };
  }

  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  await ensurePrimaryIdentityAndToken();
  if (!state.lastSummaryGeneratedMeetingId) {
    return { skipped: true, reason: 'No generated summary meeting available' };
  }

  // Setup
  const first = await apiRequest(`/summaries/${state.lastSummaryGeneratedMeetingId}/approve`, {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({ response: 'APPROVED', comments: 'First submit' }),
  });

  // Execution
  const second = await apiRequest(`/summaries/${state.lastSummaryGeneratedMeetingId}/approve`, {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({ response: 'APPROVED', comments: 'Second submit should be blocked or ignored' }),
  });

  // Assertions
  assert(first.response.ok || [400, 409].includes(first.response.status), `Unexpected first approval status: ${first.response.status}`);
  assert([200, 400, 409].includes(second.response.status), `Expected duplicate handling status, got ${second.response.status}`);
}

// INT-008-EC-04
async function test_INT_008_EC_04() {
  if (!RUN_AI_CASES) {
    return { skipped: true, reason: 'RUN_AI_CASES=false' };
  }

  if (shouldSkipDeploymentOnlyCase()) {
    return deploymentOnlySkipResult();
  }

  if (!state.lastSummaryGeneratedMeetingId) {
    return { skipped: true, reason: 'No generated summary meeting available' };
  }

  // Setup + Execution
  const { response } = await apiRequest(`/summaries/${state.lastSummaryGeneratedMeetingId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: 'APPROVED' }),
  });

  // Assertions
  assert([401, 403].includes(response.status), `Expected unauthorized approval attempt to fail, got ${response.status}`);
}

// INT-009-IT-01
async function test_INT_009_IT_01() {
  // Setup + Execution
  const { response } = await apiRequest('/projects', { method: 'GET' });

  // Assertions
  assert([401, 403].includes(response.status), `Expected unauthorized response for /projects without token, got ${response.status}`);
}

// INT-009-IT-02
async function test_INT_009_IT_02(browser) {
  return withNewPage(browser, async (page) => {
    // Setup
    await page.goto(`${FRONTEND_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    });

    // Execution
    await page.goto(`${FRONTEND_BASE}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Assertions
    await page.waitForURL((url) => url.pathname.includes('/login'), { timeout: 45000 });
  });
}

// INT-009-EC-03
async function test_INT_009_EC_03() {
  await ensurePrimaryIdentityAndToken();

  // Setup + Execution
  const { response } = await apiRequest('/projects', {
    method: 'GET',
    headers: { Authorization: 'Bearer intentionally.invalid.token' },
  });

  // Assertions
  assert([401, 403].includes(response.status), `Expected tampered token rejection, got ${response.status}`);
}

// INT-010-IT-01
async function test_INT_010_IT_01() {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  // Setup + Execution
  const { response } = await apiRequest('/meetings', {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({
      projectId: project.id,
      title: `Past Validation ${nowStamp()}`,
      description: 'Should fail backend validation',
      meetingDate: nextDate(-1),
      meetingTime: '08:00:00',
      platform: 'Zoom',
      meetingLink: 'https://example.com/past-validation',
    }),
  });

  // Assertions
  assert(response.status >= 400 && response.status < 500, `Expected 4xx for past date validation, got ${response.status}`);
}

// INT-010-IT-02
async function test_INT_010_IT_02(browser) {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();
  const meetingTitle = `Boundary Future ${nowStamp()}`;

  return withNewPage(browser, async (page) => {
    // Setup
    await loginViaUi(page, state.primaryIdentity);

    // Execution
    await page.goto(`${FRONTEND_BASE}/create-meeting`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.selectOption('#project', project.id);
    await page.fill('#title', meetingTitle);
    await page.fill('#date', nextDate(1));
    await page.fill('#time', shortTimeNowPlusMinutes(30));

    const createRespPromise = waitForApiResponse(page, '/meetings', 'POST');
    await page.getByRole('button', { name: 'Create Meeting' }).click();

    // Assertions
    const createResp = await createRespPromise;
    assert(createResp.ok(), `Expected valid near-future meeting to succeed, got ${createResp.status()}`);

    const meetings = await listProjectMeetings(state.token, project.id);
    const created = meetings.find((m) => m.title === meetingTitle);
    assert(Boolean(created?.id), 'Expected near-future meeting persisted in DB/API view');
    state.cleanupMeetingIds.add(created.id);
  });
}

// INT-010-EC-03
async function test_INT_010_EC_03() {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  // Setup + Execution
  const { response } = await apiRequest('/meetings', {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({
      projectId: project.id,
      title: `Bad Format ${nowStamp()}`,
      description: 'Invalid format input test',
      meetingDate: '2026-99-99',
      meetingTime: 'not-a-time',
      platform: 'Zoom',
      meetingLink: 'https://example.com/invalid-format',
    }),
  });

  // Assertions
  assert(response.status >= 400 && response.status < 500, `Expected 4xx for invalid format payload, got ${response.status}`);
}

// INT-010-EC-04
async function test_INT_010_EC_04() {
  await ensurePrimaryIdentityAndToken();
  const project = await ensureProjectForPrimaryUser();

  const nowLocal = new Date();
  const date = nowLocal.toISOString().slice(0, 10);
  const time = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}:00`;

  // Setup + Execution
  const { response, body } = await apiRequest('/meetings', {
    method: 'POST',
    headers: authHeaders(state.token),
    body: JSON.stringify({
      projectId: project.id,
      title: `Timezone Boundary ${nowStamp()}`,
      description: 'Timezone boundary check',
      meetingDate: date,
      meetingTime: time,
      platform: 'Zoom',
      meetingLink: 'https://example.com/timezone-check',
    }),
  });

  // Assertions
  assert([200, 201, 400, 409, 422].includes(response.status), `Expected deterministic policy response for boundary input, got ${response.status}`);

  if (response.ok) {
    if (body?.id) {
      state.cleanupMeetingIds.add(body.id);
    }
  }
}

async function runCase(testId, fn) {
  const started = Date.now();

  try {
    const result = await fn();
    const durationMs = Date.now() - started;
    if (result?.skipped) {
      return { testId, ok: true, skipped: true, reason: result.reason, durationMs };
    }
    return { testId, ok: true, durationMs };
  } catch (error) {
    const durationMs = Date.now() - started;
    return { testId, ok: false, error: String(error), durationMs };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    await ensurePrimaryIdentityAndToken();

    const testCases = [
      ['INT-001-IT-01', () => test_INT_001_IT_01(browser)],
      ['INT-001-EC-02', () => test_INT_001_EC_02(browser)],
      ['INT-001-EC-03', () => test_INT_001_EC_03(browser)],
      ['INT-001-EC-04', test_INT_001_EC_04],
      ['INT-001-EC-05', () => test_INT_001_EC_05(browser)],

      ['INT-002-IT-01', () => test_INT_002_IT_01(browser)],
      ['INT-002-EC-02', () => test_INT_002_EC_02(browser)],
      ['INT-002-EC-03', () => test_INT_002_EC_03(browser)],
      ['INT-002-EC-04', () => test_INT_002_EC_04(browser)],

      ['INT-003-IT-01', () => test_INT_003_IT_01(browser)],
      ['INT-003-EC-02', () => test_INT_003_EC_02(browser)],
      ['INT-003-IT-03', () => test_INT_003_IT_03(browser)],

      ['INT-004-IT-01', () => test_INT_004_IT_01(browser)],
      ['INT-004-IT-02', () => test_INT_004_IT_02(browser)],
      ['INT-004-EC-03', () => test_INT_004_EC_03(browser)],
      ['INT-004-EC-04', test_INT_004_EC_04],
      ['INT-004-EC-05', () => test_INT_004_EC_05(browser)],

      ['INT-005-IT-01', () => test_INT_005_IT_01(browser)],
      ['INT-005-IT-02', () => test_INT_005_IT_02(browser)],
      ['INT-005-EC-03', () => test_INT_005_EC_03(browser)],
      ['INT-005-EC-04', () => test_INT_005_EC_04(browser)],

      ['INT-006-IT-01', () => test_INT_006_IT_01(browser)],
      ['INT-006-EC-02', () => test_INT_006_EC_02(browser)],
      ['INT-006-EC-03', test_INT_006_EC_03],
      ['INT-006-EC-04', () => test_INT_006_EC_04(browser)],
      ['INT-006-IT-05', test_INT_006_IT_05],

      ['INT-007-IT-01', () => test_INT_007_IT_01(browser)],
      ['INT-007-EC-02', () => test_INT_007_EC_02(browser)],
      ['INT-007-EC-03', () => test_INT_007_EC_03(browser)],

      ['INT-008-IT-01', () => test_INT_008_IT_01(browser)],
      ['INT-008-IT-02', test_INT_008_IT_02],
      ['INT-008-EC-03', test_INT_008_EC_03],
      ['INT-008-EC-04', test_INT_008_EC_04],

      ['INT-009-IT-01', test_INT_009_IT_01],
      ['INT-009-IT-02', () => test_INT_009_IT_02(browser)],
      ['INT-009-EC-03', test_INT_009_EC_03],

      ['INT-010-IT-01', test_INT_010_IT_01],
      ['INT-010-IT-02', () => test_INT_010_IT_02(browser)],
      ['INT-010-EC-03', test_INT_010_EC_03],
      ['INT-010-EC-04', test_INT_010_EC_04],
    ];

    const results = [];
    for (const [testId, testFn] of testCases) {
      results.push(await runCase(testId, testFn));
    }

    const failed = results.filter((r) => !r.ok);
    const skipped = results.filter((r) => r.skipped);
    const passed = results.filter((r) => r.ok && !r.skipped);

    console.log(`INTEGRATION_FRONTEND_BASE=${FRONTEND_BASE}`);
    console.log(`INTEGRATION_BACKEND_BASE=${BACKEND_BASE}`);
    console.log(`INTEGRATION_RUN_AI_CASES=${RUN_AI_CASES}`);
    console.log(`INTEGRATION_DEPLOYMENT_ONLY_CASES=${SHOULD_RUN_DEPLOYMENT_ONLY_CASES}`);
    console.log(`INTEGRATION_TOTAL=${results.length}`);
    console.log(`INTEGRATION_PASSED=${passed.length}`);
    console.log(`INTEGRATION_SKIPPED=${skipped.length}`);
    console.log(`INTEGRATION_FAILED=${failed.length}`);

    for (const result of results) {
      if (result.skipped) {
        console.log(`SKIP ${result.testId} (${result.durationMs}ms): ${result.reason}`);
      } else if (result.ok) {
        console.log(`PASS ${result.testId} (${result.durationMs}ms)`);
      } else {
        console.log(`FAIL ${result.testId} (${result.durationMs}ms): ${result.error}`);
      }
    }

    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await cleanupArtifacts();
    await browser.close();
  }
}

main().catch((error) => {
  console.error('INTEGRATION_RESULT=FAIL');
  console.error(error);
  process.exit(1);
});
