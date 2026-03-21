import { ChangeRequest } from '../store/changeStore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import { Badge } from './ui/badge';

interface ChangeDetailModalProps {
  change: ChangeRequest | null;
  open: boolean;
  onClose: () => void;
}

export function ChangeDetailModal({ change, open, onClose }: ChangeDetailModalProps) {
  if (!change) return null;

  const renderValue = (value: any) => {
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value)
        .filter(([key]) => key !== 'id' && key !== 'stageId' && key !== 'columnId')
        .map(([key, val]) => {
          // Handle nested objects (like assignee)
          let displayValue = val;
          if (typeof val === 'object' && val !== null) {
            // If it's an object with a 'name' property, use that
            if ('name' in val) {
              displayValue = val.name;
            } else {
              // Otherwise, stringify it nicely
              displayValue = JSON.stringify(val);
            }
          }
          
          return (
            <div key={key} className="mb-2">
              <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}: </span>
              <span className="text-gray-700">{String(displayValue)}</span>
            </div>
          );
        });
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
            {change.before && (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Before
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(change.before)}
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
            {!change.before && change.after && (
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
            {change.before && !change.after && (
              <div className="md:col-span-2 bg-red-50 rounded-lg p-4 border border-red-200">
                <h3 className="font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Card to be Deleted
                </h3>
                <div className="text-sm space-y-1">
                  {renderValue(change.before)}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}