import { useEffect, useMemo, useState } from 'react';
import { useChangeStore, type ChangeRequest } from '../store/changeStore';
import { useMeetingStore, type Meeting } from '../store/meetingStore';
import { useNavigate } from 'react-router';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Calendar, Clock, Plus, FileText, ListChecks, Video, ExternalLink } from 'lucide-react';
import { apiService, type MeetingResponse, type ChangeResponse } from '../services/api';
import { toast } from 'sonner';
import { formatMeetingDate, formatMeetingTime, getMeetingSortValue } from '../utils/meetingDateTime';

const statusConfig = {
  'scheduled': { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  'in-progress': { label: 'In Progress', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  'pending-approval': { label: 'Pending Approval', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  'approved': { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200' },
  'rejected': { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
};

export function Meetings() {
  const [meetings, setMeetings] = useState<MeetingResponse[]>([]);
  const [projectNameById, setProjectNameById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const setMeetingsStore = useMeetingStore((s) => s.setMeetings);
  const setChangesStore = useChangeStore((s) => s.setChanges);
  const allChanges = useChangeStore((s) => s.changes);
  const navigate = useNavigate();
  const [rescheduleMeeting, setRescheduleMeeting] = useState<MeetingResponse | null>(null);
  const [removeMeeting, setRemoveMeeting] = useState<MeetingResponse | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [isUpdatingMeeting, setIsUpdatingMeeting] = useState(false);

  const toJoinHref = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const normalizeMeetingStatus = (status: string): Meeting['status'] => {
    switch (status) {
      case 'SCHEDULED':
        return 'scheduled';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'PENDING_APPROVAL':
        return 'pending-approval';
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'scheduled';
    }
  };

  const mapMeetingToStore = (meeting: MeetingResponse): Meeting => ({
    id: meeting.id,
    projectId: meeting.projectId,
    title: meeting.title,
    date: meeting.meetingDate,
    time: (meeting.meetingTime || '').slice(0, 5),
    members: (meeting.members || []).map((m) => m.username || m.email),
    agenda: meeting.description || '',
    platform: meeting.platform,
    link: meeting.meetingLink,
    transcript: '',
    status: normalizeMeetingStatus(meeting.status),
    actionItems: [],
    decisions: [],
    changes: [],
    otherNotes: [],
    approvals: [],
    totalApprovers: 0,
    userHasApproved: false,
  });

  const mapChangeToStore = (change: ChangeResponse): ChangeRequest => ({
    id: change.id,
    meetingId: change.meetingId,
    meetingTitle: '',
    type: change.changeType as ChangeRequest['type'],
    status: change.status as ChangeRequest['status'],
    requestedBy: 'system',
    requestedAt: change.createdAt,
    projectId: '',
    before: undefined,
    after: undefined,
    affectedCards: [],
    affectedStages: [],
    affectedMembers: [],
    riskLevel: 'LOW',
    approvals: [],
    requiredApprovals: 0,
    rollbackAvailable: false,
  });

  const loadMeetings = async () => {
    setIsLoading(true);

    try {
      const projects = await apiService.getUserProjects();
      setProjectNameById(
        projects.reduce<Record<string, string>>((acc, project) => {
          acc[project.id] = project.name;
          return acc;
        }, {})
      );

      const meetingResults = await Promise.all(
        projects.map((project) => apiService.getMeetingsByProject(project.id))
      );

      const changeResults = await Promise.all(
        projects.map((project) => apiService.listChanges({ projectId: project.id }))
      );

      const mergedMeetings = meetingResults.flat();
      const uniqueMeetings = Array.from(new Map(mergedMeetings.map((m) => [m.id, m])).values());
      const mergedChanges = changeResults.flat();
      const uniqueChanges = Array.from(new Map(mergedChanges.map((c) => [c.id, c])).values());

      setMeetings(uniqueMeetings);
      setMeetingsStore(uniqueMeetings.map(mapMeetingToStore));
      setChangesStore(uniqueChanges.map(mapChangeToStore));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const openRescheduleDialog = (meeting: MeetingResponse) => {
    setRescheduleMeeting(meeting);
    setRescheduleDate(meeting.meetingDate);
    setRescheduleTime((meeting.meetingTime || '').slice(0, 5));
  };

  const handleRescheduleMeeting = async () => {
    if (!rescheduleMeeting || !rescheduleDate || !rescheduleTime) {
      toast.error('Please provide both date and time');
      return;
    }

    setIsUpdatingMeeting(true);
    try {
      await apiService.updateMeeting(rescheduleMeeting.id, {
        title: rescheduleMeeting.title,
        description: rescheduleMeeting.description,
        meetingDate: rescheduleDate,
        meetingTime: `${rescheduleTime}:00`,
        platform: rescheduleMeeting.platform,
        meetingLink: rescheduleMeeting.meetingLink,
      });
      toast.success('Meeting rescheduled');
      setRescheduleMeeting(null);
      await loadMeetings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reschedule meeting');
    } finally {
      setIsUpdatingMeeting(false);
    }
  };

  const handleRemoveMeeting = async () => {
    if (!removeMeeting) return;
    setIsUpdatingMeeting(true);
    try {
      await apiService.deleteMeeting(removeMeeting.id);
      toast.success('Meeting removed');
      setRemoveMeeting(null);
      await loadMeetings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove meeting');
    } finally {
      setIsUpdatingMeeting(false);
    }
  };

  useEffect(() => {
    void loadMeetings();
  }, []);

  const normalizeMeetingStatusLabel = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'scheduled';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'PENDING_APPROVAL':
        return 'pending-approval';
      case 'APPROVED':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      default:
        return 'scheduled';
    }
  };

  // Sort meetings by date (most recent first)
  const sortedMeetings = useMemo(() => {
    return [...meetings].sort((a, b) => {
      return getMeetingSortValue(b.meetingDate, b.meetingTime) - getMeetingSortValue(a.meetingDate, a.meetingTime);
    });
  }, [meetings]);

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
        {isLoading ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Loading meetings...</h3>
          </div>
        ) : sortedMeetings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4" role="img" aria-label="No meetings illustration">
              <FileText className="w-8 h-8 text-blue-600" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
            <p className="text-gray-600">Get started by creating your first meeting</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {sortedMeetings.map((meeting) => {
              const normalizedStatus = normalizeMeetingStatusLabel(meeting.status);
              const statusInfo = statusConfig[normalizedStatus];
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
                        onClick={() => navigate(normalizedStatus === 'scheduled' ? `/meeting-transcript/${meeting.id}` : `/meetings/${meeting.id}`)}
                        className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors line-clamp-2 cursor-pointer"
                      >
                        {meeting.title}
                      </h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      Project: {meeting.projectName || projectNameById[meeting.projectId] || 'N/A'}
                    </p>
                    
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
                      <span>{formatMeetingDate(meeting.meetingDate)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      <span>{formatMeetingTime(meeting.meetingTime)}</span>
                    </div>

                    {normalizedStatus === 'scheduled' && (
                      <>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Video className="w-4 h-4 flex-shrink-0" />
                          <span>{meeting.platform?.trim() || 'Platform not set'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <ExternalLink className="w-4 h-4 flex-shrink-0" />
                          {toJoinHref(meeting.meetingLink) ? (
                            <a
                              href={toJoinHref(meeting.meetingLink) || undefined}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:text-blue-700 underline truncate"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Join meeting
                            </a>
                          ) : (
                            <span>Join link not set</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-200 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(normalizedStatus === 'scheduled' ? `/meeting-transcript/${meeting.id}` : `/meetings/${meeting.id}`)}
                      className="flex-1 min-w-[120px]"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View
                    </Button>
                    {normalizedStatus === 'scheduled' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRescheduleDialog(meeting);
                          }}
                          className="flex-1 min-w-[120px]"
                        >
                          Reschedule
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveMeeting(meeting);
                          }}
                          className="flex-1 min-w-[120px] text-red-700 border-red-300"
                        >
                          Remove
                        </Button>
                      </>
                    )}
                    {changeCount > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/meetings/${meeting.id}/changes`);
                        }}
                        className="flex-1 min-w-[120px]"
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

      <Dialog open={!!rescheduleMeeting} onOpenChange={(open) => { if (!open) setRescheduleMeeting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Meeting</DialogTitle>
            <DialogDescription>
              Update date and time for {rescheduleMeeting?.title || 'this meeting'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-700">Date</label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Time</label>
              <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleMeeting(null)} disabled={isUpdatingMeeting}>Cancel</Button>
            <Button onClick={() => void handleRescheduleMeeting()} disabled={isUpdatingMeeting}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeMeeting} onOpenChange={(open) => { if (!open) setRemoveMeeting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Scheduled Meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {removeMeeting?.title || 'this meeting'}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingMeeting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleRemoveMeeting()} className="bg-red-600 hover:bg-red-700" disabled={isUpdatingMeeting}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}