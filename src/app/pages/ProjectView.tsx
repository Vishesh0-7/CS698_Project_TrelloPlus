import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useProjectStore } from '../store/projectStore';
import { useWebSocketBoardUpdates } from '../hooks/useWebSocketBoardUpdates';
import { useChangeStore, type ChangeRequest } from '../store/changeStore';
import { useMeetingStore, type Meeting } from '../store/meetingStore';
import { KanbanBoard } from './KanbanBoard';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { ChangeDetailModal } from '../components/ChangeDetailModal';
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
import { Calendar, Clock, Plus, FileText, ListChecks, CheckCircle, BookOpen, Video, ExternalLink } from 'lucide-react';
import { apiService, mapProjectResponseToProject, type MeetingResponse, type ChangeResponse } from '../services/api';
import { toast } from 'sonner';
import { formatMeetingDate, formatMeetingTime, getMeetingSortValue } from '../utils/meetingDateTime';

type Tab = 'board' | 'meetings' | 'decisions';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl || 'board');
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [projectLoadFailed, setProjectLoadFailed] = useState(false);
  const [projectMeetings, setProjectMeetings] = useState<MeetingResponse[]>([]);
  const [rescheduleMeeting, setRescheduleMeeting] = useState<MeetingResponse | null>(null);
  const [removeMeeting, setRemoveMeeting] = useState<MeetingResponse | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [isUpdatingMeeting, setIsUpdatingMeeting] = useState(false);
  const attemptedProjectLoadRef = useRef<string | null>(null);
  const decisionsLoadKeyRef = useRef<string | null>(null);

  const toJoinHref = (value?: string) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };
  
  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ['board', 'meetings', 'decisions'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const setProjects = useProjectStore((s) => s.setProjects);
  const updateProject = useProjectStore((s) => s.updateProject);
  const setMeetingsStore = useMeetingStore((s) => s.setMeetings);
  const setChangesStore = useChangeStore((s) => s.setChanges);
  const allChanges = useChangeStore((s) => s.changes);

  const loadProjectDecisions = async (projectMeetingsList: MeetingResponse[]) => {
    if (!projectId) {
      return;
    }

    // Filter to only APPROVED meetings (not SCHEDULED, IN_PROGRESS, PENDING_APPROVAL, or REJECTED)
    const approvedMeetings = projectMeetingsList.filter(
      (meeting) => meeting.status === 'APPROVED'
    );

    if (approvedMeetings.length === 0) {
      updateProject(projectId, { decisions: [] });
      return;
    }

    // Fetch summaries for all approved meetings and extract decisions
    const summaryResults = await Promise.all(
      approvedMeetings.map(async (meeting) => {
        try {
          const [summary, approvalStatus] = await Promise.all([
            apiService.getSummaryByMeeting(meeting.id),
            apiService.getApprovalStatus(meeting.id),
          ]);
          const approvedByUsers = (approvalStatus.responses || [])
            .filter((response) => response.response === 'APPROVED')
            .map((response) => response.userName)
            .filter((name) => Boolean(name && name.trim().length > 0));
          return { meeting, summary, approvedByUsers };
        } catch (error) {
          console.error(`[Decisions] Error fetching summary for meeting ${meeting.id}:`, error);
          return null;
        }
      })
    );

    // Extract decisions from summaries
    const decisions = summaryResults
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .flatMap(({ meeting, summary, approvedByUsers }) => {
        const decisionList = summary.decisions || [];
        return decisionList.map((decision) => ({
          id: decision.id,
          description: decision.description,
          meetingId: meeting.id,
          meetingTitle: meeting.title,
          sourceContext: decision.sourceContext || '',
          approvedAt: summary.approvedAt || summary.generatedAt || `${meeting.meetingDate}T${meeting.meetingTime || '00:00:00'}`,
          approvedBy: approvedByUsers.length > 0 ? approvedByUsers.join(', ') : 'N/A',
        }));
      });

    updateProject(projectId, { decisions });
  };

  const getApprovedMeetingsLoadKey = (meetings: MeetingResponse[]) => {
    return meetings
      .filter((meeting) => meeting.status === 'APPROVED')
      .map((meeting) => `${meeting.id}:${meeting.status}`)
      .sort()
      .join('|');
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
    projectId: projectId || '',
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

  useEffect(() => {
    if (!projectId) {
      setProjectMeetings([]);
      return;
    }

    let isMounted = true;

    const loadProjectMeetings = async () => {
      try {
        const meetings = await apiService.getMeetingsByProject(projectId);
        const changes = await apiService.listChanges({ projectId });
        if (isMounted) {
          setProjectMeetings(meetings);
          setMeetingsStore(meetings.map(mapMeetingToStore));
          setChangesStore(changes.map(mapChangeToStore));
        }
      } catch (error) {
        if (isMounted) {
          toast.error(error instanceof Error ? error.message : 'Failed to load project meetings');
        }
      }
    };

    void loadProjectMeetings();

    return () => {
      isMounted = false;
    };
  }, [projectId]);

  const refreshProjectMeetings = async () => {
    if (!projectId) return;

    const meetings = await apiService.getMeetingsByProject(projectId);
    const changes = await apiService.listChanges({ projectId });
    setProjectMeetings(meetings);
    setMeetingsStore(meetings.map(mapMeetingToStore));
    setChangesStore(changes.map(mapChangeToStore));
  };

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const handleRealtimeRefresh = async (event: Event) => {
      const customEvent = event as CustomEvent<{ projectId?: string }>;
      if (customEvent.detail?.projectId !== projectId) {
        return;
      }

      try {
        await refreshProjectMeetings();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to refresh realtime data');
      }
    };

    window.addEventListener('project-realtime-refresh', handleRealtimeRefresh);
    return () => window.removeEventListener('project-realtime-refresh', handleRealtimeRefresh);
  }, [projectId, refreshProjectMeetings]);

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
      await refreshProjectMeetings();
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
      await refreshProjectMeetings();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove meeting');
    } finally {
      setIsUpdatingMeeting(false);
    }
  };

  useEffect(() => {
    if (!projectId || activeTab !== 'decisions') {
      return;
    }

    const approvedMeetingsLoadKey = getApprovedMeetingsLoadKey(projectMeetings);
    if (decisionsLoadKeyRef.current === approvedMeetingsLoadKey) {
      return;
    }

    decisionsLoadKeyRef.current = approvedMeetingsLoadKey;

    let isMounted = true;

    const loadDecisions = async () => {
      try {
        if (!isMounted) return;
        await loadProjectDecisions(projectMeetings);
      } catch (error) {
        console.error('[Decisions] Error in loadDecisions:', error);
      }
    };

    void loadDecisions();

    return () => {
      isMounted = false;
    };
  }, [activeTab, projectId, projectMeetings]);

  useEffect(() => {
    decisionsLoadKeyRef.current = null;
  }, [projectId]);

  useEffect(() => {
    attemptedProjectLoadRef.current = null;
    setProjectLoadFailed(false);
  }, [projectId]);

  const retryLoadProject = () => {
    attemptedProjectLoadRef.current = null;
    setProjectLoadFailed(false);
  };

  // On hard reload the in-memory store is empty, so hydrate from backend once.
  useEffect(() => {
    if (!projectId || project || attemptedProjectLoadRef.current === projectId) {
      return;
    }

    attemptedProjectLoadRef.current = projectId;

    let isMounted = true;

    const loadProjects = async () => {
      setIsLoadingProject(true);
      setProjectLoadFailed(false);

      try {
        const userProjects = await apiService.getUserProjects();
        if (!isMounted) return;

        const convertedProjects = userProjects.map(mapProjectResponseToProject);
        setProjects(convertedProjects);

        const exists = convertedProjects.some((p) => p.id === projectId);
        if (!exists) {
          setProjectLoadFailed(true);
        }
      } catch (error) {
        if (!isMounted) return;
        setProjectLoadFailed(true);
        toast.error(error instanceof Error ? error.message : 'Failed to load project');
      } finally {
        if (isMounted) {
          setIsLoadingProject(false);
        }
      }
    };

    void loadProjects();

    return () => {
      isMounted = false;
    };
  }, [projectId, project, setProjects]);

  // Enable real-time board updates via WebSocket
  const boardId = project?.boardId || null;
  useWebSocketBoardUpdates(boardId, projectId);

  if (isLoadingProject) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading project...</h2>
      </div>
    );
  }
  
  if (!project && projectLoadFailed) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" onClick={retryLoadProject}>Retry loading project</Button>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading project...</h2>
      </div>
    );
  }

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
  const sortedMeetings = [...projectMeetings].sort((a, b) => {
    return getMeetingSortValue(b.meetingDate, b.meetingTime) - getMeetingSortValue(a.meetingDate, a.meetingTime);
  });

  const statusConfig = {
    'scheduled': { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    'in-progress': { label: 'In Progress', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    'pending-approval': { label: 'Pending Approval', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    'approved': { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200' },
    'rejected': { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden pt-16">
      {/* Tabs Header - Fixed at top, doesn't scroll horizontally */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 z-30">
        <div className="px-6 md:px-12">
          <div className="flex items-center justify-between py-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-sm text-gray-600 mt-1">{project.description}</p>
            </div>
          </div>
          
          <div className="flex gap-1 -mb-px">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'board'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setActiveTab('meetings')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'meetings'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Meetings
              {projectMeetings.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                  {projectMeetings.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('decisions')}
              className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                activeTab === 'decisions'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              Decisions
              {project.decisions.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full">
                  {project.decisions.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content - Scrolls independently */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'board' ? (
          <div className="h-full">
            <KanbanBoard />
          </div>
        ) : activeTab === 'decisions' ? (
          <div className="px-4 md:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              {/* Decisions Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Project Decisions</h2>
                  <p className="text-gray-600">Key decisions made during meetings and approvals</p>
                </div>
              </div>

              {/* Decisions List */}
              {project.decisions.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No decisions yet</h3>
                  <p className="text-gray-600">Decisions from approved meetings will appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.decisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {decision.description}
                            </h3>
                          </div>
                          
                          {/* Metadata */}
                          <div className="space-y-2 text-sm">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  From meeting: <span className="font-medium text-gray-900">{decision.meetingTitle}</span>
                                </span>
                              </div>
                              
                              {decision.approvedBy && (
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Clock className="w-4 h-4" />
                                  <span>
                                    Approved by: <span className="font-medium text-gray-900">
                                      {decision.approvedBy}
                                    </span>
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/meetings/${decision.meetingId}`)}
                        >
                          View Meeting
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 md:px-8 py-12">
            <div className="max-w-7xl mx-auto">
              {/* Meetings Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-2">Project Meetings</h2>
                  <p className="text-gray-600">Manage meeting summaries and approvals for this project</p>
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
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No meetings yet</h3>
                  <p className="text-gray-600">Get started by creating your first meeting for this project</p>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                  {sortedMeetings.map((meeting) => {
                    const normalizedStatus = normalizeMeetingStatusLabel(meeting.status);
                    const statusInfo = statusConfig[normalizedStatus];

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
                          
                          <Badge variant="outline" className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
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
                          {(() => {
                            const meetingChanges = allChanges.filter(c => c.meetingId === meeting.id);
                            return meetingChanges.length > 0 ? (
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
                                Changes ({meetingChanges.length})
                              </Button>
                            ) : null;
                          })()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Change Detail Modal */}
      <ChangeDetailModal
        change={selectedChange}
        open={!!selectedChange}
        onClose={() => setSelectedChange(null)}
      />

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