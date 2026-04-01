# Test Specification: KanbanBoard.tsx

**File**: `src/app/pages/KanbanBoard.tsx`  
**Target Coverage**: 80%+  
**Test Type**: Frontend Unit Tests with Complete Backend Isolation

---

## Executive Summary

KanbanBoard.tsx is a React component for managing kanban-style board operations including task management (move, update, delete, create) and column management (add, rename, delete). The component integrates with Redux-like state management (projectStore) and REST API services, requiring comprehensive mocking of all backend dependencies.

---

## Identified Functions and Execution Paths

| # | Function Name | Type | Parameters | Return Type | Key Dependencies |
|---|---|---|---|---|---|
| 1 | `handleMoveTask` | Async Handler | `taskId: string, newColumnId: string` | `Promise<void>` | `apiService.moveCard`, `moveTask` from store |
| 2 | `handleUpdateTask` | Async Handler | `updatedTask: BoardTask` | `Promise<void>` | `apiService.updateCard`, `updateTask` from store |
| 3 | `handleDeleteTask` | Async Handler | `taskId: string` | `Promise<void>` | `apiService.deleteCard`, `deleteTask` from store |
| 4 | `handleCreateTask` | Async Handler | `taskData: {title, description, priority, columnId, assigneeId?}` | `Promise<void>` | `apiService.createCard`, `addTask` from store |
| 5 | `handleAddColumn` | Async Handler | `void` | `Promise<void>` | `apiService.addStage`, `addColumnToProject` from store |
| 6 | `handleStartEditColumn` | Sync Handler | `columnId: string, currentTitle: string` | `void` | State mutations only |
| 7 | `handleSaveColumnName` | Async Handler | `void` | `Promise<void>` | `apiService.renameStage`, `renameColumn` from store |
| 8 | `handleDeleteColumn` | Async Handler | `columnId: string` | `Promise<void>` | `apiService.deleteStage`, `deleteColumn` from store |
| 9 | `getTasksByColumn` | Sync Filter | `columnId: string` | `BoardTask[]` | No dependencies |
| 10 | Main Component Render | Render Logic | None | JSX | All above + conditional rendering |

---

## Mock Configuration Requirements

### Mock API Service (`apiService`)

```typescript
// All API calls must be mocked with controlled responses
const mockApiService = {
  moveCard: jest.fn(),          // Called with (taskId, {target_stage_id})
  updateCard: jest.fn(),         // Called with (taskId, cardUpdate)
  deleteCard: jest.fn(),         // Called with (taskId)
  createCard: jest.fn(),         // Called with (columnId, cardData)
  addStage: jest.fn(),           // Called with (boardId, stageData)
  renameStage: jest.fn(),        // Called with (stageId, {title})
  deleteStage: jest.fn(),        // Called with (stageId)
  getProject: jest.fn(),         // Called with (projectId)
};
```

### Mock Project Store (`useProjectStore`)

```typescript
// Must return controlled state and action functions
const mockProjectStore = {
  projects: [
    {
      id: 'proj-1',
      boardId: 'board-1',
      name: 'Test Project',
      description: '',
      members: [],
      columns: [
        { id: 'col-1', title: 'Todo', color: 'bg-purple-100' },
        { id: 'col-2', title: 'In Progress', color: 'bg-blue-100' },
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Task 1',
          description: 'Test task',
          columnId: 'col-1',
          priority: 'MEDIUM',
          createdDate: '2025-01-01',
          assignee: { id: 'user-1', name: 'John' },
        },
      ],
      decisions: [],
    },
  ],
  moveTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  addTask: jest.fn(),
  addColumnToProject: jest.fn(),
  renameColumn: jest.fn(),
  deleteColumn: jest.fn(),
  updateProject: jest.fn(),
};
```

### Mock Router (`useParams`, `useNavigate`)

```typescript
const mockParams = { projectId: 'proj-1' };
const mockNavigate = jest.fn();
```

### Mock Toast Notifications (`sonner`)

```typescript
const mockToast = {
  error: jest.fn(),
  success: jest.fn(),
};
```

### Mock Drag-and-Drop Provider (`react-dnd`)

```typescript
// Mock DndProvider to render children directly without DnD functionality
jest.mock('react-dnd', () => ({
  DndProvider: ({ children }: any) => children,
  HTML5Backend: jest.fn(),
}));
```

---

## Test Cases

### Test Group 1: Task Movement

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 1.1 | Move task successfully | Verify task moved to new column with API success | `taskId: "task-1"`, `newColumnId: "col-2"` | `apiService.moveCard` returns `{id: "task-1", column_id: "col-2"}` | Store `moveTask` called with `(proj-1, task-1, col-2)` + success toast | Happy path |
| 1.2 | Move task API error | Handle move failure gracefully | `taskId: "task-1"`, `newColumnId: "col-2"` | `apiService.moveCard` throws `Error("Network failed")` | Error toast with message, store NOT called | Error handling |
| 1.3 | Move task API error (Error instance) | Verify error message extraction from Error | `taskId: "task-1"`, `newColumnId: "col-2"` | `apiService.moveCard` throws `Error("Connection timeout")` | Toast shows "Connection timeout" | Error handling |
| 1.4 | Move task API error (Unknown type) | Handle non-Error exceptions | `taskId: "task-1"`, `newColumnId: "col-2"` | `apiService.moveCard` throws string `"Failed"` | Toast shows "Failed to move task" | Error fallback |

### Test Group 2: Task Updates

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 2.1 | Update task successfully | Verify task updated with all fields | Updated task: `{id: "task-1", title: "Updated", description: "New desc", priority: "HIGH", assignee: {id: "user-2", name: "Jane"}}` | `apiService.updateCard` returns updated card, `mapCardResponseToTask` processes response | Store `updateTask` called, modal closed, success toast | Happy path |
| 2.2 | Update task without assignee | Verify null assignee handling | Updated task: `{id: "task-1", title: "Updated", description: "New", priority: "MEDIUM", assignee: null}` | `apiService.updateCard` returns card with `assignee_id: null` | API called with `assignee_id: null`, task updated | Edge case |
| 2.3 | Update task API error | Handle update failure | Updated task with ID "task-1" | `apiService.updateCard` throws `Error("Conflict")` | Error toast, modal NOT closed, store NOT called | Error handling |
| 2.4 | Update task with special characters | Ensure title/description with special chars handled | `title: "Task & <Test>"`, `description: "Line1\nLine2"` | `apiService.updateCard` returns processed response | Store called with exact title/description, success toast | Data integrity |

### Test Group 3: Task Deletion

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 3.1 | Delete task successfully | Verify task deleted and UI updated | `taskId: "task-1"` | `apiService.deleteCard` returns successful response | Store `deleteTask` called, modal closed, success toast | Happy path |
| 3.2 | Delete task API error | Handle deletion failure | `taskId: "task-1"` | `apiService.deleteCard` throws `Error("Permission denied")` | Error toast, store NOT called, task remains selected | Error handling |
| 3.3 | Delete task not found | Handle 404 scenario | `taskId: "nonexistent"` | `apiService.deleteCard` throws `Error("Task not found")` | Error toast "Task not found", store NOT called | Error handling |

### Test Group 4: Task Creation

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 4.1 | Create task with all fields | Verify new task created successfully | `{title: "New", description: "Desc", priority: "HIGH", columnId: "col-1", assigneeId: "user-1"}` | `apiService.createCard` returns new card with ID | Store `addTask` called with mapped task, modal closed, success toast | Happy path |
| 4.2 | Create task without assignee | Verify null assignee passed to API | `{title: "New", description: "Desc", priority: "MEDIUM", columnId: "col-1"}` | `apiService.createCard` receives `{..., assignee_id: null}` | API called with `assignee_id: null`, task added | Edge case |
| 4.3 | Create task API error | Handle creation failure | `{title: "New", description: "Desc", priority: "LOW", columnId: "col-1"}` | `apiService.createCard` throws `Error("Server error")` | Error toast, store NOT called, modal remains open | Error handling |
| 4.4 | Create task with empty description | Verify empty description accepted | `{title: "New", description: "", priority: "MEDIUM", columnId: "col-1"}` | `apiService.createCard` returns success with empty description | Task created with empty description | Edge case |

### Test Group 5: Column Addition

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 5.1 | Add column with boardId present | Create column when board is ready | `newColumnTitle: "Blocked"` (project has boardId) | `apiService.addStage` returns new stage with `{id, title, color}` | Add button state resets, success toast, store called with new column | Happy path |
| 5.2 | Add column with empty title | Reject empty column name | `newColumnTitle: ""` | N/A (early validation) | Error toast "Column name is required", state unchanged | Validation |
| 5.3 | Add column title with spaces only | Treat whitespace as empty | `newColumnTitle: "   "` | N/A (trim check) | Error toast "Column name is required", state unchanged | Validation |
| 5.4 | Add column without boardId (resolve success) | Handle missing boardId by fetching project | `newColumnTitle: "Ready"` (project no boardId) | `apiService.getProject` returns project with `boardId: "new-board"`, `apiService.addStage` succeeds | Store `updateProject` called, column added with color cycle | Conditional logic |
| 5.5 | Add column without boardId (resolve failure) | Handle board resolution failure | `newColumnTitle: "Test"` (project no boardId) | `apiService.getProject` throws `Error("Not ready")` | Error toast "Board is not ready yet...", state unchanged | Error handling |
| 5.6 | Add column API error | Handle stage creation failure | `newColumnTitle: "New"` (boardId present) | `apiService.addStage` throws `Error("Conflict")` | Error toast "Conflict", state unchanged | Error handling |
| 5.7 | Add column with color cycling | Verify color assignment cycles correctly | Multiple calls with different column counts | First column → bg-purple-100, second → bg-pink-100, etc. (cycles through 6 colors) | Columns have colors assigned in cycle order | Color logic |

### Test Group 6: Column Edit (Start)

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 6.1 | Start editing column | Enable edit mode for column | `columnId: "col-1"`, `currentTitle: "Todo"` | N/A (state only) | State: `editingColumnId: "col-1"`, `editingColumnTitle: "Todo"` | Happy path |
| 6.2 | Start editing different column | Switch editing context | `columnId: "col-2"`, `currentTitle: "In Progress"` | N/A (state only) | State: `editingColumnId: "col-2"`, `editingColumnTitle: "In Progress"` | State management |

### Test Group 7: Column Name Save

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 7.1 | Save column rename successfully | Rename column via API | `editingColumnId: "col-1"`, `editingColumnTitle: "Backlog"` set in state | `apiService.renameStage` succeeds, returns success | Store `renameColumn` called, state cleared, success toast | Happy path |
| 7.2 | Save without valid editing state | Skip save if no column being edited | No editing state set | N/A | Nothing happens, state reset | Guard clause |
| 7.3 | Save with empty title | Reject empty rename | `editingColumnTitle: "   "` (set in state) | N/A (trim check) | State reset without API call | Validation |
| 7.4 | Save column rename API error | Handle rename failure with state preservation | `editingColumnId: "col-1"`, `editingColumnTitle: "New"` | `apiService.renameStage` throws `Error("Forbidden")` | Error toast "Forbidden", state PRESERVED for user correction, store NOT called | Error handling |

### Test Group 8: Column Deletion

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 8.1 | Delete empty column with confirmation | Delete column with no tasks | `columnId: "col-1"` (0 tasks), user confirms | `window.confirm` returns true, `apiService.deleteStage` succeeds | Store `deleteColumn` called, success toast "Column deleted" | Happy path |
| 8.2 | Delete column with tasks with confirmation | Delete column containing multiple tasks | `columnId: "col-1"` (5 tasks), user confirms | `window.confirm` returns true with message mentioning "5 tasks", `apiService.deleteStage` succeeds | Correct prompt shown, store called, success toast | Happy path |
| 8.3 | Delete column with single task with confirmation | Delete column containing one task | `columnId: "col-1"` (1 task), user confirms | `window.confirm` returns true with singular "task", `apiService.deleteStage` succeeds | Message uses singular "task", store called | Pluralization |
| 8.4 | Delete column user cancels | Cancel deletion via confirmation | `columnId: "col-1"`, user declines | `window.confirm` returns false | Nothing happens, API NOT called | User cancellation |
| 8.5 | Delete column API error | Handle deletion failure | `columnId: "col-1"`, user confirms | `window.confirm` returns true, `apiService.deleteStage` throws `Error("Has dependencies")` | Error toast, store NOT called | Error handling |

### Test Group 9: Get Tasks by Column

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 9.1 | Get tasks for column with multiple tasks | Filter tasks correctly | `columnId: "col-1"`, project has 3 tasks in col-1, 2 in col-2 | N/A (pure function) | Returns array of 3 tasks with `columnId: "col-1"` | Happy path |
| 9.2 | Get tasks for empty column | Return empty array | `columnId: "col-3"` (no tasks), project has tasks in other columns | N/A (pure function) | Returns empty array `[]` | Empty result |
| 9.3 | Get tasks for nonexistent column | Return empty array for invalid column | `columnId: "invalid"` | N/A (pure function) | Returns empty array `[]` | Edge case |

### Test Group 10: Component Rendering

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 10.1 | Render with valid project | Show kanban board with columns and tasks | `projectId: "proj-1"` present, project found in store | Normal store setup | Renders DndProvider, all columns, all tasks, Add Column button | Happy path |
| 10.2 | Render project not found | Show not-found message | `projectId: "nonexistent"` or project not in store | Project not found in store | Shows "Project not found" message, Back button, no columns/tasks rendered | Not found |
| 10.3 | Render with selected task | Show CardDetailModal | Task clicked, `selectedTask` set | All modal props properly passed | CardDetailModal rendered with correct task, onClose/onUpdate/onDelete passed | Conditional render |
| 10.4 | Render with create task modal | Show CreateTaskModal | Column clicked to create task | `createTaskColumnId` and `createTaskColumn` set correctly | CreateTaskModal rendered with correct column info, members passed | Conditional render |
| 10.5 | Render column in edit mode | Show edit input for column | Column edit started, `editingColumnId` and `editingColumnTitle` set | Editing state set correctly | Input field shows current title, Save/Cancel buttons visible | Column edit UI |
| 10.6 | Render add column form | Show column creation input | "Add Column" button toggled | `addingColumn: true` | Input field with focus, Add/Cancel buttons, Enter/Escape key handling | Add column UI |

### Test Group 11: Edge Cases and Integration

| # | Test Case | Purpose | Inputs | Mock Setup | Expected Output | Coverage Path |
|---|---|---|---|---|---|---|
| 11.1 | Handle response mapping for move | Ensure mapCardResponseToTask called | Task moved successfully | `apiService.moveCard` returns API response | Mapping function applied before store update | Data transformation |
| 11.2 | Handle response mapping for update | Ensure mapCardResponseToTask called | Task updated successfully | `apiService.updateCard` returns API response | Mapping function applied before store update | Data transformation |
| 11.3 | Handle response mapping for create | Ensure mapCardResponseToTask called | Task created successfully | `apiService.createCard` returns API response | Mapping function applied before store update | Data transformation |
| 11.4 | Column title keyboard Enter | Save on Enter key | Column in edit, user presses Enter | Keyboard event simulated using `userEvent` for realistic input | `handleSaveColumnName` called, API called with new title | Keyboard interaction |
| 11.5 | Column title keyboard Escape | Cancel on Escape key | Column in edit, user presses Escape | Keyboard event simulated using `userEvent` | Edit state cleared without saving, API NOT called | Keyboard interaction |
| 11.6 | Add column keyboard Enter | Create on Enter key | Add column form open, user presses Enter | Keyboard event simulated using `userEvent.keyboard('{Enter}')` for realistic simulation | `handleAddColumn` called, API called with column data | Keyboard interaction |
| 11.7 | Add column keyboard Escape | Cancel on Escape key | Add column form open, user presses Escape | Keyboard event simulated using `userEvent.keyboard('{Escape}')` | Form state reset, closed | Keyboard interaction |

---

## Mock Data Fixtures

### Sample Project Fixture

```typescript
const mockProject: Project = {
  id: 'proj-1',
  boardId: 'board-1',
  name: 'E-Commerce Platform',
  description: 'Main project',
  members: [
    { id: 'user-1', name: 'Alice', email: 'alice@test.com', role: 'owner' },
    { id: 'user-2', name: 'Bob', email: 'bob@test.com', role: 'editor' },
  ],
  columns: [
    { id: 'col-1', title: 'Backlog', color: 'bg-purple-100' },
    { id: 'col-2', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'col-3', title: 'Done', color: 'bg-green-100' },
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Implement login',
      description: 'Add JWT auth',
      columnId: 'col-1',
      priority: 'HIGH',
      createdDate: '2025-01-01',
      assignee: { id: 'user-1', name: 'Alice' },
    },
    {
      id: 'task-2',
      title: 'Design dashboard',
      description: 'Create UI mockups',
      columnId: 'col-2',
      priority: 'MEDIUM',
      createdDate: '2025-01-02',
      assignee: { id: 'user-2', name: 'Bob' },
    },
  ],
  decisions: [],
};
```

### Sample API Response Fixtures

```typescript
const moveCardResponse = {
  id: 'task-1',
  title: 'Implement login',
  description: 'Add JWT auth',
  column_id: 'col-2',
  priority: 'HIGH',
  columnTitle: 'In Progress',
};

const createCardResponse = {
  id: 'task-new',
  title: 'New feature',
  description: 'Feature desc',
  column_id: 'col-1',
  priority: 'MEDIUM',
  columnTitle: 'Backlog',
};

const createStageResponse = {
  id: 'col-new',
  title: 'Review',
  color: 'bg-teal-100',
};
```

---

## Coverage Summary

| Category | Count | Coverage % |
|---|---|---|
| Total Functions | 10 | ~100% |
| Execution Paths | 47 | ~95% |
| Happy Paths | 11 | 100% |
| Error Paths | 18 | 100% |
| Edge Cases | 18 | 100% |
| **Overall Coverage Target** | **47 tests** | **>80%** |

---

## Critical Test Execution Notes

1. **Isolation**: All API calls must be mocked via `jest.mock()` at module level
2. **Store Mocking**: Use `useProjectStore` mock that returns controlled state
3. **Async Handling**: Use `waitFor()` for async operations in all test cases
4. **Event Simulation**: Use `fireEvent` or `userEvent` for keyboard interactions
5. **Confirmation Dialogs**: Mock `window.confirm` to test both acceptance and rejection
6. **Error Propagation**: Verify error messages are correctly displayed via toast notifications
7. **State Verification**: Check component state updates via mock function calls AND DOM inspection
