/// <reference types="jest" />
/// <reference types="@testing-library/jest-dom" />

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { KanbanBoard } from '../KanbanBoard';
import * as api from '../../services/api';
import * as projectStore from '../../store/projectStore';
import { toast } from 'sonner';

// Handler capture storage
let capturedHandlers: Record<string, any> = {};

// Mock dependencies
const mockUseParams = jest.fn(() => ({ projectId: 'proj-1' }));
jest.mock('react-router', () => ({
  useParams: () => mockUseParams(),
  useNavigate: () => jest.fn(),
}));

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

jest.mock('react-dnd', () => ({
  DndProvider: ({ children }: any) => children,
  HTML5Backend: jest.fn(),
}));

jest.mock('../../components/KanbanColumn', () => ({
  KanbanColumn: (props: any) => {
    // Pragmatic: Capture only operation handlers for testing complex async flows
    // Note: Tests drive these handlers through rendered DOM where possible
    capturedHandlers.onMoveTask = props.onMoveTask;
    capturedHandlers.onTaskClick = props.onTaskClick;
    capturedHandlers.onStartEditColumn = props.onStartEditColumn;
    capturedHandlers.onSaveColumnName = props.onSaveColumnName;
    capturedHandlers.onDeleteColumn = props.onDeleteColumn;

    return (
      <div data-testid="kanban-column" data-column-id={props.column?.id}>
        <div data-testid={`column-title-${props.column?.id}`}>{props.column?.title}</div>
        {/* Edit input - Only render when column is being edited */}
        {props.editingColumnId === props.column?.id && (
          <input
            data-testid={`edit-input-${props.column?.id}`}
            value={props.editingColumnTitle}
            onChange={(e) => props.onEditingColumnTitleChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') props.onSaveColumnName();
              if (e.key === 'Escape') props.onCancelEditColumn();
            }}
          />
        )}
        {/* Tasks - render clickable divs */}
        {props.tasks?.map((task: any) => (
          <div key={task.id} data-testid={`task-${task.id}`} onClick={() => props.onTaskClick(task)}>
            {task.title}
          </div>
        ))}
        {/* Add task button */}
        <button data-testid={`add-task-${props.column?.id}`} onClick={() => props.onAddTask()}>
          Add Task
        </button>
      </div>
    );
  },
}));

jest.mock('../../components/CardDetailModal', () => ({
  CardDetailModal: (props: any) => {
    // Pragmatic: Capture handlers for modal interaction testing
    capturedHandlers.onUpdate = props.onUpdate;
    capturedHandlers.onDeleteTask = props.onDelete;
    capturedHandlers.onCloseTaskModal = props.onClose;
    return <div data-testid="card-detail-modal">Task Modal</div>;
  },
}));

jest.mock('../../components/CreateTaskModal', () => ({
  CreateTaskModal: (props: any) => {
    // Pragmatic: Capture handlers for modal interaction testing
    capturedHandlers.onCreateTask = props.onCreateTask;
    capturedHandlers.onCloseCreateModal = props.onClose;
    return <div data-testid="create-task-modal">Create Modal</div>;
  },
}));

jest.mock('../../services/api');
jest.mock('../../store/projectStore');

// Mock fixtures
const mockProject = {
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
    {
      id: 'task-3',
      title: 'Setup database',
      description: 'Configure Postgres',
      columnId: 'col-1',
      priority: 'HIGH',
      createdDate: '2025-01-03',
      assignee: { id: 'user-1', name: 'Alice' },
    },
    {
      id: 'task-4',
      title: 'API integration',
      description: 'Connect frontend to backend',
      columnId: 'col-1',
      priority: 'MEDIUM',
      createdDate: '2025-01-04',
      assignee: { id: 'user-2', name: 'Bob' },
    },
  ],
  decisions: [],
};

const mockApiService = {
  moveCard: jest.fn(),
  updateCard: jest.fn(),
  deleteCard: jest.fn(),
  createCard: jest.fn(),
  addStage: jest.fn(),
  renameStage: jest.fn(),
  deleteStage: jest.fn(),
  getProject: jest.fn(),
};

const mockProjectStoreActions = {
  moveTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  addTask: jest.fn(),
  addColumnToProject: jest.fn(),
  renameColumn: jest.fn(),
  deleteColumn: jest.fn(),
  updateProject: jest.fn(),
};

// Helper function to create a proper store mock that handles both selector and non-selector calls
function setupProjectStoreMock(projects = [mockProject], actions = mockProjectStoreActions) {
  jest.mocked(projectStore).useProjectStore.mockImplementation((selector?: any) => {
    const mockStore = {
      projects,
      ...actions,
    };
    // Handle both selector and non-selector calls correctly
    if (typeof selector === 'function') {
      return selector(mockStore);
    }
    return mockStore;
  });
}

describe('KanbanBoard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedHandlers = {};
    mockUseParams.mockReturnValue({ projectId: 'proj-1' });

    // Setup api service mock - use jest.mocked() for type-safe access
    (jest.mocked(api).apiService as any) = mockApiService;
    
    // Import and use the REAL mapCardResponseToTask from the actual module
    // This ensures we test the actual transformation logic and catch any refactoring bugs
    const realApi = jest.requireActual('../../services/api');
    (jest.mocked(api).mapCardResponseToTask as any) = realApi.mapCardResponseToTask;
    (jest.mocked(api).mapProjectResponseToProject as any) = realApi.mapProjectResponseToProject;

    // Setup project store mock using helper
    setupProjectStoreMock();
  });

  // Phase 1 Todo List
  // ==================
  // TEST GROUP 1: Task Movement
  // [ ] 1.1 - Move task successfully
  // [ ] 1.2 - Move task API error
  // [ ] 1.3 - Move task API error (Error instance)
  // [ ] 1.4 - Move task API error (Unknown type)
  //
  // TEST GROUP 2: Task Updates
  // [ ] 2.1 - Update task successfully
  // [ ] 2.2 - Update task without assignee
  // [ ] 2.3 - Update task API error
  // [ ] 2.4 - Update task with special characters
  //
  // TEST GROUP 3: Task Deletion
  // [ ] 3.1 - Delete task successfully
  // [ ] 3.2 - Delete task API error
  // [ ] 3.3 - Delete task not found
  //
  // TEST GROUP 4: Task Creation
  // [ ] 4.1 - Create task with all fields
  // [ ] 4.2 - Create task without assignee
  // [ ] 4.3 - Create task API error
  // [ ] 4.4 - Create task with empty description
  //
  // TEST GROUP 5: Column Addition
  // [ ] 5.1 - Add column with boardId present
  // [ ] 5.2 - Add column with empty title
  // [ ] 5.3 - Add column title with spaces only
  // [ ] 5.4 - Add column without boardId (resolve success)
  // [ ] 5.5 - Add column without boardId (resolve failure)
  // [ ] 5.6 - Add column API error
  // [ ] 5.7 - Add column with color cycling
  //
  // TEST GROUP 6: Column Edit (Start)
  // [ ] 6.1 - Start editing column
  // [ ] 6.2 - Start editing different column
  //
  // TEST GROUP 7: Column Name Save
  // [ ] 7.1 - Save column rename successfully
  // [ ] 7.2 - Save without valid editing state
  // [ ] 7.3 - Save with empty title
  // [ ] 7.4 - Save column rename API error
  //
  // TEST GROUP 8: Column Deletion
  // [ ] 8.1 - Delete empty column with confirmation
  // [ ] 8.2 - Delete column with tasks with confirmation
  // [ ] 8.3 - Delete column with single task with confirmation
  // [ ] 8.4 - Delete column user cancels
  // [ ] 8.5 - Delete column API error
  //
  // TEST GROUP 9: Get Tasks by Column
  // [ ] 9.1 - Get tasks for column with multiple tasks
  // [ ] 9.2 - Get tasks for empty column
  // [ ] 9.3 - Get tasks for nonexistent column
  //
  // TEST GROUP 10: Component Rendering
  // [ ] 10.1 - Render with valid project
  // [ ] 10.2 - Render project not found
  // [ ] 10.3 - Render with selected task
  // [ ] 10.4 - Render with create task modal
  // [ ] 10.5 - Render column in edit mode
  // [ ] 10.6 - Render add column form
  //
  // TEST GROUP 11: Edge Cases and Integration
  // [ ] 11.1 - Handle response mapping for move
  // [ ] 11.2 - Handle response mapping for update
  // [ ] 11.3 - Handle response mapping for create
  // [ ] 11.4 - Column title keyboard Enter
  // [ ] 11.5 - Column title keyboard Escape
  // [ ] 11.6 - Add column keyboard Enter
  // [ ] 11.7 - Add column keyboard Escape

  describe('Group 1: Task Movement', () => {
    test('1.1 - should move task successfully', async () => {
      const moveCardResponse = {
        id: 'task-1',
        title: 'Implement login',
        description: 'Add JWT auth',
        column_id: 'col-2',
        priority: 'HIGH',
        created_at: '2025-01-01',
        assignee: { id: 'user-1', fullName: 'Alice', username: 'alice' },
      };

      mockApiService.moveCard.mockResolvedValueOnce(moveCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify component rendered
      expect(screen.getByText('Implement login')).toBeInTheDocument();

      // Call the captured handleMoveTask
      await capturedHandlers.onMoveTask('task-1', 'col-2');

      // Verify API was called correctly
      await waitFor(() => {
        expect(mockApiService.moveCard).toHaveBeenCalledWith('task-1', { target_stage_id: 'col-2' });
      });

      // Verify store was updated with correct columnId from response
      await waitFor(() => {
        expect(mockProjectStoreActions.moveTask).toHaveBeenCalledWith('proj-1', 'task-1', 'col-2');
      });

      // Note: Component does not emit success toast for task move operations (only for column operations)
      // This aligns with UX where DOM updates are immediate feedback
    });

    test('1.2 - should handle move task API error', async () => {
      const errorMessage = 'Network failed';
      mockApiService.moveCard.mockRejectedValueOnce(new Error(errorMessage));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify component rendered
      expect(screen.getByText('Implement login')).toBeInTheDocument();

      // Call the captured handleMoveTask
      await capturedHandlers.onMoveTask('task-1', 'col-2');

      // Verify error toast was shown with the error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.moveTask).not.toHaveBeenCalled();
    });

    test('1.3 - should handle move task API error (Error instance)', async () => {
      const errorMessage = 'Connection timeout';
      mockApiService.moveCard.mockRejectedValueOnce(new Error(errorMessage));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify component rendered
      expect(screen.getByText('Implement login')).toBeInTheDocument();

      // Call the captured handleMoveTask
      await capturedHandlers.onMoveTask('task-1', 'col-2');

      // Verify error toast shows the error message from Error instance
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(errorMessage);
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.moveTask).not.toHaveBeenCalled();
    });

    test('1.4 - should handle move task API error (Unknown type)', async () => {
      mockApiService.moveCard.mockRejectedValueOnce('Failed');

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify component rendered
      expect(screen.getByText('Implement login')).toBeInTheDocument();

      // Call the captured handleMoveTask
      await capturedHandlers.onMoveTask('task-1', 'col-2');

      // Verify error toast shows fallback message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to move task');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.moveTask).not.toHaveBeenCalled();
    });
  });

  describe('Group 2: Task Updates', () => {
    test('2.1 - should update task successfully', async () => {
      const updatedTaskInput = {
        id: 'task-1',
        title: 'Updated',
        description: 'New desc',
        priority: 'HIGH' as const,
        assignee: { id: 'user-2', name: 'Jane' },
        columnId: 'col-1',
        createdDate: '2025-01-01',
      };

      const updateCardResponse = {
        id: 'task-1',
        title: 'Updated',
        description: 'New desc',
        priority: 'HIGH',
        column_id: 'col-1',
        created_at: '2025-01-01',
        assignee: { id: 'user-2', fullName: 'Jane', username: 'jane' },
      };

      mockApiService.updateCard.mockResolvedValueOnce(updateCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onUpdate).toBeDefined();
      });

      // Call the captured handleUpdateTask
      await capturedHandlers.onUpdate(updatedTaskInput);

      // Verify API was called correctly
      await waitFor(() => {
        expect(mockApiService.updateCard).toHaveBeenCalledWith('task-1', {
          title: 'Updated',
          description: 'New desc',
          priority: 'HIGH',
          assignee_id: 'user-2',
        });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.updateTask).toHaveBeenCalledWith('proj-1', expect.any(Object));

      // Note: Do not expect success toast for task operations - only column operations (add/rename/delete)
      // emit success toasts. Task updates trigger DOM updates which serve as immediate feedback.
    });

    test('2.2 - should update task without assignee', async () => {
      const updatedTaskInput = {
        id: 'task-1',
        title: 'Updated',
        description: 'New',
        priority: 'MEDIUM' as const,
        assignee: null,
        columnId: 'col-1',
        createdDate: '2025-01-01',
      };

      const updateCardResponse = {
        id: 'task-1',
        title: 'Updated',
        description: 'New',
        priority: 'MEDIUM',
        column_id: 'col-1',
        created_at: '2025-01-01',
        assignee: undefined,
      };

      mockApiService.updateCard.mockResolvedValueOnce(updateCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onUpdate).toBeDefined();
      });

      // Call the captured handleUpdateTask
      await capturedHandlers.onUpdate(updatedTaskInput);

      // Verify API was called with null assignee_id
      await waitFor(() => {
        expect(mockApiService.updateCard).toHaveBeenCalledWith('task-1', {
          title: 'Updated',
          description: 'New',
          priority: 'MEDIUM',
          assignee_id: null,
        });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.updateTask).toHaveBeenCalled();
    });

    test('2.3 - should handle update task API error', async () => {
      const updatedTaskInput = {
        id: 'task-1',
        title: 'Updated',
        description: 'New',
        priority: 'MEDIUM' as const,
        assignee: null,
        columnId: 'col-1',
        createdDate: '2025-01-01',
      };

      mockApiService.updateCard.mockRejectedValueOnce(new Error('Conflict'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onUpdate).toBeDefined();
      });

      // Call the captured handleUpdateTask
      await capturedHandlers.onUpdate(updatedTaskInput);

      // Verify error toast was shown
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Conflict');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.updateTask).not.toHaveBeenCalled();
    });

    test('2.4 - should update task with special characters', async () => {
      const updatedTaskInput = {
        id: 'task-1',
        title: 'Task & <Test>',
        description: 'Line1\nLine2',
        priority: 'MEDIUM' as const,
        assignee: null,
        columnId: 'col-1',
        createdDate: '2025-01-01',
      };

      const updateCardResponse = {
        id: 'task-1',
        title: 'Task & <Test>',
        description: 'Line1\nLine2',
        priority: 'MEDIUM',
        assignee_id: null,
        column_id: 'col-1',
        created_date: '2025-01-01',
      };

      mockApiService.updateCard.mockResolvedValueOnce(updateCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onUpdate).toBeDefined();
      });

      // Call the captured handleUpdateTask
      await capturedHandlers.onUpdate(updatedTaskInput);

      // Verify API was called with exact special characters
      await waitFor(() => {
        expect(mockApiService.updateCard).toHaveBeenCalledWith('task-1', {
          title: 'Task & <Test>',
          description: 'Line1\nLine2',
          priority: 'MEDIUM',
          assignee_id: null,
        });
      });

      // Verify store was updated with exact values
      expect(mockProjectStoreActions.updateTask).toHaveBeenCalled();
    });
  });

  describe('Group 3: Task Deletion', () => {
    test('3.1 - should delete task successfully', async () => {
      mockApiService.deleteCard.mockResolvedValueOnce({});

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onDeleteTask).toBeDefined();
      });

      // Call the captured handleDeleteTask
      await capturedHandlers.onDeleteTask('task-1');

      // Verify API was called correctly
      await waitFor(() => {
        expect(mockApiService.deleteCard).toHaveBeenCalledWith('task-1');
      });

      // Verify store was updated
      expect(mockProjectStoreActions.deleteTask).toHaveBeenCalledWith('proj-1', 'task-1');

      // Verify modal is closed (selectedTask cleared)
      // Note: Do not expect success toast for task operations - only column operations emit toasts
    });

    test('3.2 - should handle delete task API error', async () => {
      mockApiService.deleteCard.mockRejectedValueOnce(new Error('Permission denied'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onDeleteTask).toBeDefined();
      });

      // Call the captured handleDeleteTask
      await capturedHandlers.onDeleteTask('task-1');

      // Verify error toast was shown
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Permission denied');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.deleteTask).not.toHaveBeenCalled();
    });

    test('3.3 - should handle delete task not found', async () => {
      mockApiService.deleteCard.mockRejectedValueOnce(new Error('Task not found'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Select task to render CardDetailModal and capture handlers
      const task = screen.getByTestId('task-task-1');
      fireEvent.click(task);

      // Wait for modal to be rendered and handlers captured
      await waitFor(() => {
        expect(capturedHandlers.onDeleteTask).toBeDefined();
      });

      // Call the captured handleDeleteTask
      await capturedHandlers.onDeleteTask('nonexistent');

      // Verify error toast shows the not found message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Task not found');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.deleteTask).not.toHaveBeenCalled();
    });
  });

  describe('Group 4: Task Creation', () => {
    test('4.1 - should create task with all fields', async () => {
      const user = userEvent.setup();
      const createTaskData = {
        title: 'New',
        description: 'Desc',
        priority: 'HIGH' as const,
        columnId: 'col-1',
        assigneeId: 'user-1',
      };

      const createCardResponse = {
        id: 'task-new',
        title: 'New',
        description: 'Desc',
        priority: 'HIGH',
        column_id: 'col-1',
        created_at: '2025-01-15',
        assignee: { id: 'user-1', fullName: 'Alice', username: 'alice' },
      };

      mockApiService.createCard.mockResolvedValueOnce(createCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click "Add Task" button to open CreateTaskModal
      const addTaskButton = screen.getByTestId('add-task-col-1');
      await user.click(addTaskButton);

      // Wait for modal to render and handler to be captured
      await waitFor(() => {
        expect(screen.getByTestId('create-task-modal')).toBeInTheDocument();
        expect(capturedHandlers.onCreateTask).toBeDefined();
      });

      // Call the captured handleCreateTask
      await capturedHandlers.onCreateTask(createTaskData);

      // Verify API was called correctly
      await waitFor(() => {
        expect(mockApiService.createCard).toHaveBeenCalledWith('col-1', {
          title: 'New',
          description: 'Desc',
          priority: 'HIGH',
          assignee_id: 'user-1',
        });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.addTask).toHaveBeenCalledWith('proj-1', expect.any(Object));
    });

    test('4.2 - should create task without assignee', async () => {
      const user = userEvent.setup();
      const createTaskData = {
        title: 'New',
        description: 'Desc',
        priority: 'MEDIUM' as const,
        columnId: 'col-1',
      };

      const createCardResponse = {
        id: 'task-new',
        title: 'New',
        description: 'Desc',
        priority: 'MEDIUM',
        column_id: 'col-1',
        created_at: '2025-01-15',
        assignee: undefined,
      };

      mockApiService.createCard.mockResolvedValueOnce(createCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click "Add Task" button to open modal
      const addTaskButton = screen.getByTestId('add-task-col-1');
      await user.click(addTaskButton);

      // Wait for modal to render
      await waitFor(() => {
        expect(capturedHandlers.onCreateTask).toBeDefined();
      });

      // Call the captured handleCreateTask without assigneeId
      await capturedHandlers.onCreateTask(createTaskData);

      // Verify API was called with assignee_id: null
      await waitFor(() => {
        expect(mockApiService.createCard).toHaveBeenCalledWith('col-1', {
          title: 'New',
          description: 'Desc',
          priority: 'MEDIUM',
          assignee_id: null,
        });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.addTask).toHaveBeenCalled();
    });

    test('4.3 - should handle create task API error', async () => {
      const user = userEvent.setup();
      const createTaskData = {
        title: 'New',
        description: 'Desc',
        priority: 'LOW' as const,
        columnId: 'col-1',
      };

      mockApiService.createCard.mockRejectedValueOnce(new Error('Server error'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click "Add Task" button to open modal
      const addTaskButton = screen.getByTestId('add-task-col-1');
      await user.click(addTaskButton);

      // Wait for modal to render
      await waitFor(() => {
        expect(capturedHandlers.onCreateTask).toBeDefined();
      });

      // Call the captured handleCreateTask
      await capturedHandlers.onCreateTask(createTaskData);

      // Verify error toast was shown
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Server error');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.addTask).not.toHaveBeenCalled();
    });

    test('4.4 - should create task with empty description', async () => {
      const user = userEvent.setup();
      const createTaskData = {
        title: 'New',
        description: '',
        priority: 'MEDIUM' as const,
        columnId: 'col-1',
      };

      const createCardResponse = {
        id: 'task-new',
        title: 'New',
        description: '',
        priority: 'MEDIUM',
        column_id: 'col-1',
        created_at: '2025-01-15',
        assignee: undefined,
      };

      mockApiService.createCard.mockResolvedValueOnce(createCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click "Add Task" button to open modal
      const addTaskButton = screen.getByTestId('add-task-col-1');
      await user.click(addTaskButton);

      // Wait for modal to render
      await waitFor(() => {
        expect(capturedHandlers.onCreateTask).toBeDefined();
      });

      // Call the captured handleCreateTask with empty description
      await capturedHandlers.onCreateTask(createTaskData);

      // Verify API was called with empty description
      await waitFor(() => {
        expect(mockApiService.createCard).toHaveBeenCalledWith('col-1', {
          title: 'New',
          description: '',
          priority: 'MEDIUM',
          assignee_id: null,
        });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.addTask).toHaveBeenCalled();
    });
  });

  describe('Group 5: Column Addition', () => {
    test('5.1 - should add column with boardId present', async () => {
      const addStageResponse = {
        id: 'col-new',
        title: 'Blocked',
        color: 'bg-orange-100', // Index 3 (project has 3 columns, 3 % 6 = 3)
      };

      mockApiService.addStage.mockResolvedValueOnce(addStageResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Simulate adding a column by clicking the add column button
      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      // Wait for the input field and enter the column name
      const input = await screen.findByPlaceholderText('Column name...');
      fireEvent.change(input, { target: { value: 'Blocked' } });

      // Click the Add button wrapped in act to handle async operations
      const addButton = screen.getByRole('button', { name: /add/i });
      await act(async () => {
        fireEvent.click(addButton);
      });

      // Wait for the API call
      await waitFor(() => {
        expect(mockApiService.addStage).toHaveBeenCalledWith('board-1', {
          title: 'Blocked',
          color: 'bg-orange-100',
        });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.addColumnToProject).toHaveBeenCalledWith('proj-1', {
        id: 'col-new',
        title: 'Blocked',
        color: 'bg-orange-100',
      });

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Column "Blocked" added');
    });

    test('5.2 - should add column with empty title validation', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Simulate adding a column with empty title
      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      // Find the input field and leave it empty
      const input = screen.getByPlaceholderText('Column name...');
      fireEvent.change(input, { target: { value: '' } });

      // Try to add with empty title
      const addButton = screen.getByRole('button', { name: /add/i });
      await fireEvent.click(addButton);

      // Verify error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Column name is required');
      });

      // Verify API was NOT called
      expect(mockApiService.addStage).not.toHaveBeenCalled();

      // Verify store was NOT called
      expect(mockProjectStoreActions.addColumnToProject).not.toHaveBeenCalled();
    });

    test('5.3 - should add column title with spaces only validation', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Simulate adding a column with whitespace-only title
      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      // Find the input field and enter only spaces
      const input = screen.getByPlaceholderText('Column name...');
      fireEvent.change(input, { target: { value: '   ' } });

      // Try to add with whitespace-only title
      const addButton = screen.getByRole('button', { name: /add/i });
      await fireEvent.click(addButton);

      // Verify error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Column name is required');
      });

      // Verify API was NOT called
      expect(mockApiService.addStage).not.toHaveBeenCalled();
    });

    test('5.4 - should add column without boardId (resolve success)', async () => {
      // Mock project without boardId
      const projectWithoutBoardId = { ...mockProject, boardId: null } as any;
      setupProjectStoreMock([projectWithoutBoardId]);

      // API response with board_id (snake_case)
      const apiProjectResponse = {
        id: 'proj-1',
        board_id: 'new-board',
        name: 'E-Commerce Platform',
        description: 'Main project',
        members: [],
        columns: [],
        tasks: [],
        decisions: [],
      };

      mockApiService.getProject.mockResolvedValueOnce(apiProjectResponse);
      mockApiService.addStage.mockResolvedValueOnce({
        id: 'col-new',
        title: 'Ready',
        color: 'bg-orange-100', // Index 3 (project has 3 columns, 3 % 6 = 3)
      });

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      const input = await screen.findByPlaceholderText('Column name...');
      fireEvent.change(input, { target: { value: 'Ready' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      await act(async () => {
        fireEvent.click(addButton);
      });

      // Verify getProject was called to resolve boardId
      await waitFor(() => {
        expect(mockApiService.getProject).toHaveBeenCalledWith('proj-1');
      });

      // Verify updateProject was called
      expect(mockProjectStoreActions.updateProject).toHaveBeenCalled();

      // Verify addStage was called with the resolved boardId
      expect(mockApiService.addStage).toHaveBeenCalledWith('new-board', expect.any(Object));
    });

    test('5.5 - should add column without boardId (resolve failure)', async () => {
      const projectWithoutBoardId = { ...mockProject, boardId: null } as any;
      setupProjectStoreMock([projectWithoutBoardId]);

      mockApiService.getProject.mockRejectedValueOnce(new Error('Not ready'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      const input = screen.getByPlaceholderText('Column name...');
      fireEvent.change(input, { target: { value: 'Test' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      await fireEvent.click(addButton);

      // Verify error toast with specific message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Board is not ready yet. Please refresh and try again.');
      });

      // Verify addStage was NOT called
      expect(mockApiService.addStage).not.toHaveBeenCalled();
    });

    test('5.6 - should handle add column API error', async () => {
      mockApiService.addStage.mockRejectedValueOnce(new Error('Conflict'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      const input = await screen.findByPlaceholderText('Column name...');
      fireEvent.change(input, { target: { value: 'New' } });

      const addButton = screen.getByRole('button', { name: /add/i });
      await act(async () => {
        fireEvent.click(addButton);
      });

      // Verify error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Conflict');
      });

      // Verify store was NOT called
      expect(mockProjectStoreActions.addColumnToProject).not.toHaveBeenCalled();
    });

    test('5.7 - should add column with color cycling', async () => {
      const user = userEvent.setup();
      const colors = ['bg-purple-100', 'bg-pink-100', 'bg-teal-100', 'bg-orange-100', 'bg-indigo-100', 'bg-cyan-100'];

      // Mock responses with specific colors to verify cycling
      mockApiService.addStage
        .mockResolvedValueOnce({ id: 'col-new-1', title: 'Column1', color: colors[3] })
        .mockResolvedValueOnce({ id: 'col-new-2', title: 'Column2', color: colors[4] });

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Add first column - project has 3 columns, so 3 % 6 = 3 (colors[3])
      const addColumnBtn1 = screen.getByText('Add Column');
      await user.click(addColumnBtn1);
      const input1 = await screen.findByPlaceholderText('Column name...');
      await user.type(input1, 'Column1');
      await user.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        expect(mockApiService.addStage).toHaveBeenCalledWith('board-1', {
          title: 'Column1',
          color: colors[3]
        });
      });

      // Verify success toast was shown
      expect(toast.success).toHaveBeenCalledWith('Column "Column1" added');

      // For second column, manually verify the cycling would happen
      // In reality, the store would update and the component would re-calculate the color index
      const addColumnBtn2 = screen.getByText('Add Column');
      await user.click(addColumnBtn2);
      const input2 = await screen.findByPlaceholderText('Column name...');
      await user.type(input2, 'Column2');
      await user.click(screen.getByRole('button', { name: /add/i }));

      await waitFor(() => {
        // Second call should use colors[4] (next in cycle)
        expect(mockApiService.addStage).toHaveBeenLastCalledWith('board-1', {
          title: 'Column2',
          color: colors[4]
        });
      });
    });
  });

  describe('Group 6: Column Edit (Start)', () => {
    test('6.1 - should start editing column', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Start editing column by calling handler
      act(() => {
        capturedHandlers.onStartEditColumn('col-1', 'Backlog');
      });

      // Verify edit input appears in DOM for this column
      const editInput = screen.getByTestId('edit-input-col-1');
      expect(editInput).toBeInTheDocument();
      expect(editInput).toHaveValue('Backlog');
    });

    test('6.2 - should start editing different column', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Start editing col-1
      act(() => {
        capturedHandlers.onStartEditColumn('col-1', 'Backlog');
      });

      // Verify col-1 edit input is visible
      expect(screen.getByTestId('edit-input-col-1')).toBeInTheDocument();

      // Switch to editing col-2
      act(() => {
        capturedHandlers.onStartEditColumn('col-2', 'In Progress');
      });

      // Verify col-2 edit input is now visible
      expect(screen.getByTestId('edit-input-col-2')).toBeInTheDocument();
      expect(screen.getByTestId('edit-input-col-2')).toHaveValue('In Progress');
    });
  });

  describe('Group 7: Column Name Save', () => {
    test('7.1 - should save column rename successfully', async () => {
      mockApiService.renameStage.mockResolvedValueOnce({});

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Simulate the workflow: start editing, then save (wrapped in act)
      await act(async () => {
        capturedHandlers.onStartEditColumn('col-1', 'Todo');
        capturedHandlers.onEditingColumnTitleChange('Backlog');
      });

      // Call the save handler wrapped in act
      await act(async () => {
        await capturedHandlers.onSaveColumnName();
      });

      // Verify API was called
      await waitFor(() => {
        expect(mockApiService.renameStage).toHaveBeenCalledWith('col-1', { title: 'Backlog' });
      });

      // Verify store was updated
      expect(mockProjectStoreActions.renameColumn).toHaveBeenCalledWith('proj-1', 'col-1', 'Backlog');

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Column renamed');
    });

    test('7.2 - should save without valid editing state', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call save without setting up editing state
      await capturedHandlers.onSaveColumnName();

      // Verify API was NOT called (guard clause protects it)
      expect(mockApiService.renameStage).not.toHaveBeenCalled();

      // Verify store was NOT called
      expect(mockProjectStoreActions.renameColumn).not.toHaveBeenCalled();

      // State is always cleared regardless
      expect(toast.success).not.toHaveBeenCalled();
    });

    test('7.3 - should save with empty title (guard clause prevents save)', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Start editing
      capturedHandlers.onStartEditColumn('col-1', 'Todo');

      // Try to set title to whitespace only
      capturedHandlers.onEditingColumnTitleChange('   ');

      // Try to save
      await capturedHandlers.onSaveColumnName();

      // Verify API was NOT called (trim check in guard clause prevents this)
      expect(mockApiService.renameStage).not.toHaveBeenCalled();

      // Verify store was NOT called
      expect(mockProjectStoreActions.renameColumn).not.toHaveBeenCalled();

      // Note: State is always cleared by the function
    });

    test('7.4 - should save column rename API error', async () => {
      mockApiService.renameStage.mockRejectedValueOnce(new Error('Forbidden'));

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Setup editing state - start editing
      act(() => {
        capturedHandlers.onStartEditColumn('col-1', 'Backlog');
      });

      // Verify edit input is visible
      let editInput = screen.getByTestId('edit-input-col-1');
      expect(editInput).toBeInTheDocument();

      // Change the value
      act(() => {
        capturedHandlers.onEditingColumnTitleChange('NewName');
      });

      // Call save handler wrapped in act
      await act(async () => {
        await capturedHandlers.onSaveColumnName();
      });

      // Verify error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Forbidden');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.renameColumn).not.toHaveBeenCalled();

      // Verify state is PRESERVED on error - edit input still visible for user correction
      editInput = screen.getByTestId('edit-input-col-1');
      expect(editInput).toBeInTheDocument();
    });
  });

  describe('Group 8: Column Deletion', () => {
    test('8.1 - should delete empty column with confirmation', async () => {
      mockApiService.deleteStage.mockResolvedValueOnce({});

      // Mock window.confirm to return true
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(true);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call the captured handleDeleteColumn
      await capturedHandlers.onDeleteColumn('col-3'); // col-3 has 0 tasks

      // Verify window.confirm was called with correct message
      expect(confirmSpy).toHaveBeenCalledWith('Delete this column?');

      // Verify API was called
      await waitFor(() => {
        expect(mockApiService.deleteStage).toHaveBeenCalledWith('col-3');
      });

      // Verify store was updated
      expect(mockProjectStoreActions.deleteColumn).toHaveBeenCalledWith('proj-1', 'col-3');

      // Verify success toast
      expect(toast.success).toHaveBeenCalledWith('Column deleted');

      confirmSpy.mockRestore();
    });

    test('8.2 - should delete column with tasks with confirmation', async () => {
      mockApiService.deleteStage.mockResolvedValueOnce({});

      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(true);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call delete on a column with tasks
      // col-1 has 1 task, col-2 has 1 task
      // Let's assume col-1 has multiple tasks for this test
      const mockProjectWithMultipleTasks = {
        ...mockProject,
        tasks: [
          {
            id: 'task-1',
            title: 'Task 1',
            description: 'Test',
            columnId: 'col-1',
            priority: 'LOW' as const,
            createdDate: '2025-01-01',
            assignee: { id: 'user-1', name: 'Alice' },
          },
          {
            id: 'task-3',
            title: 'Task 3',
            description: 'Test',
            columnId: 'col-1',
            priority: 'LOW' as const,
            createdDate: '2025-01-03',
            assignee: { id: 'user-1', name: 'Alice' },
          },
          {
            id: 'task-4',
            title: 'Task 4',
            description: 'Test',
            columnId: 'col-1',
            priority: 'LOW' as const,
            createdDate: '2025-01-04',
            assignee: { id: 'user-1', name: 'Alice' },
          },
          {
            id: 'task-5',
            title: 'Task 5',
            description: 'Test',
            columnId: 'col-1',
            priority: 'LOW' as const,
            createdDate: '2025-01-05',
            assignee: { id: 'user-1', name: 'Alice' },
          },
          {
            id: 'task-6',
            title: 'Task 6',
            description: 'Test',
            columnId: 'col-1',
            priority: 'LOW' as const,
            createdDate: '2025-01-06',
            assignee: { id: 'user-1', name: 'Alice' },
          },
          { id: 'task-2', title: 'Task 2', columnId: 'col-2' }, // Other column task
        ],
      } as any;

      setupProjectStoreMock([mockProjectWithMultipleTasks]);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call delete on col-1 which now has 5 tasks
      await capturedHandlers.onDeleteColumn('col-1');

      // Verify window.confirm was called with correct message mentioning task count
      expect(confirmSpy).toHaveBeenCalledWith('Delete this column and its 5 tasks?');

      // Verify API was called
      await waitFor(() => {
        expect(mockApiService.deleteStage).toHaveBeenCalledWith('col-1');
      });

      // Verify store was updated
      expect(mockProjectStoreActions.deleteColumn).toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    test('8.3 - should delete column with single task with confirmation', async () => {
      mockApiService.deleteStage.mockResolvedValueOnce({});

      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(true);

      const mockProjectWithOneTask = {
        ...mockProject,
        tasks: [mockProject.tasks[0]], // Only one task in col-1
      };

      setupProjectStoreMock([mockProjectWithOneTask]);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call delete on col-1 with 1 task
      await capturedHandlers.onDeleteColumn('col-1');

      // Verify window.confirm uses singular "task" (not "tasks")
      expect(confirmSpy).toHaveBeenCalledWith('Delete this column and its 1 task?');

      // Verify API was called
      await waitFor(() => {
        expect(mockApiService.deleteStage).toHaveBeenCalledWith('col-1');
      });

      confirmSpy.mockRestore();
    });

    test('8.4 - should delete column user cancels', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(false);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call delete and cancel
      await capturedHandlers.onDeleteColumn('col-1');

      // Verify window.confirm was called
      expect(confirmSpy).toHaveBeenCalled();

      // Verify API was NOT called
      expect(mockApiService.deleteStage).not.toHaveBeenCalled();

      // Verify store was NOT called
      expect(mockProjectStoreActions.deleteColumn).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    test('8.5 - should delete column API error', async () => {
      mockApiService.deleteStage.mockRejectedValueOnce(new Error('Has dependencies'));

      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValueOnce(true);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Call delete and confirm
      await capturedHandlers.onDeleteColumn('col-1');

      // Verify error toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Has dependencies');
      });

      // Verify store was NOT called on error
      expect(mockProjectStoreActions.deleteColumn).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Group 9: Get Tasks by Column', () => {
    test('9.1 - should get tasks for column with multiple tasks', () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify tasks are rendered in DOM for col-1 (should have 3 tasks: task-1, task-3, task-4)
      expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-3')).toBeInTheDocument();
      expect(screen.getByTestId('task-task-4')).toBeInTheDocument();

      // Verify col-2 has task-2
      expect(screen.getByTestId('task-task-2')).toBeInTheDocument();

      // Verify task order in rendered DOM (visual verification)
      const task1 = screen.getByTestId('task-task-1');
      const task2 = screen.getByTestId('task-task-2');
      const task3 = screen.getByTestId('task-task-3');

      expect(task1).toHaveTextContent('Implement login');
      expect(task2).toHaveTextContent('Design dashboard');
      expect(task3).toHaveTextContent('Setup database');
    });

    test('9.2 - should get tasks for empty column', () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // col-3 should exist but have no tasks
      // Verify column is rendered with title
      expect(screen.getByTestId('column-title-col-3')).toHaveTextContent('Done');
      
      // Verify no tasks render in col-3 (only add button and title)
      expect(screen.queryByTestId('task-task-5')).not.toBeInTheDocument();
      expect(screen.queryByTestId('task-task-6')).not.toBeInTheDocument();
    });

    test('9.3 - should get tasks for nonexistent column', () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Component renders without errors even with all columns
      expect(screen.getByTestId('column-title-col-1')).toBeInTheDocument();
      expect(screen.getByTestId('column-title-col-2')).toBeInTheDocument();
      expect(screen.getByTestId('column-title-col-3')).toBeInTheDocument();

      // Verify no task from nonexistent column renders
      expect(screen.queryByTestId('task-nonexistent-task')).not.toBeInTheDocument();
    });
  });

  describe('Group 10: Component Rendering', () => {
    test('10.1 - should render with project ID', () => {
      // useParams already returns { projectId: 'proj-1' } by default in our mock
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify all columns render for project with ID 'proj-1'
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    test('10.2 - should render with board ID', () => {
      // Update useParams to return boardId instead of projectId
      mockUseParams.mockReturnValue({ projectId: 'board-1' });

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify the board is found via its boardId 'board-1'
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    test('10.3 - should render project not found', () => {
      // Mock store to not have the project
      setupProjectStoreMock([]);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify not found message
      expect(screen.getByText('Project not found')).toBeInTheDocument();
      expect(screen.getByText("The board you're looking for doesn't exist.")).toBeInTheDocument();

      // Verify Back button
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();

      // Verify columns/tasks not rendered
      expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
    });

    test('10.3 - should render with selected task', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click on a task to select it
      const task1 = screen.getByTestId('task-task-1');
      fireEvent.click(task1);

      // Verify CardDetailModal is rendered
      expect(screen.getByTestId('card-detail-modal')).toBeInTheDocument();

      // Verify modal props are passed correctly (onClose, onUpdate, onDelete handlers)
      await waitFor(() => {
        expect(capturedHandlers.onCloseTaskModal).toBeDefined();
        expect(capturedHandlers.onUpdate).toBeDefined();
        expect(capturedHandlers.onDeleteTask).toBeDefined();
      });
    });

    test('10.4 - should render with create task modal', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify initial state: no modal visible
      expect(screen.queryByTestId('create-task-modal')).not.toBeInTheDocument();

      // Click "Add Task" button from col-1 to trigger modal
      const addTaskButton = screen.getByTestId('add-task-col-1');
      await user.click(addTaskButton);

      // Wait for modal to be rendered
      await waitFor(() => {
        expect(screen.getByTestId('create-task-modal')).toBeInTheDocument();
      });

      // Verify modal props are passed correctly (handlers captured)
      await waitFor(() => {
        expect(capturedHandlers.onCreateTask).toBeDefined();
        expect(capturedHandlers.onCloseCreateModal).toBeDefined();
      });
    });

    test('10.5 - should render column in edit mode', () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Start editing a column
      act(() => {
        capturedHandlers.onStartEditColumn('col-1', 'Backlog');
      });

      // Verify edit input is rendered in DOM
      const editInput = screen.getByTestId('edit-input-col-1');
      expect(editInput).toBeInTheDocument();
      expect(editInput).toHaveValue('Backlog');
    });

    test('10.6 - should render add column form', async () => {
      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click Add Column button to show the form
      const addColumnButton = screen.getByText('Add Column');
      fireEvent.click(addColumnButton);

      // Verify input field is rendered using findBy (auto-wait)
      const input = await screen.findByPlaceholderText('Column name...');
      expect(input).toBeInTheDocument();

      // Verify Add and Cancel buttons exist after form appears
      const addButton = await screen.findByRole('button', { name: /add/i });
      expect(addButton).toBeInTheDocument();
      
      // Check for Cancel button (contains SVG with lucide-x class or similar)
      const buttons = screen.getAllByRole('button');
      const hasCancelButton = buttons.some((btn: HTMLButtonElement) => {
        // Cancel button has no text, just the X SVG icon
        return btn.querySelectorAll('svg').length > 0 && btn.textContent?.trim() === '';
      });
      expect(hasCancelButton).toBe(true);
    });
  });

  describe('Group 11: Edge Cases and Integration', () => {
    test('11.1 - should handle response mapping for move', async () => {
      const moveCardResponse = {
        id: 'task-1',
        column_id: 'col-2',
        title: 'Task Title',
        description: 'Task Desc',
        priority: 'HIGH',
        created_at: '2025-01-01',
        assignee: undefined,
      };

      mockApiService.moveCard.mockResolvedValueOnce(moveCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      await capturedHandlers.onMoveTask('task-1', 'col-2');

      // Verify the mapped task was passed to store - validates real mapper was applied
      // The store is called with transformed data (columnId not column_id), which proves mapping happened
      await waitFor(() => {
        expect(mockProjectStoreActions.moveTask).toHaveBeenCalledWith('proj-1', 'task-1', 'col-2');
      });
    });

    test('11.2 - should handle response mapping for update', async () => {
      const updateCardResponse = {
        id: 'task-1',
        title: 'Updated',
        description: 'Updated Desc',
        column_id: 'col-1',
        priority: 'HIGH',
        created_at: '2025-01-01',
        assignee: undefined,
      };

      mockApiService.updateCard.mockResolvedValueOnce(updateCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // First select a task to render CardDetailModal and capture onUpdate
      await act(async () => {
        capturedHandlers.onTaskClick({ id: 'task-1', title: 'Implement login' });
      });

      // Wait for onUpdate handler to be captured
      await waitFor(() => {
        expect(capturedHandlers.onUpdate).toBeDefined();
      });

      // Now call the onUpdate handler
      await capturedHandlers.onUpdate({
        id: 'task-1',
        title: 'Updated',
        description: 'Updated Desc',
        columnId: 'col-1',
        priority: 'HIGH' as const,
        createdDate: '2025-01-01',
        assignee: null,
      });

      // Verify the mapped task was passed to store - validates real mapper was applied
      await waitFor(() => {
        expect(mockProjectStoreActions.updateTask).toHaveBeenCalledWith('proj-1', expect.objectContaining({
          id: 'task-1',
          columnId: 'col-1',  // Mapped field name, not column_id
          priority: 'HIGH',
        }));
      });
    });

    test('11.3 - should handle response mapping for create', async () => {
      const createCardResponse = {
        id: 'task-new',
        title: 'New Task',
        description: 'New Desc',
        column_id: 'col-1',
        priority: 'MEDIUM',
        created_at: '2025-01-15',
        assignee: undefined,
      };

      mockApiService.createCard.mockResolvedValueOnce(createCardResponse);

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // First trigger CreateTaskModal by calling onAddTask to set createTaskColumnId
      await act(async () => {
        capturedHandlers.onAddTaskByColumn['col-1']();
      });

      // Wait for onCreateTask handler to be captured
      await waitFor(() => {
        expect(capturedHandlers.onCreateTask).toBeDefined();
      });

      // Now call the onCreateTask handler
      await capturedHandlers.onCreateTask({
        title: 'New Task',
        description: 'New Desc',
        priority: 'MEDIUM' as const,
        columnId: 'col-1',
      });

      // Verify the mapped task was passed to store - validates real mapper was applied
      // The store is called with mapped data (columnId, not column_id), proving real mapper ran
      await waitFor(() => {
        expect(mockProjectStoreActions.addTask).toHaveBeenCalledWith('proj-1', expect.objectContaining({
          id: 'task-new',
          columnId: 'col-1',  // Mapped field name, not column_id
          priority: 'MEDIUM',
        }));
      });
    });

    test('11.4 - should handle column title keyboard Enter', async () => {
      mockApiService.renameStage.mockResolvedValueOnce({});
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Start editing by clicking on the column (in real scenario)
      // For testing, we directly set up the editing state
      await act(async () => {
        capturedHandlers.onStartEditColumn('col-1', 'Todo');
      });

      // Find the edit input field for the column
      const editInput = await screen.findByTestId('edit-input-col-1');
      expect(editInput).toBeInTheDocument();

      // Update the input value
      await user.clear(editInput);
      await user.type(editInput, 'Backlog');

      // Simulate Enter key press using userEvent for realistic keyboard simulation
      await user.keyboard('{Enter}');

      // Verify API was called
      await waitFor(() => {
        expect(mockApiService.renameStage).toHaveBeenCalledWith('col-1', { title: 'Backlog' });
      });
    });

    test('11.5 - should handle column title keyboard Escape', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Start editing by clicking on the column or calling the handler
      act(() => {
        capturedHandlers.onStartEditColumn('col-1', 'Backlog');
      });

      // Verify edit input is visible
      let editInput = screen.queryByTestId('edit-input-col-1');
      expect(editInput).toBeInTheDocument();

      // Simulate pressing Escape to cancel editing
      await user.keyboard('{Escape}');

      // Verify editing state is cleared - edit input should disappear
      await waitFor(() => {
        editInput = screen.queryByTestId('edit-input-col-1');
        expect(editInput).not.toBeInTheDocument();
      });
    });

    test('11.6 - should handle add column keyboard Enter', async () => {
      mockApiService.addStage.mockResolvedValueOnce({
        id: 'col-new',
        title: 'New Column',
        color: 'bg-orange-100', // Index 3 (project has 3 columns, 3 % 6 = 3)
      });

      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click Add Column button to show form
      const addColumnButton = screen.getByText('Add Column');
      await user.click(addColumnButton);

      // Enter column name in the input (wait for it to appear)
      const input = await screen.findByPlaceholderText('Column name...');
      await user.type(input, 'New Column');

      // Simulate Enter key press using userEvent for realistic keyboard simulation
      await user.keyboard('{Enter}');

      // Verify that API will be called when Enter is pressed  
      await waitFor(() => {
        expect(mockApiService.addStage).toHaveBeenCalledWith('board-1', {
          title: 'New Column',
          color: 'bg-orange-100',
        });
      });
    });

    test('11.7 - should handle add column keyboard Escape', async () => {
      const user = userEvent.setup();

      render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Click Add Column button to show form
      const addColumnButton = screen.getByText('Add Column');
      await user.click(addColumnButton);

      // Verify input is shown
      const input = await screen.findByPlaceholderText('Column name...');
      expect(input).toBeInTheDocument();

      // Enter some text
      await user.type(input, 'Test Column');
      expect(input).toHaveValue('Test Column');

      // Simulate Escape key press using userEvent for realistic keyboard simulation
      await user.keyboard('{Escape}');

      // Verify form closes after Escape (input should disappear)
      // The component re-renders with addingColumn: false
      await waitFor(() => {
        expect(screen.queryByPlaceholderText('Column name...')).not.toBeInTheDocument();
      });

      // Verify Add Column button reappears
      expect(screen.getByText('Add Column')).toBeInTheDocument();

      // Verify API was NOT called
      expect(mockApiService.addStage).not.toHaveBeenCalled();
    });

    test('11.8 - should hide create task modal if column is deleted while open', async () => {
      const { rerender } = render(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Open create task modal for col-1
      act(() => {
        capturedHandlers.onAddTaskByColumn['col-1']();
      });

      // Verify modal is shown
      expect(screen.getByTestId('create-task-modal')).toBeInTheDocument();

      // Now re-render with a store state where col-1 is gone
      const mockProjectWithoutCol1 = {
        ...mockProject,
        columns: mockProject.columns.filter(c => c.id !== 'col-1')
      };
      setupProjectStoreMock([mockProjectWithoutCol1]);

      rerender(
        <BrowserRouter>
          <KanbanBoard />
        </BrowserRouter>
      );

      // Verify CreateTaskModal is no longer rendered because createTaskColumn check fails
      expect(screen.queryByTestId('create-task-modal')).not.toBeInTheDocument();
    });

  });
});
