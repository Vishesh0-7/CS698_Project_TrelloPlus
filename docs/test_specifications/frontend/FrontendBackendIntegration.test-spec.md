# Frontend + Backend Integration Test Specification

## 1. Scope

This specification validates end-to-end pathways that require both the React frontend and the Spring/Lambda backend to work together.

Included:
- UI to API request/response integration
- Authentication and session propagation
- Project and meeting lifecycle pathways
- Approval and AI-summary pathways (optional, because they depend on LLM runtime availability)
- Error-handling behavior when backend responses are non-2xx

Excluded:
- Pure frontend unit rendering behavior without backend interaction
- Pure backend service-layer tests without frontend user flow
- WebSocket real-time behavior (currently not production-ready in deployed architecture)

## 2. Environment Preconditions

- Frontend is reachable at FRONTEND_BASE (example: http://127.0.0.1:5173)
- Backend API is reachable at BACKEND_BASE (example: http://localhost:8080/api/v1 or https://<gateway>/prod)
- Backend has healthy database connectivity
- Test runner has Playwright available
- A test password that satisfies backend policy is configured

Recommended environment variables:
- FRONTEND_BASE
- BACKEND_BASE
- TEST_PASSWORD
- TEST_EMAIL_PREFIX
- TEST_FULL_NAME_PREFIX
- HEADLESS
- RUN_AI_CASES
- CLEANUP
- RUN_DEPLOYMENT_ONLY_CASES

## 3. Integration Pathway Matrix

| ID | Pathway | Frontend Entry | Backend APIs Involved | Priority | Automated |
|---|---|---|---|---|---|
| INT-001 | Registration creates account and session | /register | POST /auth/register | P0 | Yes |
| INT-002 | Login creates active session and redirects to dashboard | /login | POST /auth/login, GET /projects | P0 | Yes |
| INT-003 | Logout clears local session and enforces auth guard | /logout and protected routes | POST /auth/logout (best effort), protected endpoints | P0 | Yes |
| INT-004 | Create project from UI persists backend record | /create-project | POST /projects, GET /projects | P0 | Yes |
| INT-005 | Dashboard reflects backend project state | / | GET /projects | P0 | Yes |
| INT-006 | Create meeting from UI persists backend record | /create-meeting | GET /projects, GET /projects/{id}/members, POST /meetings, GET /projects/{id}/meetings | P0 | Yes |
| INT-007 | Meeting transcript triggers summary generation | /meeting-transcript/{id} | POST /meetings/{id}/end, POST /summaries | P1 | Yes (optional) |
| INT-008 | Summary approval submits decision to backend | /meetings/{id} | GET /summaries/{meetingId}, POST /summaries/{meetingId}/approve | P1 | Yes (optional) |
| INT-009 | Unauthorized direct API call is rejected | N/A (API-level verification) | GET /projects without token | P0 | Yes |
| INT-010 | Invalid meeting scheduling shows backend-integrated error path | /create-meeting | POST /meetings with invalid date/time | P1 | Yes |

## 4. Step 2 Pathway Test Specification

### INT-001 Pathway: Registration creates account and session
Short description:
- New user completes registration in frontend, backend creates account, frontend stores session, and user enters authenticated area.

Behaviors and edge cases to test:
- Required field validation for full name, email, password, confirm password.
- Email format validation.
- Password strength validation.
- Password mismatch handling.
- Duplicate email registration conflict handling.
- Successful registration sets `authToken` and `user` in local storage.
- Navigation away from `/register` after success.
- Backend/network failure surfaces error toast and keeps user on form.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-001-IT-01 | Integration happy path registration | Frontend: open `/register`, enter valid full name/email/password, click `Create account`. API payload: `POST /auth/register {email, fullName, password}`. | UI redirects to authenticated route; token/user stored in local storage; API returns `2xx`; DB has new user row with unique email. |
| INT-001-EC-02 | Reject invalid email format | Frontend: enter invalid email format and submit. | UI shows validation error; API request not sent; DB unchanged. |
| INT-001-EC-03 | Reject password mismatch | Frontend: valid fields but `password != confirmPassword`. | UI shows mismatch error; no API call; DB unchanged. |
| INT-001-EC-04 | Handle duplicate email conflict | Frontend: register with existing email. API returns conflict. | UI shows backend error toast; user remains on `/register`; API returns `409/4xx`; DB unchanged for second attempt. |
| INT-001-EC-05 | Handle backend/network failure | Frontend: valid submit while backend unavailable/5xx. | UI shows failure toast; submit returns to idle state; API request fails `5xx/network`; DB unchanged. |

### INT-002 Pathway: Login creates active session and redirects
Short description:
- Existing user signs in from frontend, backend authenticates credentials, frontend persists session, and dashboard data fetch starts.

Behaviors and edge cases to test:
- Empty credential blocking.
- Invalid email format blocking.
- Wrong password unauthorized handling.
- Successful login writes token and user metadata.
- Redirect from `/login` to dashboard.
- Authenticated `GET /projects` succeeds after login.
- Backend/network errors show graceful error state.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-002-IT-01 | Integration happy path login | Frontend: open `/login`, enter valid email/password, click `Sign in`. API: `POST /auth/login`. | UI leaves `/login` and loads dashboard; API login returns `2xx` with token/user; follow-up `GET /projects` returns `2xx`; DB unchanged except optional last-login audit fields. |
| INT-002-EC-02 | Reject malformed email before API call | Frontend: email `abc` + valid password, submit. | UI shows email validation error; API not called; DB unchanged. |
| INT-002-EC-03 | Handle invalid credentials | Frontend: valid email + wrong password, submit. API returns unauthorized. | UI shows `Login failed` error; remains on `/login`; API returns `401`; DB unchanged. |
| INT-002-EC-04 | Handle backend/network failure | Frontend: valid credentials while backend failing. | UI exits loading and shows error toast; API `5xx/network`; DB unchanged. |

### INT-003 Pathway: Logout clears session and enforces auth guard
Short description:
- User triggers logout, frontend clears local session even if server logout fails, and protected routes become inaccessible.

Behaviors and edge cases to test:
- Logout flow calls backend logout endpoint when reachable.
- Local token/user always removed in `finally` path.
- Redirect to `/login` after logout delay.
- Accessing protected route without token redirects to `/login`.
- Server logout failure still results in local logout.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-003-IT-01 | Integration logout with reachable backend | Frontend: authenticated user navigates to `/logout`. API: `POST /auth/logout`. | UI shows logging-out state then redirects `/login`; local storage auth keys removed; API returns `2xx` (or accepted); DB/session store invalidation occurs if implemented. |
| INT-003-EC-02 | Logout resilience when backend call fails | Frontend: `/logout` while forcing logout API `5xx/network`. | UI still redirects `/login`; local storage cleared; API failure does not block logout; DB unchanged if backend did not process logout. |
| INT-003-IT-03 | Auth guard after logout | Frontend: after logout, attempt direct navigation to `/` or protected project route. | UI redirects to `/login`; protected API calls receive `401/403`; DB unchanged. |

### INT-004 Pathway: Create project from UI and persist backend record
Short description:
- User creates project from frontend create form, backend persists project, and frontend navigates to project board.

Behaviors and edge cases to test:
- Required project name validation.
- Description length and quality validation for AI flow.
- Empty-board creation path (`generateTasks=false`).
- AI-generation creation path (`generateTasks=true`) and preview modal behavior.
- Backend conflict/validation failures show user-friendly errors.
- Created project appears in backend project list.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-004-IT-01 | Integration happy path empty board creation | Frontend: `/create-project`, enter valid name and optional description, click `Create Empty Board`. API: `POST /projects {name, description, generateTasks:false}`. | UI navigates to `/project/{id}?tab=board`; API returns `2xx` with project id; DB contains new project row and default board structure. |
| INT-004-IT-02 | Integration AI-generated board creation | Frontend: valid name + rich description, submit AI create path. API: `POST /projects {generateTasks:true}`. | UI shows generating state and preview modal; API returns `2xx` with tasks/columns; DB stores created project and generated cards. |
| INT-004-EC-03 | Block empty name client-side | Frontend: blank project name, click create. | UI shows validation message; API not called; DB unchanged. |
| INT-004-EC-04 | Handle backend validation/conflict | Frontend: submit payload triggering backend `4xx` (for example duplicate constraints or invalid length). | UI shows error toast; stays on create page; API returns `4xx`; DB unchanged. |
| INT-004-EC-05 | Handle backend outage during creation | Frontend: valid submit while backend `5xx/network`. | UI resets loading state and shows failure toast; API fails; DB unchanged. |

### INT-005 Pathway: Dashboard reflects backend project state
Short description:
- Authenticated dashboard loads project list from backend and renders empty/non-empty states accurately.

Behaviors and edge cases to test:
- Blocking loading state for initial empty store.
- Empty state rendering when backend returns no projects.
- Project cards render when backend returns one or more projects.
- Polling/refresh updates state without page reload.
- Backend failure shows toast (when enabled) and preserves last known data.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-005-IT-01 | Integration dashboard with existing projects | Frontend: authenticated user opens `/`. API: `GET /projects` returns list with created project. | UI displays project cards including expected project name; API `2xx`; DB unchanged (read-only). |
| INT-005-IT-02 | Integration dashboard empty state | Frontend: authenticated user with no projects opens `/`. API returns empty array. | UI renders `No projects yet` state and create CTA; API `2xx`; DB unchanged. |
| INT-005-EC-03 | Backend failure while loading dashboard | Frontend: open `/` with backend returning `5xx/network`. | UI shows load failure toast and avoids crash; API fails; DB unchanged. |
| INT-005-EC-04 | Unauthorized token during dashboard fetch | Frontend: stale/invalid token then open `/`. API returns `401/403`. | UI redirects or enforces auth handling; API `401/403`; DB unchanged. |

### INT-006 Pathway: Create meeting from UI and persist backend record
Short description:
- User creates a meeting from frontend, backend validates schedule and membership context, and meeting appears in project meetings.

Behaviors and edge cases to test:
- Project selection is required.
- Title/date/time required.
- Past date-time rejected.
- Additional member selection optional and correctly serialized.
- Platform/link optional fields accepted.
- Successful creation redirects to project meetings tab.
- API and DB contain meeting with expected fields.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-006-IT-01 | Integration happy path meeting creation | Frontend: `/create-meeting`, select project, valid title/date/time, optional agenda/platform/link, click `Create Meeting`. API: `POST /meetings`. | UI redirects to `/project/{id}?tab=meetings`; API `2xx`; DB stores meeting row linked to project/user(s). |
| INT-006-EC-02 | Reject missing required fields | Frontend: submit with missing title or date/time. | UI shows validation toast; API not called; DB unchanged. |
| INT-006-EC-03 | Reject past meeting schedule | Frontend/API: submit meeting with past date-time. | UI shows `Meeting cannot be scheduled in the past` or backend validation message; API returns `4xx` if called; DB unchanged. |
| INT-006-EC-04 | Handle backend failure on create | Frontend: valid submit while backend `5xx/network`. | UI shows failure toast and remains on form; API fails; DB unchanged. |
| INT-006-IT-05 | Member-selection optional integration | Frontend: unselect additional members and submit valid meeting. API payload omits/empties `additionalMemberIds`. | API `2xx`; meeting still created for default participants; DB meeting exists without invalid member links. |

### INT-007 Pathway: Transcript submission generates summary and changes (optional AI)
Short description:
- User enters transcript in meeting transcript page, backend ends meeting and generates summary/change artifacts via AI provider.

Behaviors and edge cases to test:
- Transcript input accepted for scheduled meetings.
- Generation triggers `end meeting` then `generate summary` sequence.
- Redirect to meeting summary page after success.
- AI/provider unavailable handling.
- Meeting not in schedulable state blocks generation.
- Empty transcript behavior (allowed/disallowed) handled consistently.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-007-IT-01 | Integration happy path transcript to summary | Frontend: open `/meeting-transcript/{id}`, paste valid transcript, click `Generate Summary & Approval Items`. API: `POST /meetings/{id}/end` then `POST /summaries`. | UI shows generating state then redirects `/meetings/{id}`; both APIs return `2xx`; DB updates meeting status and creates summary/action-items/changes records. |
| INT-007-EC-02 | AI provider/service failure handling | Frontend: same action while AI backend fails (timeout/5xx). | UI shows error toast and exits loading state; API returns `5xx/timeout`; DB may show ended meeting but no completed summary record. |
| INT-007-EC-03 | Invalid meeting state for transcript generation | Frontend: attempt generation on non-scheduled meeting. | UI disables generation or backend rejects with `4xx`; DB unchanged for summary generation. |

### INT-008 Pathway: Summary approval posts decision (optional AI)
Short description:
- User approves or rejects generated summary from meeting summary page, backend records decision and updates approval state.

Behaviors and edge cases to test:
- Summary details load before decision.
- Approve decision request persisted.
- Reject/request changes decision request persisted.
- Double submission prevented after user has already responded.
- Unauthorized/non-member approval blocked.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-008-IT-01 | Integration approve summary happy path | Frontend: open `/meetings/{id}`, click `Approve Summary`. API: `POST /summaries/{meetingId}/approve {response:APPROVED}`. | UI shows submitted approval state and disables repeated submission; API `2xx`; DB stores approval response row for user/meeting. |
| INT-008-IT-02 | Integration reject summary path | Frontend: open summary page, click `Request Changes` with optional comments. API posts rejection payload. | UI displays user decision as rejected/requested changes; API `2xx`; DB stores rejection response/comment. |
| INT-008-EC-03 | Prevent duplicate approval submission | Frontend: user with existing response revisits page and tries submit again. | UI keeps action buttons disabled or backend returns `4xx`; DB has single effective response per user. |
| INT-008-EC-04 | Unauthorized approval attempt | Frontend/API: non-member or unauthenticated user tries approval endpoint. | UI redirects or shows error; API `401/403`; DB unchanged. |

### INT-009 Pathway: Unauthorized access is rejected across frontend and API
Short description:
- Requests without valid auth must be blocked by backend and frontend must route users to login when protected resources are requested.

Behaviors and edge cases to test:
- Direct API without token returns `401/403`.
- Expired/invalid token returns `401/403`.
- Protected UI route without token redirects to login.
- Token tampering does not bypass guard.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-009-IT-01 | Integration unauthorized API rejection | API action: `GET /projects` with no `Authorization` header. | API returns `401/403`; UI (if invoked from app) shows auth failure path; DB unchanged. |
| INT-009-IT-02 | Integration protected route redirect | Frontend: clear local token, navigate to `/` or `/project/{id}`. | UI redirects to `/login`; any protected API requests return `401/403`; DB unchanged. |
| INT-009-EC-03 | Tampered token handling | Frontend/API: set malformed token and attempt protected call. | API returns `401/403`; UI clears/invalidates session and redirects to login; DB unchanged. |

### INT-010 Pathway: Invalid meeting scheduling is blocked
Short description:
- Frontend and backend jointly enforce schedule validity (especially not-in-past rule), preventing invalid meetings from being created.

Behaviors and edge cases to test:
- Frontend local validation blocks obvious past date/time.
- Backend validation blocks crafted or timezone-edge invalid payloads.
- Exactly-now and near-boundary inputs handled consistently.
- Invalid date/time format rejected.

| Test ID | Test Purpose | Test Inputs (frontend actions, API payloads, user inputs) | Expected Output (UI changes, API responses, DB effects) |
|---|---|---|---|
| INT-010-IT-01 | Integration backend validation for past schedule | API-level integration: authenticated `POST /meetings` with `meetingDate` yesterday and valid payload otherwise. | API returns `4xx`; UI would show scheduling error if triggered from frontend; DB has no newly persisted invalid meeting. |
| INT-010-IT-02 | Integration valid near-future schedule accepted | Frontend: create meeting with valid future date/time near current time boundary. | UI success redirect to meetings tab; API `2xx`; DB stores meeting with expected timestamp. |
| INT-010-EC-03 | Invalid time/date format rejected | API/front-end crafted payload with malformed `meetingDate` or `meetingTime`. | API returns `4xx`; UI shows failure message; DB unchanged. |
| INT-010-EC-04 | Timezone boundary consistency | Frontend in non-UTC timezone creates meeting for local current date near midnight; verify backend decision. | Behavior is consistent with business rule and grace policy; API returns expected `2xx` or `4xx`; DB effect matches decision. |

## 5. Traceability: Spec to Automated Script

Automated script: scripts/playwright_fullstack_integration.mjs

Mapping:
- Each table row Test ID now has a matching automated test function and runner entry in scripts/playwright_fullstack_integration.mjs.
- Naming convention: Test ID `INT-XXX-YYY-ZZ` maps to function `test_INT_XXX_YYY_ZZ` and an identical runner label.
- Total implemented automated cases: 40 (all rows in this specification).

## 6. Pass/Fail Criteria

Pass criteria:
- All P0 cases pass
- Optional AI-dependent cases pass when RUN_AI_CASES=true

Fail criteria:
- Any P0 case fails
- Any test case produces unhandled frontend request failure to BACKEND_BASE

## 7. Risks and Notes

- AI cases can be unstable if Bedrock quota/model access changes; keep them optional.
- If backend base path differs between environments, BACKEND_BASE must match the deployed route prefix.
- Current production architecture does not include stable WebSocket endpoint coverage, so WS integration is explicitly out of scope.
- Deployment-only cases are skipped automatically when FRONTEND_BASE or BACKEND_BASE points to localhost/127.0.0.1 unless RUN_DEPLOYMENT_ONLY_CASES=true.
- Deployment-only cases in this suite are INT-004-IT-02, INT-007-IT-01, INT-007-EC-02, INT-007-EC-03, INT-008-IT-01, INT-008-IT-02, INT-008-EC-03, and INT-008-EC-04.
