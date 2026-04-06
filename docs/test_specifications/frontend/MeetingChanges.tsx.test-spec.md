# Test Specification: MeetingChanges.tsx

**File**: `src/app/pages/MeetingChanges.tsx`  
**Target Coverage**: 80%+  
**Test Type**: Frontend Unit Tests with Complete Backend Isolation

---

## Executive Summary

MeetingChanges.tsx displays board changes from a meeting with apply-to-board functionality. It handles change parsing, stale target detection (when referenced cards no longer exist), role-based authorization (only project owner can apply), error recovery with normalized messages, and real-time UI feedback for applied changes.

---

## Identified Functions and Execution Paths

| # | Function Name | Type | Parameters | Return Type | Key Dependencies |
|---|---|---|---|---|---|
| 1 | `getApplyErrorMessage` | Error Normalizer | `error: unknown` | `string` | Error message parsing for specific scenarios |
| 2 | `refreshMeetingChanges` | Async Utility | `activeMeetingId: string` | `Promise<void>` | `apiService.getMeeting`, `apiService.listChanges` |
| 3 | `refreshProjectBoardState` | Async Utility | `projectId: string` | `Promise<void>` | `apiService.getUserProjects`, `apiService.getProject` |
| 4 | `getTargetCardId` | Extractor | `change: ChangeRequest` | `string \| null` | No external dependencies |
| 5 | `hasMissingTargetCard` | Stale Detector | `change: ChangeRequest` | `boolean` | `currentProject`, `getTargetCardId` |
| 6 | `handleApplyToBoard` | Async Handler | `changeId: string` | `Promise<void>` | `apiService.applyChange`, refresh utilities |
| 7 | `getChangeDescription` | Formatter | `change: ChangeRequest` | `string` | No external dependencies |
| 8 | `useEffect` (load changes) | Lifecycle | Dependency: `[meetingId]` | `void` | API services, user authorization check |
| 9 | Main Component Render | Render | None | JSX | All above + conditional rendering |

---

## Mock Configuration Requirements

### Mock API Service (`apiService`)

```typescript
const mockApiService = {
  getMeeting: jest.fn(),  // Returns MeetingResponse
  listChanges: jest.fn(),  // Called with { meetingId }, returns ChangeResponse[]
  getProject: jest.fn(),  // Called with (projectId), returns ProjectResponse
  getUserProjects: jest.fn(),  // Returns ProjectResponse[]
  applyChange: jest.fn(),  // Called with (changeId), returns { message: string }
};
```

### Mock Router (`useParams`, `useNavigate`)

```typescript
const mockParams = { meetingId: 'meeting-1' };
const mockNavigate = jest.fn();
```

### Mock Project Store (`useProjectStore`)

```typescript
const mockProjectStore = {
  setProjects: jest.fn(),  // Called with Project[] after board refresh
};
```

### Mock Local Storage

```typescript
// Mock localStorage for user context
const mockUser = { id: 'user-1', email: 'owner@test.com' };
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
  title: 'Sprint Planning',
  meetingDate: '2025-03-20',
  meetingTime: '10:00',
  status: 'SCHEDULED',
  projectId: 'proj-1',
  projectName: 'Mobile App',
};
```

### Sample Changes Response

```typescript
const mockChanges = [
  {
    id: 'change-1',
    meetingId: 'meeting-1',
    changeType: 'CREATE_CARD',
    status: 'PENDING',
    beforeState: null,
    afterState: JSON.stringify({
      id: 'card-new',
      title: 'New Feature',
      columnTitle: 'Backlog',
    }),
    createdAt: '2025-03-20T10:00:00Z',
  },
  {
    id: 'change-2',
    meetingId: 'meeting-1',
    changeType: 'MOVE_CARD',
    status: 'PENDING',
    beforeState: JSON.stringify({
      id: 'card-1',
      title: 'Existing Feature',
      columnTitle: 'Backlog',
    }),
    afterState: JSON.stringify({
      id: 'card-1',
      title: 'Existing Feature',
      columnTitle: 'In Progress',
    }),
    createdAt: '2025-03-20T10:05:00Z',
  },
  {
    id: 'change-3',
    meetingId: 'meeting-1',
    changeType: 'UPDATE_CARD',
    status: 'APPLIED',
    beforeState: JSON.stringify({
      id: 'card-2',
      title: 'Old Title',
      description: 'Old desc',
    }),
    afterState: JSON.stringify({
      id: 'card-2',
      title: 'New Title',
      description: 'New desc',
    }),
    createdAt: '2025-03-20T10:10:00Z',
  },
];
```

### Sample Project Response

```typescript
const mockProject: ProjectResponse = {
  id: 'proj-1',
  name: 'Mobile App',
  description: 'Main project',
  board_id: 'board-1',
  members: [
    {
      id: 'user-1',
      email: 'owner@test.com',
      username: 'owner',
      role: 'owner',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      email: 'editor@test.com',
      username: 'editor',
      role: 'editor',
      created_at: '2025-01-01T00:00:00Z',
    },
  ],
  columns: [
    { id: 'col-1', title: 'Backlog', color: 'bg-purple-100' },
    { id: 'col-2', title: 'In Progress', color: 'bg-blue-100' },
  ],
  tasks: [
    {
      id: 'card-1',
      title: 'Existing Feature',
      description: '',
      column_id: 'col-1',
      priority: 'MEDIUM',
    },
    {
      id: 'card-2',
      title: 'New Title',
      description: 'New desc',
      column_id: 'col-2',
      priority: 'HIGH',
    },
  ],
};
```

---

## Test Cases

### Test Group 1: Component Initialization & Data Loading

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 1.1 | Load meeting changes successfully | Fetch and render changes list | `meetingId: "meeting-1"` | All API calls succeed, user is owner | Meeting, changes, project, and permissions loaded | Happy path |
| 1.2 | Load changes as non-owner | Set read-only mode for non-owner | `meetingId: "meeting-1"`, user is editor | `getProject` returns members where user is not owner | `canApplyChanges: false`, Apply buttons disabled | Authorization |
| 1.3 | Load changes without meetingId | Skip data loading if no meetingId | No meetingId provided | `useParams` returns empty object | `useEffect` returns early, no API calls made | Guard clause |
| 1.4 | Load changes API error | Handle changes fetch failure | `meetingId: "meeting-1"` | `apiService.listChanges` throws `Error("Server error")` | Error toast "Server error", component shows empty state | Error handling |
| 1.5 | Load meeting API error | Handle meeting fetch failure | `meetingId: "meeting-1"` | `apiService.getMeeting` throws `Error("Not found")` | Error toast "Not found", component shows not-found UI | Error handling |
| 1.6 | Load project API error | Handle project fetch failure | `meetingId: "meeting-1"` | `apiService.getProject` throws `Error("Forbidden")` | Error toast, `canApplyChanges: false`, `currentProject: null` | Error handling |
| 1.7 | Owner identification with user mismatch | Set `canApplyChanges: false` if user not owner | User ID doesn't match owner | `getProject` returns owner with different ID | `canApplyChanges: false` | Authorization |
| 1.8 | Empty user from localStorage | Handle missing user gracefully | localStorage.getItem returns null | `getProject` called without user context | `canApplyChanges: false` (no user to check) | Edge case |
| 1.9 | Unmount during data load | Handle component unmount during loading | Data loading in progress, component unmounts | `isMounted` flag checked in Promise resolution | Data NOT set after unmount, no setState warnings | Cleanup |

### Test Group 2: Error Message Normalization

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 2.1 | Card not found error | Normalize "card not found" message | Error from API: `"Card not found in database"` | `getApplyErrorMessage()` receives Error with this message | Returns "This change references a card that no longer exists..."  | Error normalization |
| 2.2 | Card not found variant | Alternative "card not found" phrasing | Error: `"Could not resolve card: ID not found"` | `getApplyErrorMessage()` receives this error | Returns "This change references a card that no longer exists..." | Error normalization |
| 2.3 | Stage not found error | Normalize "stage not found" message | Error: `"Stage not found in database"` | `getApplyErrorMessage()` receives this error | Returns "This change references a column that no longer exists..." | Error normalization |
| 2.4 | Stage not found variant | Alternative "stage not found" phrasing | Error: `"Could not resolve stage: ID not found"` | `getApplyErrorMessage()` receives this error | Returns "This change references a column that no longer exists..." | Error normalization |
| 2.5 | Generic error passthrough | Return original message for other errors | Error: `"Permission denied"` | `getApplyErrorMessage()` receives this error | Returns "Permission denied" (unchanged) | Passthrough logic |
| 2.6 | Error message case insensitivity | Handle error messages with different cases | Error: `"CARD NOT FOUND"` | `getApplyErrorMessage()` receives uppercase error | Normalized message returned (compare lowercase) | Case handling |
| 2.7 | Non-Error object handling | Extract message from non-Error object | Error: `{ message: "Failed" }` or string `"Failed"` | `getApplyErrorMessage()` receives non-Error | Returns raw message or default | Non-Error handling |

### Test Group 3: Target Card Extraction

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 3.1 | Extract card ID from after state | Get ID from afterState when present | Change with `afterState: {id: "card-1", ...}` | `before: undefined`, `after: {id: "card-1"}` | Returns `"card-1"` | Happy path |
| 3.2 | Extract card ID from before state | Fall back to beforeState ID | Change with `beforeState: {id: "card-1", ...}`, `afterState: {id: "card-2", ...}` | `before: {id: "card-1"}`, `after: {id: "card-2"}` | Returns `"card-2"` (afterState has priority) | Extraction priority |
| 3.3 | Extract card ID before state only | Use beforeState when afterState missing | Change for deletion with only beforeState | `before: {id: "card-1", ...}`, `after: undefined` | Returns `"card-1"` | Fallback logic |
| 3.4 | Card ID not string | Return null for non-string IDs | Change with `afterState: {id: 123, ...}` (number) | `after: {id: 123}` | Returns `null` (type check) | Type safety |
| 3.5 | No card ID found | Return null when both states lack ID | Change with `afterState: {title: "Card", ...}`, no ID | `after: {title: "Card"}` | Returns `null` | Edge case |
| 3.6 | Both states null/undefined | Return null | Change with `before: undefined`, `after: undefined` | Both states undefined | Returns `null` | Edge case |

### Test Group 4: Stale Target Detection

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 4.1 | Detect stale target for UPDATE_CARD | Mark as stale if card missing | `type: "UPDATE_CARD"`, `cardId: "card-99"` (not in project) | `currentProject.tasks` doesn't include "card-99" | `hasMissingTargetCard()` returns `true` | Happy path |
| 4.2 | Detect stale target for MOVE_CARD | Mark as stale if moved card missing | `type: "MOVE_CARD"`, `cardId: "card-deleted"` (removed) | `currentProject.tasks` doesn't include "card-deleted" | `hasMissingTargetCard()` returns `true` | Happy path |
| 4.3 | Detect stale target for DELETE_CARD | Mark as stale if deleted card missing | `type: "DELETE_CARD"`, `cardId: "card-gone"` | `currentProject.tasks` doesn't include "card-gone" | `hasMissingTargetCard()` returns `true` | Happy path |
| 4.4 | Skip stale check for CREATE_CARD | Never mark CREATE_CARD as stale | `type: "CREATE_CARD"`, `cardId: null` (no card exists yet) | CREATE_CARD, `getTargetCardId()` returns null | `hasMissingTargetCard()` returns `false` (exempted) | Logic exception |
| 4.5 | Card exists (not stale) | Return false when card found | `type: "UPDATE_CARD"`, `cardId: "card-1"` (exists) | `currentProject.tasks` includes `{id: "card-1", ...}` | `hasMissingTargetCard()` returns `false` | Happy path |
| 4.6 | No target card ID | Return false when ID cannot be extracted | Change without card ID | `getTargetCardId()` returns `null` | `hasMissingTargetCard()` returns `false` (guard) | Guard clause |
| 4.7 | No current project | Return false when project unavailable | No project loaded | `currentProject: null` | `hasMissingTargetCard()` returns `false` (guard) | Guard clause |

### Test Group 5: Apply Change to Board

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 5.1 | Apply change successfully | Apply pending change to board | `changeId: "change-1"`, change is PENDING | `apiService.applyChange` succeeds, refresh APIs succeed | Success toast "Change applied to board", status changes to APPLIED | Happy path |
| 5.2 | Apply change with stale target | Prevent apply if target card missing | `changeId: "change-1"`, `hasMissingTargetCard: true` | Change has missing target | Error toast "Cannot apply... target card no longer exists", applyChange NOT called | Prevention |
| 5.3 | Apply change API error | Handle apply failure gracefully | `changeId: "change-1"` | `apiService.applyChange` throws `Error("Conflict")` | Error toast, still attempt to refresh but show error | Error handling |
| 5.4 | Apply change with card not found error | Normalize card not found message | `changeId: "change-1"` | `apiService.applyChange` throws `Error("Card not found")` | Error toast shows normalized "references a card that no longer exists" message | Error handling |
| 5.5 | Apply change with stage not found error | Normalize stage not found message | `changeId: "change-1"` | `apiService.applyChange` throws `Error("Could not resolve stage")` | Error toast shows normalized "references a column that no longer exists" message | Error handling |
| 5.6 | Apply change sets loading state | Show "Applying..." during submission | User clicks Apply | `applyingChangeId` set to change ID | Button shows "Applying..." text and disabled | UI feedback |
| 5.7 | Apply change sets success state | Show "Applied" after success | Change applied successfully | `appliedSuccessChangeId` set to change ID | Button shows "Applied" and disabled | UI feedback |
| 5.8 | Apply change clears loading state | Reset loading state after complete | Apply completes (success or error) | Request completes | `applyingChangeId` reset to `null` | State cleanup |
| 5.9 | Non-owner cannot apply | Disable apply for non-owners | `canApplyChanges: false` | User is not owner | Apply button disabled, click does nothing | Authorization |
| 5.10 | Already applied change cannot be re-applied | Disable apply if status is APPLIED | Change has `status: "APPLIED"` | Previous apply was successful | Apply button disabled, shows "Applied" | Idempotency |
| 5.11 | Refresh both meeting and project after apply | Update all data after successful apply | Apply succeeds | Both `refreshMeetingChanges` and `refreshProjectBoardState` called | Meeting changes reloaded, project board state updated, store updated | Data sync |

### Test Group 6: Refresh Utilities

#### 6A: Refresh Meeting Changes

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 6.1 | Refresh meeting changes successfully | Reload changes list and meeting | `meetingId: "meeting-1"` | Both APIs succeed, changes parsed | `meeting` updated, `changes` array reloaded with parsed before/after | Happy path |
| 6.2 | Refresh with invalid JSON in changes | Handle malformed state JSON | Changes with `beforeState: "bad json"` | parse() throws in try/catch | `before: undefined` (fallback), change still added to list | Error handling |
| 6.3 | Refresh updates change description | Display updated change descriptions | Change title changed in responses | `getChangeDescription()` uses after/before state | UI shows updated description | Data update |

#### 6B: Refresh Project Board State

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 6.4 | Refresh project board state | Update project and store | `projectId: "proj-1"` | Both APIs succeed, projects mapped | `currentProject` updated, `setProjects` called with mapped projects | Happy path |
| 6.5 | Refresh merges with other projects | Update target project, keep others | Multiple projects exist, one updated | `getUserProjects` returns all, `getProject` returns updated one | Only target project updated in merged array | Data merge |
| 6.6 | Refresh with mapProjectResponseToProject | Ensure mapping applied to all | Projects in response | `mapProjectResponseToProject` called for each | Mapped projects passed to `setProjects` | Data transformation |

### Test Group 7: Change Description Formatting

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 7.1 | Describe CREATE_CARD change | Format creation message | `type: "CREATE_CARD"`, `after: {title: "New Feature"}` | Extract title from afterState | Returns `"Create new card: New Feature"` | Happy path |
| 7.2 | Describe DELETE_CARD change | Format deletion message | `type: "DELETE_CARD"`, `before: {title: "Old Feature"}` | Extract title from beforeState | Returns `"Delete card: Old Feature"` | Happy path |
| 7.3 | Describe UPDATE_CARD change | Format update message | `type: "UPDATE_CARD"`, `after: {title: "Updated"}` | Extract title from afterState | Returns `"Update card: Updated"` | Happy path |
| 7.4 | Describe MOVE_CARD change | Format move with column names | `type: "MOVE_CARD"`, `before: {title: "Task", columnTitle: "Backlog"}`, `after: {title: "Task", columnTitle: "In Progress"}` | Extract from both states | Returns `"Move card: Task (Backlog → In Progress)"` | Happy path |
| 7.5 | Describe change with missing title | Use "Untitled" fallback | `after: {}` (no title) | Title extraction fails | Returns `"[Operation] Untitled"` | Fallback |
| 7.6 | Describe MOVE_CARD with stageTitle alternative | Support stageTitle as column name | `before: {stageTitle: "todo"}`, `after: {stageTitle: "done"}` (API sends stageTitle) | Extract from stageTitle field instead of columnTitle | Returns `"Move card: [title] (todo → done)"` | Variation |
| 7.7 | Describe unknown change type | Default to title for unrecognized type | `type: "UNKNOWN_TYPE"`, `after: {title: "Task"}` | Type not in switch | Returns `"Task"` (default case) | Fallback |

### Test Group 8: Component Rendering

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 8.1 | Render header with navigation | Show back button and title | Meeting loaded | Meeting data present | Back button, "Board Changes" title, meeting title displayed | Happy path |
| 8.2 | Render empty changes state | Show empty message | No changes in summary | `changes: []` | Center-aligned "No changes" message displayed | Empty state |
| 8.3 | Render changes list | Display all changes | Multiple changes present | Changes array populated | Each change rendered as card with description and button | List rendering |
| 8.4 | Render meeting not found | Show not-found state | Meeting data is null | `meeting: null` | Shows "Meeting not found" message, Back button visible | Not found |
| 8.5 | Render change badge | Show change type badge | Change with `type: "MOVE_CARD"` | Type config mapping applied | Badge shows "Move Card" with blue styling | Status UI |
| 8.6 | Render applied badge | Show applied indicator | Change with `status: "APPLIED"` | Status is APPLIED | Green "Applied" badge shown alongside type badge | Status UI |
| 8.7 | Render stale target badge | Show stale warning | Change with `staleTarget: true` | `hasMissingTargetCard()` returns true | Amber "Target missing" badge displayed | Status UI |
| 8.8 | Render stale target message | Show stale warning text | Stale change, not yet applied | Status not APPLIED, `staleTarget: true` | Warning message "This change references a card that no longer exists" displayed | Warning UI |
| 8.9 | Render apply success message | Show checkmark and success text | Change successfully applied | `appliedSuccessChangeId === changeId` | Green success message with CheckCircle2 icon shown | Success UI |
| 8.10 | Render ChangeDetailModal | Display change details when clicked | Change selected | `selectedChange` set and `open: true` | Modal rendered with change details from ChangeDetailModal component | Conditional render |

### Test Group 9: Apply Button States and Labels

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 9.1 | Apply button initial state | Show "Apply to Board" when read to apply | New change, `canApplyChanges: true` | `status: "PENDING"`, `staleTarget: false` | Button shows "Apply to Board", enabled | Happy path |
| 9.2 | Apply button loading state | Show "Applying..." during submission | Apply in progress | `applyingChangeId === changeId` | Button text shows "Applying...", disabled | Loading state |
| 9.3 | Apply button success state | Show "Applied" after successful apply | Apply completed successfully | `appliedSuccessChangeId === changeId` or `status: "APPLIED"` | Button shows "Applied", disabled | Success state |
| 9.4 | Apply button read-only state | Show "Read Only" for non-owner | `canApplyChanges: false` | User is not owner | Button shows "Read Only", disabled | Authorization |
| 9.5 | Apply button stale target state | Show "Stale Target" for missing cards | `staleTarget: true` | `hasMissingTargetCard()` true and status not APPLIED | Button shows "Stale Target", disabled | Stale state |
| 9.6 | Apply button already applied state | Show "Applied" when status is APPLIED | `status: "APPLIED"` | Previous apply succeeded | Button shows "Applied", disabled | Idempotency |

### Test Group 10: User Interaction & Events

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 10.1 | Click change to open modal | Select change for detail view | User clicks change card | `setSelectedChange` called with change object | ChangeDetailModal opens with change data | Interaction |
| 10.2 | Stop propagation on apply button | Prevent card selection when applying | User clicks Apply button on change card | Click handler uses `e.stopPropagation()` | `handleApplyToBoard` called, modal NOT opened | Event handling |
| 10.3 | Close modal | Deselect change | User closes ChangeDetailModal | `setSelectedChange(null)` called | Modal closed, `selectedChange` cleared | Interaction |
| 10.4 | Navigate back to meeting | Return to meeting summary | User clicks back button | `navigate()` called with meeting path | Navigation happens to `/meetings/[meetingId]` | Navigation |

### Test Group 11: Authorization & Permission Logic

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 11.1 | Owner can apply changes | Verify owner has apply permission | User is owner of project | `canApplyChanges: true` | Apply buttons enabled, can submit changes | Authorization |
| 11.2 | Non-owner cannot apply | Verify non-owner restricted | User is editor or viewer | `canApplyChanges: false` | Apply buttons show "Read Only", disabled | Authorization |
| 11.3 | Owner ID matching | Verify owner detection by ID match | Current user ID matches owner ID | `owner.id === currentUserId` | `canApplyChanges: true` | Authorization |
| 11.4 | Owner ID mismatch | Disable apply if user ID doesn't match owner | Current user ID differs from owner ID | `owner?.id !== currentUserId` | `canApplyChanges: false` | Authorization |

### Test Group 12: Complex Data Flows & Edge Cases

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 12.1 | Handle multiple state updates after apply | Ensure changes and project both updated | Apply succeeds, refresh both data sources | Both `refreshMeetingChanges` and `refreshProjectBoardState` complete | UI shows updated change status AND updated project in store | Data sync |
| 12.2 | Handle change state JSON parsing errors | Safely handle malformed JSON in before/after | Multiple changes with mixed valid/invalid JSON | Some parse, some fallback to undefined | Mixed changes rendered, no crashes | Robustness |
| 12.3 | Handle multiple applies sequentially | Ensure idempotency of apply operation | Same change applied twice | Second apply prevented by status check or API idempotency | No errors, UI shows "Applied" | Idempotency |
| 12.4 | Handle rapid project state changes | Ensure latest project state used | Board changes during apply request | Refresh returns latest project state | Latest state reflected in store and `currentProject` | Latest state |

---

## Critical Test Execution Notes

1. **Local Storage Mocking**: Mock localStorage.getItem for user context
2. **Async API Calls**: Use `waitFor()` for all async operations; test both success and error paths
3. **Authorization Flow**: Test combinations of owner/non-owner status
4. **JSON Parsing**: Test valid/invalid JSON in beforeState/afterState with try/catch verification
5. **Stale Detection**: Verify hasMissingTargetCard() works for all change types except CREATE_CARD
6. **Error Messages**: Test normalized error messages for card/stage not found scenarios
7. **State Management**: Verify shop updates via `setProjects` after board refresh
8. **Multiple Refreshes**: Test that both refresh utilities called sequentially after apply
9. **Button States**: Verify all conditional button states and disabled attributes
10. **Modal Props**: Check ChangeDetailModal receives correct props and callbacks
11. **Case Insensitivity**: Error message normalization should work with any case
12. **Unmounting**: Verify isMounted flag prevents state updates after unmount

---

## Coverage Summary

| Category | Count | Coverage % |
|---|---|---|
| Total Functions | 9 | ~100% |
| Execution Paths | 110 | ~95% |
| Happy Paths | 16 | 100% |
| Error Paths | 24 | 100% |
| Authorization Paths | 8 | 100% |
| Edge Cases | 40 | 100% |
| Data Transformation | 12 | 100% |
| **Overall Coverage Target** | **110 tests** | **~95%** |

---

## Key Testing Challenges & Solutions

### Challenge 1: Stale Target Detection
**Complex Logic**: The `hasMissingTargetCard()` function requires accurate card ID extraction and project state comparison.
**Solution**: Mock `currentProject.tasks` with specific card IDs and test all change type variations (CREATE_CARD exempted).

### Challenge 2: Error Message Normalization
**Complex Logic**: Error messages must be normalized for specific scenarios (card/stage not found) while preserving others.
**Solution**: Test exact error string matching (case-insensitive) and verify normalized output for each scenario.

### Challenge 3: Dual Refresh Operations
**Asynchronous Complexity**: After apply, both `refreshMeetingChanges` and `refreshProjectBoardState` must complete, updating different parts of state.
**Solution**: Mock both API calls and verify both are called and state updated correctly via `waitFor()`.

### Challenge 4: Owner Authorization Verification
**Dynamic Logic**: Owner status determined by comparing current user ID with owner member object.
**Solution**: Test with user in localStorage, mock member list with varying role assignments, verify `canApplyChanges` flag.

### Challenge 5: JSON Parsing Resilience
**Malformed Data**: beforeState/afterState may contain invalid JSON; failures must be caught gracefully.
**Solution**: Test mixed valid/invalid JSON scenarios, verify `undefined` fallback for parse errors, ensure no unhandled exceptions.
