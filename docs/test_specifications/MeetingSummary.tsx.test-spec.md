# Test Specification: MeetingSummary.tsx

**File**: `src/app/pages/MeetingSummary.tsx`  
**Target Coverage**: 80%+  
**Test Type**: Frontend Unit Tests with Complete Backend Isolation

---

## Executive Summary

MeetingSummary.tsx displays meeting summaries with decisions, action items, and approval workflows. It handles complex authorization logic (owner-only actions), multi-user approval flows, item editing/deletion, and approval status tracking. The component requires extensive mocking of API services and local storage for user context.

---

## Identified Functions and Execution Paths

| # | Function Name | Type | Parameters | Return Type | Key Dependencies |
|---|---|---|---|---|---|
| 1 | `reloadSummaryAndApproval` | Async Utility | `id: string` | `Promise<void>` | `apiService.getSummaryByMeeting`, `apiService.getApprovalStatus` |
| 2 | `useEffect` (data load) | Lifecycle | Dependency: `[meetingId]` | `void` | `localStorage`, `apiService` (multiple), `getProjectMembers` |
| 3 | `submitDecision` | Async Handler | `decision: 'APPROVED' \| 'REJECTED'` | `Promise<void>` | `apiService.submitSummaryApproval`, `getMeeting`, `getApprovalStatus`, `getSummaryByMeeting` |
| 4 | `approveItem` | Async Handler | `itemId: string`, `itemType: 'action' \| 'decision'` | `Promise<void>` | `apiService.approveActionItem` or `approveDecisionItem` |
| 5 | `resetActionEditor` | Sync Reset | `void` | `void` | State mutations only |
| 6 | `resetDecisionEditor` | Sync Reset | `void` | `void` | State mutations only |
| 7 | `saveActionItem` | Async Handler | `void` | `Promise<void>` | `apiService.addActionItem` or `updateActionItem` |
| 8 | `removeActionItem` | Async Handler | `itemId: string` | `Promise<void>` | `apiService.deleteActionItem` |
| 9 | `saveDecisionItem` | Async Handler | `void` | `Promise<void>` | `apiService.addDecision` or `updateDecision` |
| 10 | `removeDecisionItem` | Async Handler | `itemId: string` | `Promise<void>` | `apiService.deleteDecision` |
| 11 | `changeRequests` (useMemo) | Computed State | None | `ChangeRequest[]` | JSON parsing of `beforeState`/`afterState` |
| 12 | Authorization Logic | Derived | None | `boolean` | `currentUserApproval`, `isProjectOwner`, `isMeetingFinalized` |
| 13 | Conditional Button States | Derived | None | Disabled flags | Multiple state-derived conditions |
| 14 | Main Component Render | Render | None | JSX | All above + conditional rendering |

---

## Mock Configuration Requirements

### Mock API Service (`apiService`)

```typescript
const mockApiService = {
  getMeeting: jest.fn(),  // Returns MeetingResponse
  getSummaryByMeeting: jest.fn(),  // Returns MeetingSummaryResponse
  getApprovalStatus: jest.fn(),  // Returns ApprovalStatusResponse
  getProjectMembers: jest.fn(),  // Returns array of project members
  submitSummaryApproval: jest.fn(),  // Called with (meetingId, decision, comments?)
  approveActionItem: jest.fn(),  // Called with (itemId)
  approveDecisionItem: jest.fn(),  // Called with (itemId)
  addActionItem: jest.fn(),  // Called with (meetingId, {description, sourceContext?, priority})
  updateActionItem: jest.fn(),  // Called with (actionId, {description, sourceContext?, priority})
  deleteActionItem: jest.fn(),  // Called with (itemId)
  addDecision: jest.fn(),  // Called with (meetingId, {description, sourceContext?, impactSummary?})
  updateDecision: jest.fn(),  // Called with (decisionId, {description, sourceContext?, impactSummary?})
  deleteDecision: jest.fn(),  // Called with (itemId)
};
```

### Mock Router (`useParams`, `useNavigate`)

```typescript
const mockParams = { meetingId: 'meeting-1' };
const mockNavigate = jest.fn();
```

### Mock Local Storage

```typescript
// Mock localStorage for user context
const mockUser = { id: 'user-1', email: 'owner@test.com', name: 'Owner' };
localStorage.setItem('user', JSON.stringify(mockUser));
```

### Mock Toast Notifications (`sonner`)

```typescript
const mockToast = {
  error: jest.fn(),
  success: jest.fn(),
};
```

---

## Mock Data Fixtures

### Sample Meeting Response

```typescript
const mockMeeting: MeetingResponse = {
  id: 'meeting-1',
  title: 'Q1 Planning',
  meetingDate: '2025-03-20',
  meetingTime: '14:00',
  status: 'SCHEDULED',
  projectId: 'proj-1',
  projectName: 'E-Commerce',
};
```

### Sample Summary Response

```typescript
const mockSummary: MeetingSummaryResponse = {
  decisions: [
    {
      id: 'dec-1',
      description: 'Use React 19 for frontend',
      sourceContext: 'Tech stack discussion',
      approvalStatus: 'PENDING',
    },
  ],
  actionItems: [
    {
      id: 'act-1',
      description: 'Setup CI/CD pipeline',
      sourceContext: 'DevOps discussion',
      priority: 'HIGH',
      approvalStatus: 'PENDING',
    },
  ],
  changes: [
    {
      id: 'change-1',
      changeType: 'CREATE_CARD',
      status: 'PENDING',
      beforeState: null,
      afterState: JSON.stringify({ id: 'card-1', title: 'New feature' }),
      createdAt: '2025-03-20T14:00:00Z',
    },
  ],
  aiGeneratedContent: 'Meeting Summary...',
};
```

### Sample Approval Status Response

```typescript
const mockApprovalStatus: ApprovalStatusResponse = {
  currentApprovedCount: 1,
  responses: [
    {
      userId: 'user-1',
      userName: 'Alice',
      response: 'APPROVED',
    },
    {
      userId: 'user-2',
      userName: 'Bob',
      response: 'PENDING',
    },
  ],
};
```

### Sample Project Members Response

```typescript
const mockProjectMembers = [
  { id: 'user-1', email: 'alice@test.com', username: 'alice', role: 'owner' },
  { id: 'user-2', email: 'bob@test.com', username: 'bob', role: 'editor' },
];
```

---

## Test Cases

### Test Group 1: Component Initialization & Data Loading

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 1.1 | Load meeting data successfully | Fetch and render meeting summary | `meetingId: "meeting-1"` | All API calls succeed, user is owner | Meeting, summary, approval data loaded, component renders | Happy path |
| 1.2 | Load meeting with current user NOT owner | Set `isProjectOwner: false` | `meetingId: "meeting-1"`, current user is not owner | `getProjectMembers` returns members where no owner matches current user | `isProjectOwner: false`, edit buttons disabled | Authorization |
| 1.3 | Load meeting with no members found | Handle member lookup failure | `meetingId: "meeting-1"`, members list incomplete | `getProjectMembers` returns members but current user not found | `isProjectOwner: false` (fallback) | Error handling |
| 1.4 | Load meeting with user NOT in localStorage | Handle missing user | `meetingId: "meeting-1"`, no user in localStorage | localStorage empty | `currentUserId: null`, `isProjectOwner: false` | Edge case |
| 1.5 | Load meeting with invalid JSON in localStorage | Handle malformed user JSON | `meetingId: "meeting-1"`, user JSON invalid | localStorage.getItem returns `"invalid json"` | `currentUserId: null`, `isProjectOwner: false` | Error handling |
| 1.6 | Load meeting API error | Handle meeting fetch failure | `meetingId: "meeting-1"` | `apiService.getMeeting` throws `Error("Not found")` | Error toast "Not found" displayed, component shows not-found UI | Error handling |
| 1.7 | Load meeting without meetingId | Skip data loading if no meetingId | No meetingId provided | `useParams` returns empty object | `useEffect` returns early, no API calls made | Guard clause |
| 1.8 | Unmount before data loads | Handle component unmount during loading | Data loading in progress, component unmounts | `isMounted` flag checked in Promise resolution | Data NOT set after unmount completion | Cleanup |

### Test Group 2: Summary Approval Submission

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 2.1 | Approve summary successfully | Submit APPROVED decision with comments | `decision: "APPROVED"`, `comments: "Looks good"` | `apiService.submitSummaryApproval` succeeds | Success toast, meeting/approval/summary reloaded, form elements updated | Happy path |
| 2.2 | Reject summary successfully | Submit REJECTED decision | `decision: "REJECTED"`, no comments | `apiService.submitSummaryApproval` succeeds | Success toast "Changes requested", data reloaded | Happy path |
| 2.3 | Approve without comments | Submit approval with empty comments | `decision: "APPROVED"`, `comments: ""` | `apiService.submitSummaryApproval` called with `comments: undefined` | Success toast shown, comments field cleared | Edge case |
| 2.4 | Approval submission with isSubmitting flag | Prevent double-submit | User clicks Approve twice rapidly | First call sets `isSubmitting: true`, second click ignored | API called once only, button disabled during submission | Concurrency |
| 2.5 | Approval submission API error | Handle submission failure | `decision: "APPROVED"` | `apiService.submitSummaryApproval` throws `Error("Server error")` | Error toast shown, `isSubmitting` reset to false | Error handling |
| 2.6 | Approval after already approved | Show current user approval | User already approved, clicking Approve again | Approval response shows current user with previous response | Buttons disabled, current choice displayed | Duplicate check |

### Test Group 3: Item Approval (Actions & Decisions)

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 3.1 | Approve action item | Mark action item as approved | `itemId: "act-1"`, `itemType: "action"` | `apiService.approveActionItem` succeeds, reload succeeds | Success toast, item approval status changed to APPROVED | Happy path |
| 3.2 | Approve decision item | Mark decision item as approved | `itemId: "dec-1"`, `itemType: "decision"` | `apiService.approveDecisionItem` succeeds, reload succeeds | Success toast, item approval status changed to APPROVED | Happy path |
| 3.3 | Approve item with approvingItemId flag | Show loading state during approval | Item being approved | `approvingItemId` set to item ID during request | Button shows loading state, prevents multiple clicks | UI feedback |
| 3.4 | Approve item API error | Handle approval failure | `itemId: "act-1"` | `apiService.approveActionItem` throws `Error("Forbidden")` | Error toast "Forbidden", `approvingItemId` cleared, no state change | Error handling |

### Test Group 4: Action Item Management

#### 4A: Create Action Item

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 4.1 | Create action item with all fields | Add new action with full context | `actionDescription: "Setup monitoring"`, `sourceContext: "Ops discussion"`, `actionPriority: "HIGH"` | `apiService.addActionItem` succeeds, returns updated summary | Summary updated, editor reset, success toast "Action item added" | Happy path |
| 4.2 | Create action item minimal | Add action with only description | `actionDescription: "Fix bug"`, `sourceContext: ""`, `actionPriority: "MEDIUM"` | `apiService.addActionItem` receives `{..., sourceContext: undefined}` | API called with undefined sourceContext, item added | Edge case |
| 4.3 | Create action item empty description | Reject if no description | `actionDescription: ""` | N/A (validation check) | Save button disabled, nothing submitted | Validation |
| 4.4 | Create action item whitespace description | Trim check before submit | `actionDescription: "   "` | N/A (trim() && check) | Save button preventing submit on trim | Validation |
| 4.5 | Create action item API error | Handle creation failure | Valid inputs | `apiService.addActionItem` throws `Error("Conflict")` | Error toast "Conflict", editor NOT reset, form remains open | Error handling |
| 4.6 | Create action disabled when summarized | Cannot add if approval started | Valid inputs | `isAddDisabled: true` (approved summary exists) | Add button disabled, cannot submit | Permission logic |

#### 4B: Update Action Item

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 4.7 | Edit action item | Update existing action | Existing action clicked for edit, fields modified | `apiService.updateActionItem` succeeds, summary updated | Summary refreshed, editor reset, success toast "Action item updated" | Happy path |
| 4.8 | Edit action with cleared source context | Update with optional field removed | Source context cleared to empty | `apiService.updateActionItem` receives `sourceContext: undefined` | API call made with undefined field | Edge case |
| 4.9 | Edit action API error | Handle update failure | Action fields modified | `apiService.updateActionItem` throws `Error("Not found")` | Error toast "Not found", form NOT reset | Error handling |
| 4.10 | Edit action disabled for non-owner | Non-owner cannot edit | User is not owner | `canEditOrDeleteItems: false` | Edit button disabled, pencil button grey | Authorization |

#### 4C: Delete Action Item

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 4.11 | Delete action item | Remove action item | `itemId: "act-1"` in removal call | `apiService.deleteActionItem` succeeds, summary updated | Summary refreshed, success toast "Action item removed" | Happy path |
| 4.12 | Delete action item API error | Handle deletion failure | `itemId: "act-1"` | `apiService.deleteActionItem` throws `Error("Conflict")` | Error toast "Conflict", isSavingItem cleared | Error handling |
| 4.13 | Delete action disabled for non-owner | Non-owner cannot delete | User is not owner | `canEditOrDeleteItems: false` | Trash button disabled, not clickable | Authorization |

### Test Group 5: Decision Item Management

#### 5A: Create Decision Item

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 5.1 | Create decision with all fields | Add decision with context and impact | `decisionDescription: "Use PostgreSQL"`, `sourceContext: "DB discussion"`, `decisionImpactSummary: "Improves scalability"` | `apiService.addDecision` succeeds, summary updated | Summary updated, editor reset, success toast "Decision added" | Happy path |
| 5.2 | Create decision minimal | Add decision with only description | `decisionDescription: "Frontend: React"`, other fields empty | `apiService.addDecision` receives optional fields as `undefined` | API called with undefined optional fields | Edge case |
| 5.3 | Create decision empty description | Reject empty decision | `decisionDescription: ""` | N/A (validation) | Save button disabled | Validation |
| 5.4 | Create decision API error | Handle creation failure | Valid decision fields | `apiService.addDecision` throws `Error("Server error")` | Error toast, editor remains open | Error handling |
| 5.5 | Create decision disabled when finalized | Cannot add if meeting finalized | Valid inputs, `isMeetingFinalized: true` | Meeting status is APPROVED/REJECTED | Add button disabled | Permission logic |

#### 5B: Update Decision Item

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 5.6 | Edit decision item | Update existing decision | Existing decision clicked, fields modified | `apiService.updateDecision` succeeds | Summary refreshed, editor reset, success toast "Decision updated" | Happy path |
| 5.7 | Edit decision API error | Handle update failure | Decision fields modified | `apiService.updateDecision` throws `Error("Forbidden")` | Error toast "Forbidden", form NOT reset | Error handling |
| 5.8 | Edit decision disabled for non-owner | Non-owner cannot edit | User is not owner | `canEditOrDeleteItems: false` | Edit button disabled | Authorization |

#### 5C: Delete Decision Item

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 5.9 | Delete decision item | Remove decision | `itemId: "dec-1"` | `apiService.deleteDecision` succeeds | Summary updated, success toast "Decision removed" | Happy path |
| 5.10 | Delete decision API error | Handle deletion failure | `itemId: "dec-1"` | `apiService.deleteDecision` throws `Error("Conflict")` | Error toast, isSavingItem cleared | Error handling |

### Test Group 6: State Reset Functions

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 6.1 | Reset action editor | Clear all action editing state | Editor is open for action | `resetActionEditor()` called | All action fields cleared, `editingActionId: null`, `showActionEditor: false` | State cleanup |
| 6.2 | Reset decision editor | Clear all decision editing state | Editor is open for decision | `resetDecisionEditor()` called | All decision fields cleared, `editingDecisionId: null`, `showDecisionEditor: false` | State cleanup |

### Test Group 7: Change Requests (Parsed from Summary)

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 7.1 | Parse change with valid JSON states | Convert beforeState/afterState JSON strings | Summary has change with `beforeState: '{"id":"1"}'`, `afterState: '{"title":"new"}'` | memoized `changeRequests` computed | ChangeRequest object with parsed `before` and `after` objects | Happy path |
| 7.2 | Parse change with invalid beforeState JSON | Handle malformed JSON gracefully | `beforeState: "invalid json"` | try/catch in memo | `before: undefined`, change object still created | Error handling |
| 7.3 | Parse change with null states | Handle null state values | `beforeState: null`, `afterState: null` | memoized compute | `before: undefined`, `after: undefined` | Edge case |
| 7.4 | Empty changes list | Handle no changes scenario | `summary.changes: []` | Memo computed with empty array | `changeRequests: []` | Empty result |

### Test Group 8: Authorization & Permission Logic

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 8.1 | Owner can edit/delete items | Verify owner has permissions | User is owner, meeting not finalized | `isProjectOwner: true`, `isMeetingFinalized: false` | `canEditOrDeleteItems: true`, edit buttons enabled | Authorization |
| 8.2 | Non-owner cannot edit items | Verify non-owner restricted | User is not owner | `isProjectOwner: false` | `canEditOrDeleteItems: false`, edit buttons disabled | Authorization |
| 8.3 | Owner cannot edit after approving | Disable edits after personal approval | User is owner, already approved | `hasSubmittedSummaryDecision: true` | `isItemEditingDisabled: true`, edit buttons disabled | Authorization |
| 8.4 | Cannot add items after approval | Disable add when summary approved | Any user, summary has approvals | `hasAnyApprovedSummaryDecision: true` | `isAddDisabled: true`, Add buttons disabled | Authorization |
| 8.5 | Cannot edit when meeting finalized | Disable all editing when meeting complete | Meeting status is APPROVED/REJECTED | `isMeetingFinalized: true` | `isItemEditingDisabled: true`, all edit buttons disabled | Authorization |
| 8.6 | Current user approval detection | Identify if current user approved | Current user approved, other users pending | Check `currentUserApproval` | `hasSubmittedSummaryDecision: true`, shows "You already responded" | Authorization |

### Test Group 9: Rendering & Conditional Display

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 9.1 | Render meeting not found | Show not-found state | Meeting data is null | `meeting: null` | Shows "Meeting not found" message, Back button visible | Not found |
| 9.2 | Render meeting details header | Display meeting info | Meeting loaded | Meeting data present | Meeting title, date, time, project name all displayed | Happy path |
| 9.3 | Render meetings status badge | Show correct status color | Meeting status: APPROVED | Status config mapping applied | Badge shows green "Approved" color/text | Status UI |
| 9.4 | Render decisions section | Display decision list | Summary with decisions | Decisions array populated | Each decision shown with description, approval status, action buttons | List rendering |
| 9.5 | Render action items section | Display action items list | Summary with action items | Action items array populated | Each action shown with description, priority, approval status, buttons | List rendering |
| 9.6 | Render approval responses | Show approval from each user | Approval responses from multiple users | Approval data with responses array | Each response shown as badge with username and response | List rendering |
| 9.7 | Render decision editor | Show editor form when adding | User clicks Add under Decisions | `showDecisionEditor: true` | Input fields visible, Save/Cancel buttons enabled | Form UI |
| 9.8 | Render action editor | Show editor form when adding | User clicks Add under Actions | `showActionEditor: true` | Input fields visible, priority select visible, Save/Cancel enabled | Form UI |
| 9.9 | Render ChangeDetailModal | Display change details when selected | Change clicked from list | `selectedChange` set | Modal rendered with change details, onClose handler passed | Conditional render |
| 9.10 | Render empty decisions state | Show empty message | No decisions in summary | `summary.decisions: []` | "No decisions yet" message displayed | Empty state |
| 9.11 | Render empty action items state | Show empty message | No action items in summary | `summary.actionItems: []` | "No action items yet" message displayed | Empty state |

### Test Group 10: UI Interactions & State Management

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 10.1 | Toggle action editor visibility | Open/close action editor | User clicks Add button | `showActionEditor: false` → `true` | Editor form appears, fields initialized | State toggle |
| 10.2 | Toggle decision editor visibility | Open/close decision editor | User clicks Add button | `showDecisionEditor: false` → `true` | Editor form appears, fields initialized | State toggle |
| 10.3 | Update action description field | Change description input | User types in action description field | `setActionDescription` called with new value | State updated, input reflects new value | Input handling |
| 10.4 | Update action priority dropdown | Change priority selection | User selects HIGH from dropdown | `setActionPriority("HIGH")` | State updated, dropdown shows HIGH | Select handling |
| 10.5 | Update decision description field | Change description input | User types in decision description field | `setDecisionDescription` called with new value | State updated, input reflects new value | Input handling |
| 10.6 | Update comments field | Change approval comments | User types in comments textarea | `setComments` called with new value | State updated, textarea reflects new value | Textarea handling |
| 10.7 | Comments disabled when already approved | Prevent comment editing after vote | User already approved | `hasSubmittedSummaryDecision: true` | Comments textarea disabled, cannot type | Permission UI |

### Test Group 11: Complex Data Flows

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 11.1 | Reload summary after item save | Refresh data after add/update/delete | Action item saved | `reloadSummaryAndApproval` called with meetingId | Both summary AND approval data reloaded from API | Data sync |
| 11.2 | Maintain user context through reloads | User ID persisted across data fetches | User ID in localStorage | Check localStorage once on mount, persist through lifecycle | `currentUserId` stable, multiple reloads work | State persistence |
| 11.3 | Owner check requires projectMembers fetch | Verify owner requires API call | User is stored, meeting fetched | `getProjectMembers` must be called to verify owner status | Member lookup performed, role checked | Complex fetch |
| 11.4 | Changes computed from summary | Parse changes from nested summary data | Summary includes changes array | Memo recomputes changeRequests when summary changes | changeRequests updated whenever summary updates | Computed state |
| 11.5 | Approval counts trigger UI disable | Add button disabled when approvals exist | Summary has ApprovalStatusResponse with responses | `hasAnyApprovedSummaryDecision` checked | Add buttons disabled based on approval count | Derived state |

### Test Group 12: Error Message Handling & Toast Notifications

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 12.1 | Generic error handling in load | Show error message from API | Data loading fails | `apiService.getMeeting` throws `Error("Network error")` | Toast shows "Network error" | Error display |
| 12.2 | Generic fallback error text | Show default message for unknown errors | Operation fails with generic error | Any API throws non-Error type | Toast shows "Failed to [operation]" default text | Fallback message |
| 12.3 | Submit approval error message | Display submission error | Approval submission fails | `submitSummaryApproval` throws `Error("Invalid state")` | Toast shows "Invalid state" | Error display |
| 12.4 | Item save error message | Display save error detail | Action/decision save fails | `addActionItem` throws `Error("Validation error")` | Toast shows "Validation error" | Error display |

---

## Critical Test Execution Notes

1. **Local Storage Mocking**: Mock localStorage.getItem/setItem for user context
2. **Async API Calls**: Use `waitFor()` for all async operations; test both success and error paths
3. **Authorization Flow**: Test combinations of owner/non-owner + approval states
4. **JSON Parsing**: Test valid/invalid JSON strings in beforeState/afterState
5. **Disabled States**: Verify button disabled attributes reflect all permission conditions
6. **State Cleanup**: Verify editor state reset when canceling or after save
7. **Modal Rendering**: Check ChangeDetailModal props pass correctly
8. **Memoization**: Verify changeRequests only recomputes when dependencies change
9. **Multiple Reloads**: Test that reload functions properly update both summary AND approval data
10. **Unmounting**: Verify isMounted flag prevents state updates after unmount

---

## Coverage Summary

| Category | Count | Coverage % |
|---|---|---|
| Total Functions | 14 | ~100% |
| Execution Paths | 82 | ~95% |
| Happy Paths | 14 | 100% |
| Error Paths | 26 | 100% |
| Authorization Paths | 15 | 100% |
| Edge Cases | 27 | 100% |
| **Overall Coverage Target** | **82 tests** | **~93%** |
