import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';

interface CreateTaskModalProps {
  columnId: string;
  columnTitle: string;
  onClose: () => void;
  onCreateTask: (task: {
    title: string;
    description: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    columnId: string;
  }) => void;
}

export function CreateTaskModal({ columnId, columnTitle, onClose, onCreateTask }: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }
    onCreateTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      columnId,
    });
    toast.success('Task created successfully');
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-full md:max-w-lg mx-4 p-0" aria-describedby="create-task-description">
        <DialogTitle className="sr-only">Create New Task in {columnTitle}</DialogTitle>
        <DialogDescription className="sr-only" id="create-task-description">
          Create a new task with title, description, and priority level
        </DialogDescription>
        
        <div className="px-4 md:px-6 pt-3 md:pt-4 border-b border-gray-200 pb-3 md:pb-4">
          <h2 className="text-lg font-semibold text-gray-900">Create New Task</h2>
          <p className="text-xs text-gray-500 mt-0.5">Adding to: {columnTitle}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-4 md:px-6 pb-4 md:pb-6 space-y-4 mt-2">
          <div>
            <Label htmlFor="new-task-title">Title</Label>
            <Input
              id="new-task-title"
              placeholder="Enter task title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-2"
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="new-task-desc">Description</Label>
            <Textarea
              id="new-task-desc"
              placeholder="Describe the task..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-2 min-h-[100px]"
            />
          </div>

          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL') => setPriority(v)}>
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
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Create Task
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}