interface Item {
  id: string;
  description: string;
  sourceContext?: string;
  comment?: string;
}

interface SimplifiedItemListProps {
  items: Item[];
}

export function SimplifiedItemList({ items }: SimplifiedItemListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No items
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-gray-50 border border-gray-200 rounded-lg p-4"
        >
          <p className="text-gray-900">{item.description}</p>
          
          {item.sourceContext && (
            <p className="text-xs text-gray-500 mt-2">{item.sourceContext}</p>
          )}
          
          {item.comment && (
            <div className="mt-3 p-3 bg-white rounded border border-gray-300">
              <p className="text-xs font-medium text-gray-700 mb-1">Comment:</p>
              <p className="text-sm text-gray-600">{item.comment}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
