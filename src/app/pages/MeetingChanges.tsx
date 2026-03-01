import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useChangeStore, type ChangeRequest } from '../store/changeStore';
import { useMeetingStore } from '../store/meetingStore';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ChangeDetailModal } from '../components/ChangeDetailModal';
import { ArrowLeft } from 'lucide-react';

const changeTypeConfig: Record<string, { label: string; color: string }> = {
  MOVE_CARD: { label: 'Move Card', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  UPDATE_CARD: { label: 'Update Card', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  CREATE_CARD: { label: 'Create Card', color: 'bg-green-50 text-green-700 border-green-200' },
  DELETE_CARD: { label: 'Delete Card', color: 'bg-red-50 text-red-700 border-red-200' },
};

export function MeetingChanges() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const meeting = useMeetingStore((s) => s.meetings.find((m) => m.id === meetingId));
  const allChanges = useChangeStore((s) => s.changes);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);

  const changes = allChanges.filter((c) => c.meetingId === meetingId);

  const getChangeDescription = (change: ChangeRequest) => {
    const title = (change.after as any)?.title || (change.before as any)?.title || 'Untitled';
    
    switch (change.type) {
      case 'CREATE_CARD':
        return `Create new card: ${title}`;
      case 'DELETE_CARD':
        return `Delete card: ${title}`;
      case 'UPDATE_CARD':
        return `Update card: ${title}`;
      case 'MOVE_CARD':
        const from = (change.before as any)?.columnId || 'Unknown';
        const to = (change.after as any)?.columnId || 'Unknown';
        return `Move card: ${title} (${from} → ${to})`;
      default:
        return title;
    }
  };

  if (!meeting) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting not found</h2>
        <Button onClick={() => navigate('/meetings')}>Back to Meetings</Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate(`/project/${meeting.projectId}?tab=meetings`)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meetings
          </Button>
          
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Board Changes</h1>
            <p className="text-gray-600">{meeting.title}</p>
          </div>
        </div>

        {/* Changes List */}
        {changes.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No changes</h3>
            <p className="text-gray-600">There are no board changes for this meeting</p>
          </div>
        ) : (
          <div className="space-y-3">
            {changes.map((change) => {
              const typeConfig = changeTypeConfig[change.type] || { 
                label: change.type, 
                color: 'bg-gray-50 text-gray-700 border-gray-200' 
              };
              
              return (
                <div
                  key={change.id}
                  onClick={() => setSelectedChange(change)}
                  className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-gray-300 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={typeConfig.color}>
                          {typeConfig.label}
                        </Badge>
                      </div>
                      <p className="text-gray-900">
                        {getChangeDescription(change)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Change Detail Modal */}
      <ChangeDetailModal
        change={selectedChange}
        open={!!selectedChange}
        onClose={() => setSelectedChange(null)}
      />
    </div>
  );
}