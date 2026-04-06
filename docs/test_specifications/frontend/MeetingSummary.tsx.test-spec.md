# MeetingSummary.tsx Test Specification Document

## Current Implementation Overview

**File**: `src/app/pages/MeetingSummary.tsx`

**Architecture**: REST API-driven React component using local component state (not Zustand stores). The component makes direct API calls via `apiService` and manages form state with `useState` hooks.

**Note on Stores**: While `useMeetingStore` and `useChangeStore` exist in the codebase, the current `MeetingSummary.tsx` implementation does **NOT** use them. It uses:
- Local `useState` for all component state
- Direct `apiService` calls for all data operations
- `localStorage` for user authentication info

---

## User Story Context

**User Story**: As a meeting facilitator, I want to end the meeting by generating an automatic summary of all agreed-upon action items, decisions, and changes in a separate approval checklist section, so that team members can review exactly what was decided and approve it before any changes take effect.

---

## State Management

### Local State (useState)

| State Variable | Type | Purpose |
|---------------|------|---------|
| `meeting` | `MeetingResponse \| null` | Meeting details from API |
| `summary` | `MeetingSummaryResponse \| null` | AI summary with action items, decisions, changes |
| `approval` | `ApprovalStatusResponse \| null` | Approval status and responses |
| `selectedChange` | `ChangeRequest \| null` | Currently selected change for modal |
| `comments` | `string` | User's approval comments input |
| `isSubmitting` | `boolean` | Loading state for summary approval |
| `approvingItemId` | `string \| null` | Loading state for individual item approval |
| `editingActionId` | `string \| null` | ID of action item being edited (null = creating new) |
| `editingDecisionId` | `string \| null` | ID of decision being edited (null = creating new) |
| `showActionEditor` | `boolean` | Toggle action item form visibility |
| `showDecisionEditor` | `boolean` | Toggle decision form visibility |
| `actionDescription` | `string` | Action item description input |
| `actionSourceContext` | `string` | Action item source context input |
| `actionPriority` | `string` | Action item priority ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') |
| `decisionDescription` | `string` | Decision description input |
| `decisionSourceContext` | `string` | Decision source context input |
| `decisionImpactSummary` | `string` | Decision impact summary input |
| `isSavingItem` | `boolean` | Loading state for save/delete operations |
| `currentUserId` | `string \| null` | Current user ID from localStorage |
| `isProjectOwner` | `boolean` | Whether current user is project owner |

### Computed Properties (Derived State)

| Property | Calculation | Purpose |
|----------|-------------|---------|
| `currentUserApproval` | `(approval?.responses \|\| []).find(r => r.userId === currentUserId && r.response !== 'PENDING')` | Find user's existing vote |
| `hasSubmittedSummaryDecision` | `Boolean(currentUserApproval)` | Has user already voted |
| `hasAnyApprovedSummaryDecision` | `(approval?.currentApprovedCount \|\| 0) > 0` | Any approvals exist |
| `isMeetingFinalized` | `meeting.status === 'APPROVED' \|\| meeting.status === 'REJECTED'` | Meeting is locked |
| `isItemEditingDisabled` | `isMeetingFinalized \|\| hasSubmittedSummaryDecision` | Editing blocked |
| `canEditOrDeleteItems` | `isProjectOwner && !isItemEditingDisabled` | Can modify items |
| `isAddDisabled` | `isItemEditingDisabled \|\| hasAnyApprovedSummaryDecision` | Adding blocked |

---

## Functions Analysis

### 1. `reloadSummaryAndApproval(id: string)`

**Location**: Lines 62-69

**Purpose**: Refreshes summary and approval data after mutations.

**API Calls**:
- `apiService.getSummaryByMeeting(id)` - GET /api/v1/summaries/meeting/{meetingId}
- `apiService.getApprovalStatus(id)` - GET /api/v1/approvals/summary/{meetingId}

**State Updates**:
- `setSummary(summaryData)`
- `setApproval(approvalData)`

**Example Scenario**:
- Sarah reviews a meeting summary. Another team member approves an action item.
- Sarah's UI refreshes, calling `reloadSummaryAndApproval`.
- Expected: Updated approval status visible.

---

### 2. `useEffect` - Initial Data Loading

**Location**: Lines 71-127

**Purpose**: Loads all meeting data on mount, determines user permissions.

**Flow**:
1. Read `user` from `localStorage`, parse to get `currentUserId`
2. If `meetingId` exists, fetch meeting, summary, and approval data in parallel
3. If user and project exist, fetch project members and determine ownership
4. Set component state (guarded by `isMounted` flag)

**API Calls**:
- `apiService.getMeeting(meetingId)`
- `apiService.getSummaryByMeeting(meetingId)`
- `apiService.getApprovalStatus(meetingId)`
- `apiService.getProjectMembers(projectId)` (conditional)

**Branch Logic**:
| Branch | Condition | Test Input |
|--------|-----------|------------|
| localStorage empty | `!storedUser` | `localStorage.getItem('user')` returns null |
| Invalid JSON | `JSON.parse()` throws | `localStorage.getItem('user')` returns `{invalid` |
| Missing meetingId | `!meetingId` | `useParams()` returns `{}` |
| Missing projectId | `!meetingData.projectId` | Meeting without project association |
| Member fetch fails | `getProjectMembers()` throws | API returns 403/404 |
| Component unmounted | `!isMounted` | Unmount during API call |
| Error with Error instance | `error instanceof Error` | `new Error('message')` |
| Error without instance | `!(error instanceof Error)` | String or object rejection |

**Permission Logic**:
- Checks `member.id` OR `member.userId` (handles both field names)
- Only string IDs considered (`typeof memberId === 'string'`)
- Role comparison is case-insensitive (`toLowerCase() === 'owner'`)

---

### 3. `changeRequests` (useMemo)

**Location**: Lines 129-168

**Purpose**: Transforms API change data into `ChangeRequest` format for modal.

**Input**: `summary?.changes`, `meeting`

**Transformation**:
- Parses `beforeState` JSON (with try/catch fallback to undefined)
- Parses `afterState` JSON (with try/catch fallback to undefined)
- Maps API fields to `ChangeRequest` structure
- Sets defaults for `affectedCards`, `affectedStages`, etc.

**Branch Logic**:
| Branch | Condition | Result |
|--------|-----------|--------|
| Missing data | `!summary \|\| !meeting` | Returns `[]` |
| Valid beforeState | `c.beforeState` exists and parses | `before = parsedObject` |
| Invalid beforeState | `JSON.parse()` throws | `before = undefined` |
| Valid afterState | `c.afterState` exists and parses | `after = parsedObject` |
| Invalid afterState | `JSON.parse()` throws | `after = undefined` |

---

### 4. `submitDecision(decision: 'APPROVED' | 'REJECTED')`

**Location**: Lines 181-202

**Purpose**: Submits user's final approval/rejection on the entire summary.

**Flow**:
1. Validate `meetingId` exists (early return if not)
2. Set `isSubmitting(true)`
3. Call `apiService.submitSummaryApproval()`
4. Show success toast (message depends on decision type)
5. Refresh meeting, approval, and summary data
6. Set `isSubmitting(false)` in finally block

**API Calls**:
- `apiService.submitSummaryApproval(meetingId, decision, comments \|\| undefined)`
- `apiService.getMeeting(meetingId)`
- `apiService.getApprovalStatus(meetingId)`
- `apiService.getSummaryByMeeting(meetingId)`

**Branch Logic**:
| Branch | Condition | Result |
|--------|-----------|--------|
| No meetingId | `!meetingId` | Early return, no changes |
| APPROVED | `decision === 'APPROVED'` | Toast: "Summary approved" |
| REJECTED | `decision === 'REJECTED'` | Toast: "Changes requested" |
| With comments | `comments` truthy | Sends comments to API |
| Without comments | `comments` falsy | Sends `undefined` to API |
| API Error | Any API rejects | Error toast, state unchanged |
| Error instance | `error instanceof Error` | Shows `error.message` |
| Non-Error | `!(error instanceof Error)` | Shows fallback message |

---

### 5. `approveItem(itemId: string, itemType: 'action' | 'decision')`

**Location**: Lines 204-222

**Purpose**: Approves an individual action item or decision.

**Flow**:
1. Validate `meetingId` exists
2. Set `approvingItemId(itemId)` to show loading state
3. Call appropriate API based on `itemType`
4. Reload summary and approval data
5. Show success toast
6. Clear `approvingItemId` in finally block

**API Calls**:
- `apiService.approveActionItem(itemId)` - POST /approvals/items/action-items/{itemId}/approve
- `apiService.approveDecisionItem(itemId)` - POST /approvals/items/decisions/{itemId}/approve

**Branch Logic**:
| Branch | Condition | API Called |
|--------|-----------|------------|
| No meetingId | `!meetingId` | Early return |
| Action item | `itemType === 'action'` | `approveActionItem()` |
| Decision | `itemType === 'decision'` | `approveDecisionItem()` |
| Success | API resolves | Reload data, success toast |
| Error | API rejects | Error toast |

---

### 6. `resetActionEditor()`

**Location**: Lines 224-230

**Purpose**: Resets action item form to initial state.

**State Changes**:
- `setEditingActionId(null)`
- `setShowActionEditor(false)`
- `setActionDescription('')`
- `setActionSourceContext('')`
- `setActionPriority('MEDIUM')`

---

### 7. `resetDecisionEditor()`

**Location**: Lines 232-238

**Purpose**: Resets decision form to initial state.

**State Changes**:
- `setEditingDecisionId(null)`
- `setShowDecisionEditor(false)`
- `setDecisionDescription('')`
- `setDecisionSourceContext('')`
- `setDecisionImpactSummary('')`

---

### 8. `saveActionItem()`

**Location**: Lines 240-264

**Purpose**: Creates new or updates existing action item.

**Flow**:
1. Validate `meetingId` and `actionDescription.trim()` (early return if invalid)
2. Set `isSavingItem(true)`
3. If `editingActionId` exists: call `updateActionItem`
4. Else: call `addActionItem`
5. Update summary state, reset editor, show success toast
6. Set `isSavingItem(false)` in finally

**API Calls**:
- `apiService.updateActionItem(editingActionId, payload)` - PUT
- `apiService.addActionItem(meetingId, payload)` - POST

**Payload**:
```typescript
{
  description: actionDescription.trim(),
  sourceContext: actionSourceContext.trim() || undefined,
  priority: actionPriority,
}
```

**Branch Logic**:
| Branch | Condition | Result |
|--------|-----------|--------|
| Invalid inputs | `!meetingId \|\| !actionDescription.trim()` | Early return |
| Update mode | `editingActionId` truthy | Calls `updateActionItem` |
| Create mode | `editingActionId` falsy | Calls `addActionItem` |
| Empty sourceContext | `actionSourceContext.trim()` falsy | Sends `undefined` |
| With sourceContext | `actionSourceContext.trim()` truthy | Sends trimmed value |
| Update success | API resolves | Toast: "Action item updated" |
| Create success | API resolves | Toast: "Action item added" |

---

### 9. `removeActionItem(itemId: string)`

**Location**: Lines 266-277

**Purpose**: Deletes an action item.

**API Call**: `apiService.deleteActionItem(itemId)` - DELETE

**Flow**: Set loading, call API, update summary, show "Action item removed" toast, clear loading.

---

### 10. `saveDecisionItem()`

**Location**: Lines 279-303

**Purpose**: Creates new or updates existing decision.

**Nearly identical to `saveActionItem`** with these differences:
- Uses `decisionDescription`, `editingDecisionId`
- Third field is `impactSummary` instead of `priority`
- API calls: `updateDecision`, `addDecision`
- Toast messages: "Decision updated", "Decision added"

---

### 11. `removeDecisionItem(itemId: string)`

**Location**: Lines 305-316

**Purpose**: Deletes a decision.

**API Call**: `apiService.deleteDecision(itemId)` - DELETE

**Toast**: "Decision removed"

---

## UI Rendering Logic

### Permission-Based Rendering

| UI Element | Condition | Notes |
|------------|-----------|-------|
| Add Decision button | `disabled={isAddDisabled}` | Hidden when approval started |
| Add Action Item button | `disabled={isAddDisabled}` | Hidden when approval started |
| Decision Approve button | `disabled={alreadyApproved \|\| approvingItemId === d.id \|\| hasSubmittedSummaryDecision}` | Per-item approval |
| Action Approve button | `disabled={alreadyApproved \|\| approvingItemId === a.id \|\| hasSubmittedSummaryDecision}` | Per-item approval |
| Decision Edit button | `disabled={!canEditOrDeleteItems}` | Owner only, before approval |
| Decision Delete button | `disabled={!canEditOrDeleteItems \|\| isSavingItem}` | Owner only, before approval |
| Action Edit button | `disabled={!canEditOrDeleteItems}` | Owner only, before approval |
| Action Delete button | `disabled={!canEditOrDeleteItems \|\| isSavingItem}` | Owner only, before approval |
| Comments textarea | `disabled={hasSubmittedSummaryDecision}` | Can't edit after voting |
| Approve Summary button | `disabled={isSubmitting \|\| hasSubmittedSummaryDecision}` | One vote per user |
| Request Changes button | `disabled={isSubmitting \|\| hasSubmittedSummaryDecision}` | One vote per user |

---

## Network Dependencies (API Endpoints)

| Endpoint | Method | Used By |
|----------|--------|---------|
| /api/v1/meetings/{meetingId} | GET | useEffect |
| /api/v1/summaries/meeting/{meetingId} | GET | useEffect, reloadSummaryAndApproval, submitDecision |
| /api/v1/approvals/summary/{meetingId} | GET | useEffect, reloadSummaryAndApproval, submitDecision |
| /api/v1/projects/{projectId}/members | GET | useEffect |
| /api/v1/approvals/summary/{meetingId} | POST | submitDecision |
| /api/v1/approvals/items/action-items/{itemId}/approve | POST | approveItem |
| /api/v1/approvals/items/decisions/{itemId}/approve | POST | approveItem |
| /api/v1/summaries/meeting/{meetingId}/action-items | POST | saveActionItem |
| /api/v1/summaries/action-items/{itemId} | PUT | saveActionItem |
| /api/v1/summaries/action-items/{itemId} | DELETE | removeActionItem |
| /api/v1/summaries/meeting/{meetingId}/decisions | POST | saveDecisionItem |
| /api/v1/summaries/decisions/{itemId} | PUT | saveDecisionItem |
| /api/v1/summaries/decisions/{itemId} | DELETE | removeDecisionItem |

---

## Mock Objects for Testing

### Mock Data

```typescript
// Meeting Response
const mockMeeting: MeetingResponse = {
  id: 'meeting-1',
  projectId: 'project-1',
  projectName: 'Test Project',
  title: 'Sprint Planning',
  description: 'Weekly planning',
  meetingDate: '2026-04-01',
  meetingTime: '10:00',
  platform: 'Zoom',
  meetingLink: 'https://zoom.us/j/123',
  status: 'PENDING_APPROVAL', // or 'SCHEDULED', 'IN_PROGRESS', 'APPROVED', 'REJECTED'
  createdByName: 'John Doe',
  createdAt: '2026-04-01T09:00:00Z',
  members: [
    { id: 'user-1', username: 'johndoe', email: 'john@test.com' },
    { id: 'user-2', username: 'janesmith', email: 'jane@test.com' },
  ],
};

// Summary Response
const mockSummary: MeetingSummaryResponse = {
  id: 'summary-1',
  meetingId: 'meeting-1',
  status: 'PENDING',
  aiGeneratedContent: 'AI summary text...',
  generatedAt: '2026-04-01T11:00:00Z',
  actionItems: [
    {
      id: 'action-1',
      description: 'Update docs',
      sourceContext: 'Discussed at 10:30',
      approvalStatus: 'PENDING',
      status: 'PENDING',
      createdAt: '2026-04-01T11:00:00Z',
    },
  ],
  decisions: [
    {
      id: 'decision-1',
      description: 'Use PostgreSQL',
      sourceContext: 'Architecture',
      approvalStatus: 'PENDING',
      status: 'PENDING',
      createdAt: '2026-04-01T11:00:00Z',
    },
  ],
  changes: [
    {
      id: 'change-1',
      meetingId: 'meeting-1',
      changeType: 'WORKFLOW',
      beforeState: '{"columns":3}',
      afterState: '{"columns":4}',
      status: 'PENDING',
      createdAt: '2026-04-01T11:00:00Z',
    },
  ],
};

// Approval Status
const mockApprovalStatus: ApprovalStatusResponse = {
  meetingId: 'meeting-1',
  requiredApprovals: 2,
  currentApprovedCount: 1,
  currentRejectedCount: 0,
  totalApproversNeeded: 2,
  responses: [
    {
      userId: 'user-2',
      userName: 'Jane Smith',
      response: 'APPROVED',
      comments: 'Looks good',
      respondedAt: '2026-04-01T12:00:00Z',
    },
  ],
};

// Project Members
const mockProjectMembers = [
  { id: 'user-1', userId: 'user-1', role: 'owner' },
  { id: 'user-2', userId: 'user-2', role: 'member' },
];
```

### Mock Setup

```typescript
// jest.mock for react-router
jest.mock('react-router', () => ({
  useParams: () => ({ meetingId: 'meeting-1' }),
  useNavigate: () => jest.fn(),
}));

// jest.mock for sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// jest.mock for apiService
jest.mock('../../services/api', () => ({
  apiService: {
    getMeeting: jest.fn(),
    getSummaryByMeeting: jest.fn(),
    getApprovalStatus: jest.fn(),
    getProjectMembers: jest.fn(),
    submitSummaryApproval: jest.fn(),
    approveActionItem: jest.fn(),
    approveDecisionItem: jest.fn(),
    addActionItem: jest.fn(),
    updateActionItem: jest.fn(),
    deleteActionItem: jest.fn(),
    addDecision: jest.fn(),
    updateDecision: jest.fn(),
    deleteDecision: jest.fn(),
  },
}));

// localStorage mock
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
```

---

## Test Table

| # | Purpose | Function/Area | Test Inputs | Expected Output | Mock Config |
|---|---------|---------------|-------------|-----------------|-------------|
| 1 | Initial load success | useEffect | `meetingId='m1'`, valid user in localStorage | All data loaded, renders correctly | All APIs resolve |
| 2 | No meetingId | useEffect | `useParams()` returns `{}` | No API calls, early return | N/A |
| 3 | Invalid user JSON | useEffect | `localStorage.getItem('user')` returns `{invalid` | `currentUserId=null`, continues loading | localStorage returns invalid JSON |
| 4 | No user in localStorage | useEffect | `localStorage.getItem('user')` returns `null` | `currentUserId=null`, `isProjectOwner=false` | localStorage returns null |
| 5 | User is owner | useEffect | Member with `role='OWNER'` | `isProjectOwner=true` | `getProjectMembers` returns owner role |
| 6 | User is member | useEffect | Member with `role='member'` | `isProjectOwner=false` | `getProjectMembers` returns member role |
| 7 | Project members fetch fails | useEffect | `getProjectMembers` rejects | `isProjectOwner=false`, silent error | API rejects |
| 8 | API error on load | useEffect | `getMeeting` rejects with Error | Error toast shown | `getMeeting` rejects |
| 9 | Non-Error rejection | useEffect | API rejects with string | Fallback error message | `getMeeting` rejects with string |
| 10 | Unmount during load | useEffect | Component unmounts during API | No state updates after unmount | Delayed API + unmount |
| 11 | Transform valid change JSON | changeRequests | `beforeState='{"id":"1"}'`, `afterState='{"id":"2"}'` | Parsed objects in result | Valid summary |
| 12 | Handle invalid change JSON | changeRequests | `beforeState='{'`, `afterState='malformed'` | `before=undefined`, `after=undefined` | Summary with invalid JSON |
| 13 | Empty changes array | changeRequests | `summary=null` | Returns `[]` | summary is null |
| 14 | Submit APPROVED | submitDecision | `decision='APPROVED'`, `comments='Good'` | "Summary approved" toast, state refreshed | All APIs resolve |
| 15 | Submit REJECTED | submitDecision | `decision='REJECTED'`, `comments=''` | "Changes requested" toast | All APIs resolve |
| 16 | No meetingId | submitDecision | `meetingId=null` | Early return | useParams returns null |
| 17 | Submit API error | submitDecision | API rejects Error | Error toast with message | `submitSummaryApproval` rejects |
| 18 | Submit non-Error rejection | submitDecision | API rejects string | Fallback error message | API rejects with string |
| 19 | Refresh fails after submit | submitDecision | Submit OK, refresh fails | Error toast | Selective reject |
| 20 | Approve action item | approveItem | `itemId='a1'`, `itemType='action'` | Success toast, data reloaded | `approveActionItem` resolves |
| 21 | Approve decision item | approveItem | `itemId='d1'`, `itemType='decision'` | Success toast, `approveDecisionItem` called | `approveDecisionItem` resolves |
| 22 | Approve item no meetingId | approveItem | `meetingId=null` | Early return | useParams returns null |
| 23 | Approve action fails | approveItem | `itemType='action'`, API rejects | Error toast | `approveActionItem` rejects |
| 24 | Approve decision fails | approveItem | `itemType='decision'`, API rejects | Error toast | `approveDecisionItem` rejects |
| 25 | Create action item | saveActionItem | `editingActionId=null`, valid desc | "Action item added" toast | `addActionItem` resolves |
| 26 | Update action item | saveActionItem | `editingActionId='a1'`, valid desc | "Action item updated" toast | `updateActionItem` resolves |
| 27 | Empty description | saveActionItem | `actionDescription=''` | Early return, no API call | Empty string |
| 28 | Whitespace description | saveActionItem | `actionDescription='   '` | Early return (trim makes empty) | Whitespace only |
| 29 | No meetingId | saveActionItem | `meetingId=null` | Early return | Null meetingId |
| 30 | Create action fails | saveActionItem | API rejects Error | Error toast | `addActionItem` rejects |
| 31 | Update action fails | saveActionItem | `editingActionId` set, API rejects | Error toast | `updateActionItem` rejects |
| 32 | Trim sourceContext | saveActionItem | `sourceContext='  ctx  '` | Sends trimmed value | Verify payload |
| 33 | Empty sourceContext | saveActionItem | `sourceContext=''` | Sends `undefined` | Verify payload |
| 34 | Create decision | saveDecisionItem | `editingDecisionId=null` | "Decision added" toast | `addDecision` resolves |
| 35 | Update decision | saveDecisionItem | `editingDecisionId='d1'` | "Decision updated" toast | `updateDecision` resolves |
| 36 | Empty decision desc | saveDecisionItem | `decisionDescription=''` | Early return | Empty string |
| 37 | Decision save error | saveDecisionItem | API rejects | Error toast | `addDecision` rejects |
| 38 | Remove action item | removeActionItem | `itemId='a1'` | "Action item removed" toast | `deleteActionItem` resolves |
| 39 | Remove action fails | removeActionItem | API rejects | Error toast | `deleteActionItem` rejects |
| 40 | Remove decision item | removeDecisionItem | `itemId='d1'` | "Decision removed" toast | `deleteDecision` resolves |
| 41 | Remove decision fails | removeDecisionItem | API rejects | Error toast | `deleteDecision` rejects |
| 42 | Reset action editor | resetActionEditor | N/A | All action form state cleared | State check |
| 43 | Reset decision editor | resetDecisionEditor | N/A | All decision form state cleared | State check |
| 44 | Compute user approval | currentUserApproval | User has APPROVED response | Returns response object | Mock approval with user response |
| 45 | Compute hasSubmitted true | hasSubmittedSummaryDecision | `currentUserApproval` exists | `true` | User voted |
| 46 | Compute hasSubmitted false | hasSubmittedSummaryDecision | No user response | `false` | User not voted |
| 47 | Compute hasAnyApproved true | hasAnyApprovedSummaryDecision | `currentApprovedCount=1` | `true` | Approval exists |
| 48 | Compute isFinalized APPROVED | isMeetingFinalized | `status='APPROVED'` | `true` | Finalized |
| 49 | Compute isFinalized REJECTED | isMeetingFinalized | `status='REJECTED'` | `true` | Finalized |
| 50 | Compute isFinalized false | isMeetingFinalized | `status='SCHEDULED'` | `false` | Not finalized |
| 51 | Compute editing disabled (finalized) | isItemEditingDisabled | `isMeetingFinalized=true` | `true` | Editing blocked |
| 52 | Compute editing disabled (voted) | isItemEditingDisabled | `hasSubmittedSummaryDecision=true` | `true` | Editing blocked |
| 53 | Compute canEdit true | canEditOrDeleteItems | Owner, editing enabled | `true` | Can edit |
| 54 | Compute canEdit false (not owner) | canEditOrDeleteItems | Not owner | `false` | Cannot edit |
| 55 | Compute canEdit false (finalized) | canEditOrDeleteItems | Owner, finalized | `false` | Cannot edit |
| 56 | Compute add disabled (voted) | isAddDisabled | `hasSubmittedSummaryDecision=true` | `true` | Add blocked |
| 57 | Compute add disabled (any approval) | isAddDisabled | `hasAnyApprovedSummaryDecision=true` | `true` | Add blocked |
| 58 | Reload summary | reloadSummaryAndApproval | `id='m1'` | Summary and approval updated | APIs resolve |
| 59 | Meeting not found | Render | `meeting=null` | "Meeting not found" message | All APIs return null/404 |
| 60 | Status badge display | Render | `status='PENDING_APPROVAL'` | Yellow badge | Status config |
| 61 | Disable buttons when voted | Render | `hasSubmittedSummaryDecision=true` | Approve buttons disabled | User response exists |
| 62 | Owner sees edit buttons | Render | `isProjectOwner=true`, editing enabled | Edit/delete buttons enabled | Owner permissions |
| 63 | Member doesn't see edit | Render | `isProjectOwner=false` | Edit buttons disabled | Non-owner |
| 64 | Decision editor opens | Render | Click "Add" button | Editor form visible | `showDecisionEditor=true` |
| 65 | Action editor opens | Render | Click "Add" button | Editor form visible | `showActionEditor=true` |
| 66 | Change modal opens | Render | Click change item | `ChangeDetailModal` visible | `selectedChange` set |
| 67 | Navigate back | Render | Click "Back to Meetings" | Navigation called | `navigate()` called |
| 68 | Navigate to decisions | Render | Click "Go to Decisions" | Navigation called | `navigate()` called |
| 69 | Navigate to changes | Render | Click "Review Changes" | Navigation called | `navigate()` called |
| 70 | Comments input disabled | Render | `hasSubmittedSummaryDecision=true` | Textarea disabled | After voting |
