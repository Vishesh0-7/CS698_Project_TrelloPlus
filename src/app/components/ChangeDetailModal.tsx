import { ChangeRequest } from '../store/changeStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';
import { useProjectStore } from '../store/projectStore';

interface ChangeDetailModalProps {
  change: ChangeRequest | null;
  open: boolean;
  onClose: () => void;
}

export function ChangeDetailModal({ change, open, onClose }: ChangeDetailModalProps) {
  const project = useProjectStore((state) =>
    change ? state.projects.find((p) => p.id === change.projectId) : undefined
  );

  if (!change) return null;

  const resolveColumnNameById = (id: string) => {
    const column = project?.columns?.find((c) => c.id === id);
    return column?.title || id;
  };

  const getColumnLabel = (value: any) => {
    if (!value || typeof value !== 'object') return 'N/A';
    if (value.columnTitle) return value.columnTitle;
    if (value.stageTitle) return value.stageTitle;
    if (value.columnName) return value.columnName;
    if (value.stageName) return value.stageName;
    if (value.columnId && typeof value.columnId === 'string') return resolveColumnNameById(value.columnId);
    if (value.stageId && typeof value.stageId === 'string') return resolveColumnNameById(value.stageId);
    return 'N/A';
  };

  const resolveLiveBeforeForUpdate = () => {
    if (!change || change.type !== 'UPDATE_CARD' || !project) return change?.before;

    const beforeId = change.before && typeof change.before === 'object' ? (change.before as any).id : undefined;
    const afterId = change.after && typeof change.after === 'object' ? (change.after as any).id : undefined;
    const targetCardId = beforeId || afterId;

    if (!targetCardId || typeof targetCardId !== 'string') {
      return change.before;
    }

    const currentCard = project.tasks.find((task) => task.id === targetCardId);
    if (!currentCard) {
      return change.before;
    }

    const currentColumn = project.columns.find((column) => column.id === currentCard.columnId);
    return {
      id: currentCard.id,
      title: currentCard.title,
      description: currentCard.description,
      priority: currentCard.priority,
      columnId: currentCard.columnId,
      columnTitle: currentColumn?.title || currentCard.columnId,
    };
  };

  const resolvedBeforeState = resolveLiveBeforeForUpdate();

  const renderValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      const columnLabel = getColumnLabel(value);
      const filteredEntries = Object.entries(value).filter(([key]) =>
        key !== 'id'
        && key !== 'stageId'
        && key !== 'columnId'
        && key !== 'stageTitle'
        && key !== 'columnTitle'
        && key !== 'stageName'
        && key !== 'columnName'
      );

      return (
        <>
          {columnLabel !== 'N/A' && (
            <div className="mb-2">
              <span className="font-medium">Column: </span>
              <span className="text-gray-700">{columnLabel}</span>
            </div>
          )}
          {filteredEntries.map(([key, val]) => {
            let displayValue = val;
            if (typeof val === 'object' && val !== null) {
              if ('name' in val) {
                displayValue = val.name;
              } else {
                displayValue = JSON.stringify(val);
              }
            }

            return (
              <div key={key} className="mb-2">
                <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
                <span className="text-gray-700">{String(displayValue)}</span>
              </div>
            );
          })}
        </>
      );
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
              {change.type.replace(/_/g, ' ')}
            </Badge>
          </div>

          {/* Visual Comparison */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Before State */}
            {resolvedBeforeState && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Before
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(resolvedBeforeState)}
                </div>
              </div>
            )}

            {/* After State */}
            {change.after && (
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  After
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(change.after)}
                </div>
              </div>
            )}

            {/* For CREATE_CARD - only show After */}
            {!resolvedBeforeState && change.after && (
              <div className="md:col-span-2 bg-green-50 rounded-lg p-4 border border-green-200">
                <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  New Card
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(change.after)}
                </div>
              </div>
            )}

            {/* For DELETE_CARD - only show Before */}
            {resolvedBeforeState && !change.after && (
              <div className="md:col-span-2 bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Card to be Deleted
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(resolvedBeforeState)}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}