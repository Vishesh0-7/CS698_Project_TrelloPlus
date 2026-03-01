import { useState, useEffect } from 'react';
import { ChangeRequest, useChangeStore } from '../store/changeStore';
import { useProjectStore, type BoardTask } from '../store/projectStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

interface ChangeDetailModalProps {
  change: ChangeRequest | null;
  open: boolean;
  onClose: () => void;
}

export function ChangeDetailModal({ change, open, onClose }: ChangeDetailModalProps) {
  const toggleBoardApplication = useChangeStore((s) => s.toggleBoardApplication);
  const getChangeById = useChangeStore((s) => s.getChangeById);
  const addTask = useProjectStore((s) => s.addTask);
  const updateTask = useProjectStore((s) => s.updateTask);
  const deleteTask = useProjectStore((s) => s.deleteTask);
  const moveTask = useProjectStore((s) => s.moveTask);

  // Get the latest change data from the store to ensure we have the current state
  const latestChange = change ? getChangeById(change.id) : null;
  const currentChange = latestChange || change;

  if (!currentChange) return null;

  const handleApplyChange = (checked: boolean) => {
    if (!currentChange) return;

    // First toggle the state in the store
    toggleBoardApplication(currentChange.id);

    // The 'checked' parameter represents the NEW state (after toggle)
    if (checked) {
      // Apply the change to the board
      switch (currentChange.type) {
        case 'CREATE_CARD':
          if (currentChange.after && currentChange.projectId) {
            const taskData = currentChange.after as any;
            
            // Check if task already exists to avoid duplicates
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (!existingTask) {
              addTask(currentChange.projectId, {
                id: taskData.id,
                title: taskData.title,
                description: taskData.description || '',
                columnId: taskData.columnId,
                assignee: taskData.assignee,
                priority: taskData.priority,
                createdDate: new Date().toISOString().split('T')[0],
              });
              toast.success('Card created on board');
            }
          }
          break;

        case 'UPDATE_CARD':
          if (currentChange.after && currentChange.projectId) {
            const taskData = currentChange.after as any;
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (existingTask) {
              updateTask(currentChange.projectId, {
                ...existingTask,
                title: taskData.title,
                description: taskData.description,
                assignee: taskData.assignee,
                priority: taskData.priority,
                columnId: existingTask.columnId, // Preserve the column
              });
              toast.success('Card updated on board');
            }
          }
          break;

        case 'MOVE_CARD':
          if (currentChange.after && currentChange.projectId) {
            const taskData = currentChange.after as any;
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (existingTask) {
              moveTask(currentChange.projectId, taskData.id, taskData.columnId);
              toast.success('Card moved on board');
            }
          }
          break;

        case 'DELETE_CARD':
          if (currentChange.before && currentChange.projectId) {
            const taskData = currentChange.before as any;
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (existingTask) {
              deleteTask(currentChange.projectId, taskData.id);
              toast.success('Card deleted from board');
            }
          }
          break;
      }
    } else {
      // Revert the change
      switch (currentChange.type) {
        case 'CREATE_CARD':
          if (currentChange.after && currentChange.projectId) {
            const taskData = currentChange.after as any;
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (existingTask) {
              deleteTask(currentChange.projectId, taskData.id);
              toast.info('Card removed from board');
            }
          }
          break;

        case 'UPDATE_CARD':
          if (currentChange.before && currentChange.projectId) {
            const taskData = currentChange.before as any;
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (existingTask) {
              updateTask(currentChange.projectId, {
                ...existingTask,
                title: taskData.title,
                description: taskData.description,
                assignee: taskData.assignee,
                priority: taskData.priority,
                columnId: existingTask.columnId, // Preserve the column
              });
              toast.info('Card reverted to previous state');
            }
          }
          break;

        case 'MOVE_CARD':
          if (currentChange.before && currentChange.projectId) {
            const taskData = currentChange.before as any;
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (existingTask) {
              moveTask(currentChange.projectId, taskData.id, taskData.columnId);
              toast.info('Card moved back');
            }
          }
          break;

        case 'DELETE_CARD':
          if (currentChange.before && currentChange.projectId) {
            const taskData = currentChange.before as any;
            
            // Check if task already exists to avoid duplicates
            const project = useProjectStore.getState().projects.find(p => p.id === currentChange.projectId);
            const existingTask = project?.tasks.find(t => t.id === taskData.id);
            
            if (!existingTask) {
              addTask(currentChange.projectId, {
                id: taskData.id,
                title: taskData.title,
                description: taskData.description || '',
                columnId: taskData.columnId,
                assignee: taskData.assignee,
                priority: taskData.priority,
                createdDate: new Date().toISOString().split('T')[0],
              });
              toast.info('Card restored to board');
            }
          }
          break;
      }
    }
  };

  const renderValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, val]) => (
          <div key={key} className="mb-2">
            <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
            <span className="text-gray-700">{String(val)}</span>
          </div>
        ));
    }
    return <span className="text-gray-700">{String(value)}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" aria-describedby="change-detail-description">
        <DialogHeader>
          <DialogTitle>Change Details</DialogTitle>
          <DialogDescription id="change-detail-description">
            Visual representation of the proposed change
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Change Type and Apply Checkbox */}
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-sm">
              {currentChange.type.replace(/_/g, ' ')}
            </Badge>
            
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
              <Checkbox 
                id={`apply-change-${currentChange.id}`}
                checked={currentChange.isAppliedToBoard || false}
                onCheckedChange={handleApplyChange}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label 
                htmlFor={`apply-change-${currentChange.id}`}
                className="text-sm font-medium text-blue-900 cursor-pointer select-none"
              >
                Apply to Board
              </label>
              {currentChange.isAppliedToBoard && <Check className="w-4 h-4 text-green-600" />}
            </div>
          </div>

          {/* Visual Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Before State */}
            {currentChange.before && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Before
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(currentChange.before)}
                </div>
              </div>
            )}

            {/* After State */}
            {currentChange.after && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  After
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(currentChange.after)}
                </div>
              </div>
            )}

            {/* For CREATE_CARD - only show After */}
            {!currentChange.before && currentChange.after && (
              <div className="md:col-span-2 bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  New Card
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(currentChange.after)}
                </div>
              </div>
            )}

            {/* For DELETE_CARD - only show Before */}
            {currentChange.before && !currentChange.after && (
              <div className="md:col-span-2 bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Card to be Deleted
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(currentChange.before)}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}