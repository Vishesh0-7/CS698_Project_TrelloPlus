import { useMeetingStore } from '../store/meetingStore';
import { useChangeStore } from '../store/changeStore';
import { useNavigate } from 'react-router';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar, Clock, Plus, FileText, ListChecks } from 'lucide-react';

const statusConfig = {
  'scheduled': { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'in-progress': { label: 'In Progress', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'pending-approval': { label: 'Pending Approval', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'approved': { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200' },
  'rejected': { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
};

export function Meetings() {
  const meetings = useMeetingStore((s) => s.meetings);
  const allChanges = useChangeStore((s) => s.changes);
  const navigate = useNavigate();

  // Sort meetings by date (most recent first)
  const sortedMeetings = [...meetings].sort((a, b) => {
    const dateA = new Date(a.date + 'T' + a.time);
    const dateB = new Date(b.date + 'T' + b.time);
    return dateB.getTime() - dateA.getTime();
  });

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Meetings</h1>
            <p className="text-gray-600">Manage your meeting summaries and approvals</p>
          </div>
          <Button 
            onClick={() => navigate('/create-meeting')}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Meeting
          </Button>
        </div>

        {/* Meetings Grid */}
        {sortedMeetings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4" role="img" aria-label="No meetings illustration">
              <FileText className="w-8 h-8 text-blue-600" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first meeting</p>
            <Button 
              onClick={() => navigate('/create-meeting')}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Meeting
            </Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {sortedMeetings.map((meeting) => {
              const statusInfo = statusConfig[meeting.status];
              const pendingChanges = allChanges.filter(change => change.meetingId === meeting.id);
              const changeCount = pendingChanges.length;

              return (
                <div
                  key={meeting.id}
                  className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all"
                >
                  {/* Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-3">
                      <h3 
                        onClick={() => navigate(meeting.status === 'scheduled' ? `/meeting-transcript/${meeting.id}` : `/meetings/${meeting.id}`)}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer"
                      >
                        {meeting.title}
                      </h3>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusInfo.color}>
                        {statusInfo.label}
                      </Badge>
                      {changeCount > 0 && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                          {changeCount} changes
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4 flex-shrink-0" />
                      <span>
                        {new Date(meeting.date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>{meeting.time}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(meeting.status === 'scheduled' ? `/meeting-transcript/${meeting.id}` : `/meetings/${meeting.id}`)}
                      className="flex-1"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    {changeCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/meetings/${meeting.id}/changes`);
                        }}
                        className="flex-1"
                      >
                        <ListChecks className="w-4 h-4 mr-2" />
                        Changes ({changeCount})
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}