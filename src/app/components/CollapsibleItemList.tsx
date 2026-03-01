import { useState } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';

interface Item {
  id: string;
  description: string;
  sourceContext?: string;
  comment?: string;
}

interface CollapsibleItemListProps {
  items: Item[];
  onRemove?: (noteId: string) => void;
}

export function CollapsibleItemList({ items, onRemove }: CollapsibleItemListProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleItem = (itemId: string) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No items
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isExpanded = expandedItems.has(item.id);
        const hasDetails = item.sourceContext || item.comment;

        return (
          <div
            key={item.id}
            className="bg-gray-50 border border-gray-200 rounded-lg overflow-hidden hover:border-gray-300 transition-colors relative"
          >
            <button
              onClick={() => toggleItem(item.id)}
              className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-100 transition-colors"
            >
              {hasDetails ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                )
              ) : (
                <div className="w-4 h-4" />
              )}
              <p className="text-gray-900 flex-1 pr-8">{item.description}</p>
              {onRemove && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(item.id);
                  }}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </button>
            
            {isExpanded && hasDetails && (
              <div className="px-4 pb-4 pl-11 space-y-3">
                {item.sourceContext && (
                  <div className="bg-white rounded border border-gray-200 p-3">
                    <p className="text-xs font-medium text-gray-700 mb-1">Context:</p>
                    <p className="text-sm text-gray-600">{item.sourceContext}</p>
                  </div>
                )}
                
                {item.comment && (
                  <div className="bg-blue-50 rounded border border-blue-200 p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">Comment:</p>
                    <p className="text-sm text-blue-900">{item.comment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}