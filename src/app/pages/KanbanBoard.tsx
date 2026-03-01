import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Plus, Check, X, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { KanbanColumn } from '../components/KanbanColumn';
import { CardDetailModal } from '../components/CardDetailModal';
import { CreateTaskModal } from '../components/CreateTaskModal';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useProjectStore, type BoardTask, type BoardColumn } from '../store/projectStore';
import { toast } from 'sonner';

export type { BoardTask as Task };

export function KanbanBoard() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  // Support both /board/:boardId and /project/:projectId routes
  const project = useProjectStore((s) => 
    s.projects.find((p) => p.boardId === projectId || p.id === projectId)
  );
  const { moveTask, updateTask, deleteTask, addTask, addColumnToProject, renameColumn, deleteColumn } = useProjectStore();

  const [selectedTask, setSelectedTask] = useState<BoardTask | null>(null);
  const [createTaskColumnId, setCreateTaskColumnId] = useState<string | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState('');

  if (!project) {
    return (
      <div className="h-screen pt-16 flex flex-col items-center justify-center bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
        <p className="text-gray-600 mb-4">The board you're looking for doesn't exist.</p>
        <Button onClick={() => navigate('/')}>Back to Projects</Button>
      </div>
    );
  }

  const handleMoveTask = (taskId: string, newColumnId: string) => {
    moveTask(project.id, taskId, newColumnId);
  };

  const handleUpdateTask = (updatedTask: BoardTask) => {
    updateTask(project.id, updatedTask);
    setSelectedTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    deleteTask(project.id, taskId);
    setSelectedTask(null);
  };

  const handleCreateTask = (taskData: { title: string; description: string; priority: BoardTask['priority']; columnId: string }) => {
    const newTask: BoardTask = {
      id: `task-${Date.now()}`,
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority,
      createdDate: new Date().toISOString().split('T')[0],
      columnId: taskData.columnId,
    };
    addTask(project.id, newTask);
  };

  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) {
      toast.error('Column name is required');
      return;
    }

    const colors = ['bg-purple-100', 'bg-pink-100', 'bg-teal-100', 'bg-orange-100', 'bg-indigo-100', 'bg-cyan-100'];
    const colorIndex = project.columns.length % colors.length;

    const newColumn: BoardColumn = {
      id: `col-${Date.now()}`,
      title: newColumnTitle.trim(),
      color: colors[colorIndex],
    };

    addColumnToProject(project.id, newColumn);
    setNewColumnTitle('');
    setAddingColumn(false);
    toast.success(`Column "${newColumn.title}" added`);
  };

  const handleStartEditColumn = (columnId: string, currentTitle: string) => {
    setEditingColumnId(columnId);
    setEditingColumnTitle(currentTitle);
  };

  const handleSaveColumnName = () => {
    if (editingColumnId && editingColumnTitle.trim()) {
      renameColumn(project.id, editingColumnId, editingColumnTitle.trim());
      toast.success('Column renamed');
    }
    setEditingColumnId(null);
    setEditingColumnTitle('');
  };

  const handleDeleteColumn = (columnId: string) => {
    const tasksInColumn = project.tasks.filter((t) => t.columnId === columnId).length;
    const msg = tasksInColumn > 0
      ? `Delete this column and its ${tasksInColumn} task${tasksInColumn > 1 ? 's' : ''}?`
      : 'Delete this column?';
    if (window.confirm(msg)) {
      deleteColumn(project.id, columnId);
      toast.success('Column deleted');
    }
  };

  const getTasksByColumn = (columnId: string) => {
    return project.tasks.filter((task) => task.columnId === columnId);
  };

  const createTaskColumn = project.columns.find((c) => c.id === createTaskColumnId);

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-full flex flex-col bg-gray-50 pt-16">
        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto p-3 md:p-6">
          <div className="flex gap-3 md:gap-4 h-full min-w-max pb-4">
            {project.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                column={column}
                tasks={getTasksByColumn(column.id)}
                onTaskClick={setSelectedTask}
                onMoveTask={handleMoveTask}
                onAddTask={() => setCreateTaskColumnId(column.id)}
                editingColumnId={editingColumnId}
                editingColumnTitle={editingColumnTitle}
                onStartEditColumn={handleStartEditColumn}
                onSaveColumnName={handleSaveColumnName}
                onEditingColumnTitleChange={setEditingColumnTitle}
                onCancelEditColumn={() => setEditingColumnId(null)}
                onDeleteColumn={handleDeleteColumn}
              />
            ))}

            {/* Add Column */}
            <div className="flex-shrink-0 w-72 md:w-80">
              {addingColumn ? (
                <div className="bg-gray-100 rounded-lg p-3 md:p-4">
                  <Input
                    placeholder="Column name..."
                    value={newColumnTitle}
                    onChange={(e) => setNewColumnTitle(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddColumn();
                      if (e.key === 'Escape') { setAddingColumn(false); setNewColumnTitle(''); }
                    }}
                    className="mb-2"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddColumn} className="flex-1">
                      <Check className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setAddingColumn(false); setNewColumnTitle(''); }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-full h-12 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Add Column</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Card Detail Modal */}
        {selectedTask && (
          <CardDetailModal
            task={selectedTask}
            projectId={project.id}
            onClose={() => setSelectedTask(null)}
            onUpdate={handleUpdateTask}
            onDelete={handleDeleteTask}
          />
        )}

        {/* Create Task Modal */}
        {createTaskColumnId && createTaskColumn && (
          <CreateTaskModal
            columnId={createTaskColumnId}
            columnTitle={createTaskColumn.title}
            onClose={() => setCreateTaskColumnId(null)}
            onCreateTask={handleCreateTask}
          />
        )}
      </div>
    </DndProvider>
  );
}