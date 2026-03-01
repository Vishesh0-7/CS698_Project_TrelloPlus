import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { TaskCard } from './TaskCard';
import { type BoardTask } from '../store/projectStore';
import { useDrop } from 'react-dnd';

interface Column {
  id: string;
  title: string;
  color: string;
}

interface KanbanColumnProps {
  column: Column;
  tasks: BoardTask[];
  onTaskClick: (task: BoardTask) => void;
  onMoveTask: (taskId: string, columnId: string) => void;
  onAddTask: () => void;
  editingColumnId: string | null;
  editingColumnTitle: string;
  onStartEditColumn: (columnId: string, currentTitle: string) => void;
  onSaveColumnName: () => void;
  onEditingColumnTitleChange: (title: string) => void;
  onCancelEditColumn: () => void;
  onDeleteColumn: (columnId: string) => void;
}

export function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onMoveTask,
  onAddTask,
  editingColumnId,
  editingColumnTitle,
  onStartEditColumn,
  onSaveColumnName,
  onEditingColumnTitleChange,
  onCancelEditColumn,
  onDeleteColumn,
}: KanbanColumnProps) {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'TASK',
    drop: (item: { id: string }) => {
      onMoveTask(item.id, column.id);
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const isEditing = editingColumnId === column.id;

  return (
    <div
      ref={drop}
      className={`flex-shrink-0 w-72 md:w-80 bg-gray-100 rounded-lg p-3 md:p-4 flex flex-col max-h-full group ${
        isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 md:mb-4 flex-shrink-0">
        {isEditing ? (
          <div className="flex items-center gap-1 flex-1">
            <Input
              value={editingColumnTitle}
              onChange={(e) => onEditingColumnTitleChange(e.target.value)}
              className="h-7 text-sm"
              autoFocus
              aria-label="Column title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveColumnName();
                if (e.key === 'Escape') onCancelEditColumn();
              }}
            />
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={onSaveColumnName}
              aria-label="Save column name"
            >
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-7 w-7" 
              onClick={onCancelEditColumn}
              aria-label="Cancel editing column name"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 text-sm md:text-base">{column.title}</h3>
              <span className="bg-gray-200 text-gray-600 text-xs font-medium px-2 py-0.5 rounded-full">
                {tasks.length}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                onClick={() => onStartEditColumn(column.id, column.title)}
                aria-label={`Rename column: ${column.title}`}
                title="Rename column"
              >
                <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8 text-red-500 opacity-0 group-hover:opacity-100 hover:opacity-100 focus:opacity-100"
                onClick={() => onDeleteColumn(column.id)}
                aria-label={`Delete column: ${column.title}`}
                title="Delete column"
              >
                <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 md:h-8 md:w-8"
                onClick={onAddTask}
                aria-label={`Add task to ${column.title}`}
                title="Add task"
              >
                <Plus className="w-3.5 h-3.5 md:w-4 md:h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Tasks - Scrollable */}
      <div className="space-y-2 md:space-y-3 overflow-y-auto flex-1 min-h-[100px] pr-1">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
        ))}
        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <p className="text-sm">No tasks</p>
            <button
              onClick={onAddTask}
              className="text-xs text-blue-500 hover:text-blue-700 mt-1 transition-colors"
            >
              Add a task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}