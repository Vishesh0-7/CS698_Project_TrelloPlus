import { Badge } from './ui/badge';
import { type BoardTask } from '../store/projectStore';
import { useDrag } from 'react-dnd';
import { GripVertical } from 'lucide-react';

interface TaskCardProps {
  task: BoardTask;
  onClick: () => void;
}

const priorityConfig = {
  LOW: { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-300' },
  MEDIUM: { label: 'Medium', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  HIGH: { label: 'High', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  CRITICAL: { label: 'Critical', color: 'bg-red-100 text-red-700 border-red-300' },
};

export function TaskCard({ task, onClick }: TaskCardProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'TASK',
    item: { id: task.id },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      onClick={onClick}
      className={`bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-all group ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Drag Handle */}
      <div className="flex items-start gap-2 mb-3">
        <GripVertical className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h4 className="font-medium text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
            {task.title}
          </h4>
          <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
        </div>
      </div>

      {/* Card Footer */}
      <div className="flex items-center justify-between mt-3">
        <Badge variant="outline" className={priorityConfig[task.priority].color}>
          {priorityConfig[task.priority].label}
        </Badge>
      </div>
    </div>
  );
}