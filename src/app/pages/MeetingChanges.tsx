import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { type ChangeRequest } from '../store/changeStore';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ChangeDetailModal } from '../components/ChangeDetailModal';
import { ArrowLeft } from 'lucide-react';
import { useProjectStore } from '../store/projectStore';
import { apiService, mapProjectResponseToProject, type MeetingResponse, type ProjectResponse } from '../services/api';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';

const changeTypeConfig: Record<string, { label: string; color: string }> = {
  MOVE_CARD: { label: 'Move Card', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  UPDATE_CARD: { label: 'Update Card', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  CREATE_CARD: { label: 'Create Card', color: 'bg-green-50 text-green-700 border-green-200' },
  DELETE_CARD: { label: 'Delete Card', color: 'bg-red-50 text-red-700 border-red-200' },
};

const MEETING_CHANGES_SYNC_INTERVAL_MS = 5000;

export function MeetingChanges() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
  const [changes, setChanges] = useState<ChangeRequest[]>([]);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [applyingChangeId, setApplyingChangeId] = useState<string | null>(null);
  const [appliedSuccessChangeId, setAppliedSuccessChangeId] = useState<string | null>(null);
  const [canApplyChanges, setCanApplyChanges] = useState(false);
  const [currentProject, setCurrentProject] = useState<ProjectResponse | null>(null);
  const setProjects = useProjectStore((s) => s.setProjects);

  const getApplyErrorMessage = (error: unknown) => {
    const raw = error instanceof Error ? error.message : 'Failed to apply change to board';
    const normalized = raw.toLowerCase();

    if (normalized.includes('card not found') || normalized.includes('could not resolve card')) {
      return 'This change references a card that no longer exists. Regenerate the summary to refresh stale changes.';
    }

    if (normalized.includes('stage not found') || normalized.includes('could not resolve stage')) {
      return 'This change references a column that no longer exists. Regenerate the summary to refresh stale changes.';
    }

    return raw;
  };

  const refreshMeetingChanges = useCallback(async (activeMeetingId: string) => {
    const [meetingData, changeData] = await Promise.all([
      apiService.getMeeting(activeMeetingId),
      apiService.listChanges({ meetingId: activeMeetingId }),
    ]);

    setMeeting(meetingData);
    setChanges(
      changeData.map((c) => {
        let before: any;
        let after: any;

        try {
          before = c.beforeState ? JSON.parse(c.beforeState) : undefined;
        } catch {
          before = undefined;
        }

        try {
          after = c.afterState ? JSON.parse(c.afterState) : undefined;
        } catch {
          after = undefined;
        }

        return {
          id: c.id,
          meetingId: c.meetingId,
          meetingTitle: meetingData.title,
          type: c.changeType as ChangeRequest['type'],
          status: c.status as ChangeRequest['status'],
          requestedBy: 'system',
          requestedAt: c.createdAt,
          projectId: meetingData.projectId,
          before,
          after,
          affectedCards: [],
          affectedStages: [],
          affectedMembers: [],
          riskLevel: 'LOW',
          approvals: [],
          requiredApprovals: 0,
          rollbackAvailable: false,
        };
      })
    );
  }, []);

  const refreshProjectBoardState = useCallback(async (projectId: string) => {
    const [allProjects, refreshedProject] = await Promise.all([
      apiService.getUserProjects(),
      apiService.getProject(projectId),
    ]);

    const mergedProjects = allProjects.map((project) =>
      project.id === projectId ? refreshedProject : project
    );

    setCurrentProject(refreshedProject);
    setProjects(mergedProjects.map(mapProjectResponseToProject));
  }, [setProjects]);

  const loadMeetingChangesData = useCallback(async ({ showErrorToast = false }: { showErrorToast?: boolean } = {}) => {
    if (!meetingId) return;

    try {
      const [meetingData, changeData] = await Promise.all([
        apiService.getMeeting(meetingId),
        apiService.listChanges({ meetingId }),
      ]);

      setMeeting(meetingData);
      const storedUser = localStorage.getItem('user');
      const currentUserId = storedUser ? JSON.parse(storedUser)?.id : null;
      const projectData = await apiService.getProject(meetingData.projectId);
      setCurrentProject(projectData);
      const owner = projectData.members.find((member) => member.role.toLowerCase() === 'owner');
      setCanApplyChanges(Boolean(currentUserId && owner?.id === currentUserId));
      setChanges(
        changeData.map((c) => {
          let before: any;
          let after: any;

          try {
            before = c.beforeState ? JSON.parse(c.beforeState) : undefined;
          } catch {
            before = undefined;
          }

          try {
            after = c.afterState ? JSON.parse(c.afterState) : undefined;
          } catch {
            after = undefined;
          }

          return {
            id: c.id,
            meetingId: c.meetingId,
            meetingTitle: meetingData.title,
            type: c.changeType as ChangeRequest['type'],
            status: c.status as ChangeRequest['status'],
            requestedBy: 'system',
            requestedAt: c.createdAt,
            projectId: meetingData.projectId,
            before,
            after,
            affectedCards: [],
            affectedStages: [],
            affectedMembers: [],
            riskLevel: 'LOW',
            approvals: [],
            requiredApprovals: 0,
            rollbackAvailable: false,
          };
        })
      );
    } catch (error) {
      if (showErrorToast) {
        toast.error(error instanceof Error ? error.message : 'Failed to load meeting changes');
      }
    }
  }, [meetingId]);

  const getTargetCardId = (change: ChangeRequest) => {
    const beforeId = change.before && typeof change.before === 'object' ? (change.before as any).id : undefined;
    const afterId = change.after && typeof change.after === 'object' ? (change.after as any).id : undefined;
    const id = afterId || beforeId;
    return typeof id === 'string' ? id : null;
  };

  const hasMissingTargetCard = (change: ChangeRequest) => {
    if (change.type === 'CREATE_CARD') {
      return false;
    }

    const cardId = getTargetCardId(change);
    if (!cardId || !currentProject) {
      return false;
    }

    return !currentProject.tasks.some((task) => task.id === cardId);
  };

  useEffect(() => {
    if (!meetingId) return;

    let isCancelled = false;

    void loadMeetingChangesData({ showErrorToast: true });

    const syncIfActive = () => {
      if (isCancelled || document.visibilityState !== 'visible') {
        return;
      }

      void loadMeetingChangesData();
    };

    const intervalId = window.setInterval(syncIfActive, MEETING_CHANGES_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncIfActive);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', syncIfActive);
    };
  }, [meetingId, loadMeetingChangesData]);

  const handleApplyToBoard = async (changeId: string) => {
    if (!meetingId || !meeting?.projectId) return;

    const targetChange = changes.find((change) => change.id === changeId);
    if (targetChange && hasMissingTargetCard(targetChange)) {
      toast.error('Cannot apply this change because its target card no longer exists. Regenerate changes first.');
      return;
    }

    setApplyingChangeId(changeId);
    setAppliedSuccessChangeId(null);
    try {
      const result = await apiService.applyChange(changeId);
      await Promise.all([
        refreshMeetingChanges(meetingId),
        refreshProjectBoardState(meeting.projectId),
      ]);
      setAppliedSuccessChangeId(changeId);

      toast.success(result.message || 'Change applied to board');
    } catch (error) {
      toast.error(getApplyErrorMessage(error));
    } finally {
      setApplyingChangeId(null);
    }
  };

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
        const from = (change.before as any)?.columnTitle || (change.before as any)?.stageTitle || 'previous column';
        const to = (change.after as any)?.columnTitle || (change.after as any)?.stageTitle || 'new column';
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
            onClick={() => navigate(`/meetings/${meeting.id}`)}
            className="mb-4 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meeting Details
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
              const staleTarget = hasMissingTargetCard(change);
              
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
                        {change.status === 'APPLIED' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Applied
                          </Badge>
                        )}
                        {staleTarget && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                            Target missing
                          </Badge>
                        )}
                      </div>
                      <p className="text-gray-900">
                        {getChangeDescription(change)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleApplyToBoard(change.id);
                      }}
                      disabled={!canApplyChanges || change.status === 'APPLIED' || applyingChangeId === change.id || staleTarget}
                    >
                      {change.status === 'APPLIED' || appliedSuccessChangeId === change.id
                        ? 'Applied'
                        : applyingChangeId === change.id
                        ? 'Applying...'
                        : staleTarget
                        ? 'Stale Target'
                        : canApplyChanges
                        ? 'Apply to Board'
                        : 'Read Only'}
                    </Button>
                  </div>
                  {staleTarget && change.status !== 'APPLIED' && (
                    <p className="mt-3 text-sm text-amber-700">
                      This change references a card that no longer exists.
                    </p>
                  )}
                  {appliedSuccessChangeId === change.id && (
                    <p className="mt-3 text-sm text-green-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Apply request completed successfully.
                    </p>
                  )}
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