import { useState } from 'react';
import { Trash2, Loader2, CheckCircle2, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { type BoardTask } from '../store/projectStore';
import { Alert, AlertDescription } from './ui/alert';

interface CardDetailModalProps {
  task: BoardTask;
  projectId?: string;
  onClose: () => void;
  onUpdate: (task: BoardTask) => void;
  onDelete: (taskId: string) => void;
}

type ModalState = 'view' | 'editing' | 'saving' | 'success';

export function CardDetailModal({ task, onClose, onUpdate, onDelete }: CardDetailModalProps) {
  const [modalState, setModalState] = useState<ModalState>('view');
  const [editedTask, setEditedTask] = useState<BoardTask>(task);

  const handleSave = () => {
    setModalState('saving');
    
    // Simulate save operation
    setTimeout(() => {
      setModalState('success');
      setTimeout(() => {
        onUpdate(editedTask);
      }, 800);
    }, 1000);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      onDelete(task.id);
    }
  };

  const handleEdit = () => {
    setModalState('editing');
  };

  const handleCancel = () => {
    setEditedTask(task);
    setModalState('view');
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-full md:max-w-3xl max-h-[90vh] overflow-y-auto p-0 mx-4" aria-describedby="task-description-text">
        <DialogTitle className="sr-only">Task Details - {task.title}</DialogTitle>
        <DialogDescription className="sr-only" id="task-description-text">
          View and edit task details including title, description, assignee, and priority
        </DialogDescription>
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 z-10">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Task Details</h2>
        </div>

        {/* Status Alerts */}
        <div className="px-4 md:px-6">
          {modalState === 'saving' && (
            <Alert className="mt-4 bg-blue-50 border-blue-200">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                Saving changes...
              </AlertDescription>
            </Alert>
          )}

          {modalState === 'success' && (
            <Alert className="mt-4 bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-sm">
                Changes saved successfully!
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Content */}
        <div className="px-4 md:px-6 pb-4 md:pb-6 space-y-4 md:space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="task-title" className="text-sm">Title</Label>
            {modalState === 'editing' ? (
              <Input
                id="task-title"
                value={editedTask.title}
                onChange={(e) => setEditedTask({ ...editedTask, title: e.target.value })}
                className="mt-2"
              />
            ) : (
              <h3 className="text-base md:text-lg font-semibold text-gray-900 mt-2">{task.title}</h3>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="task-description" className="text-sm">Description</Label>
            {modalState === 'editing' ? (
              <Textarea
                id="task-description"
                value={editedTask.description}
                onChange={(e) => setEditedTask({ ...editedTask, description: e.target.value })}
                className="mt-2 min-h-[120px]"
              />
            ) : (
              <p className="text-sm md:text-base text-gray-700 mt-2">{task.description}</p>
            )}
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Assignee */}
            <div>
              <Label className="text-sm">Assignee</Label>
              {modalState === 'editing' ? (
                <Select
                  value={editedTask.assignee?.name || 'unassigned'}
                  onValueChange={(value) =>
                    setEditedTask({
                      ...editedTask,
                      assignee: value === 'unassigned'
                        ? undefined
                        : { name: value },
                    })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    <SelectItem value="Sarah Chen">Sarah Chen</SelectItem>
                    <SelectItem value="Mike Johnson">Mike Johnson</SelectItem>
                    <SelectItem value="Alex Kim">Alex Kim</SelectItem>
                    <SelectItem value="Emma Davis">Emma Davis</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 mt-2">
                  {task.assignee ? (
                    <>
                      <Avatar className="w-7 h-7 md:w-8 md:h-8">
                        <AvatarFallback>
                          {task.assignee.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm md:text-base text-gray-900">{task.assignee.name}</span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-400">Unassigned</span>
                  )}
                </div>
              )}
            </div>

            {/* Priority */}
            <div>
              <Label className="text-sm">Priority</Label>
              {modalState === 'editing' ? (
                <Select
                  value={editedTask.priority}
                  onValueChange={(value: BoardTask['priority']) =>
                    setEditedTask({ ...editedTask, priority: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className={
                      task.priority === 'CRITICAL'
                        ? 'bg-red-100 text-red-700 border-red-300'
                        : task.priority === 'HIGH'
                        ? 'bg-orange-100 text-orange-700 border-orange-300'
                        : task.priority === 'MEDIUM'
                        ? 'bg-blue-100 text-blue-700 border-blue-300'
                        : 'bg-gray-100 text-gray-700 border-gray-300'
                    }
                  >
                    {task.priority}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Save / Cancel Buttons at the Bottom (editing mode) */}
          {modalState === 'editing' && (
            <div className="border-t border-gray-200 pt-4 md:pt-6 flex gap-3">
              <Button variant="outline" onClick={handleCancel} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSave} className="flex-1">
                Save Changes
              </Button>
            </div>
          )}

          {/* Edit and Delete Buttons */}
          {modalState === 'view' && (
            <div className="border-t border-gray-200 pt-4 md:pt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={handleEdit}
                className="flex-1"
                size="sm"
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="flex-1"
                size="sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Task
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}