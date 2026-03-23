import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { type ChangeRequest } from '../store/changeStore';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { ChangeDetailModal } from '../components/ChangeDetailModal';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Pencil,
  ListChecks,
} from 'lucide-react';
import {
  apiService,
  type MeetingResponse,
  type MeetingSummaryResponse,
  type ApprovalStatusResponse,
} from '../services/api';
import { formatMeetingDate, formatMeetingTime } from '../utils/meetingDateTime';

const statusConfig: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  PENDING_APPROVAL: { label: 'Pending Approval', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  APPROVED: { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
};

const MEETING_SUMMARY_SYNC_INTERVAL_MS = 5000;

export function MeetingSummary() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState<MeetingResponse | null>(null);
  const [summary, setSummary] = useState<MeetingSummaryResponse | null>(null);
  const [approval, setApproval] = useState<ApprovalStatusResponse | null>(null);
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvingItemId, setApprovingItemId] = useState<string | null>(null);
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null);
  const [showActionEditor, setShowActionEditor] = useState(false);
  const [showDecisionEditor, setShowDecisionEditor] = useState(false);
  const [actionDescription, setActionDescription] = useState('');
  const [actionSourceContext, setActionSourceContext] = useState('');
  const [actionPriority, setActionPriority] = useState('MEDIUM');
  const [decisionDescription, setDecisionDescription] = useState('');
  const [decisionSourceContext, setDecisionSourceContext] = useState('');
  const [decisionImpactSummary, setDecisionImpactSummary] = useState('');
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isProjectOwner, setIsProjectOwner] = useState(false);

  const reloadSummaryAndApproval = useCallback(async (id: string) => {
    const [summaryData, approvalData] = await Promise.all([
      apiService.getSummaryByMeeting(id),
      apiService.getApprovalStatus(id),
    ]);
    setSummary(summaryData);
    setApproval(approvalData);
  }, []);

  const loadMeetingSummaryData = useCallback(
    async ({ showErrorToast = false }: { showErrorToast?: boolean } = {}) => {
      if (!meetingId) return;

      const storedUser = localStorage.getItem('user');
      let resolvedUserId: string | null = null;
      if (storedUser) {
        try {
          resolvedUserId = JSON.parse(storedUser)?.id ?? null;
          setCurrentUserId(resolvedUserId);
        } catch {
          resolvedUserId = null;
          setCurrentUserId(null);
        }
      }

      try {
        const [meetingData, summaryData, approvalData] = await Promise.all([
          apiService.getMeeting(meetingId),
          apiService.getSummaryByMeeting(meetingId),
          apiService.getApprovalStatus(meetingId),
        ]);

        let owner = false;
        if (resolvedUserId && meetingData.projectId) {
          try {
            const members = await apiService.getProjectMembers(meetingData.projectId);
            const currentMember = members.find((member: any) => {
              const memberId = member.id || member.userId;
              return typeof memberId === 'string' && memberId === resolvedUserId;
            });
            owner = (currentMember?.role || '').toLowerCase() === 'owner';
          } catch {
            owner = false;
          }
        }

        setMeeting(meetingData);
        setSummary(summaryData);
        setApproval(approvalData);
        setIsProjectOwner(owner);
      } catch (error) {
        if (showErrorToast) {
          toast.error(error instanceof Error ? error.message : 'Failed to load meeting summary');
        }
      }
    },
    [meetingId],
  );

  useEffect(() => {
    if (!meetingId) return;

    let isCancelled = false;

    void loadMeetingSummaryData({ showErrorToast: true });

    const syncIfActive = () => {
      if (isCancelled || document.visibilityState !== 'visible') {
        return;
      }

      void loadMeetingSummaryData();
    };

    const intervalId = window.setInterval(syncIfActive, MEETING_SUMMARY_SYNC_INTERVAL_MS);
    document.addEventListener('visibilitychange', syncIfActive);

    return () => {
      isCancelled = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', syncIfActive);
    };
  }, [meetingId, loadMeetingSummaryData]);

  const changeRequests = useMemo<ChangeRequest[]>(() => {
    if (!summary || !meeting) return [];

    return (summary.changes || []).map((c) => {
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
        meetingTitle: meeting.title,
        type: c.changeType as ChangeRequest['type'],
        status: c.status as ChangeRequest['status'],
        requestedBy: 'system',
        requestedAt: c.createdAt,
        projectId: meeting.projectId,
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
    });
  }, [summary, meeting]);

  if (!meeting) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting not found</h2>
        <Button onClick={() => navigate('/meetings')}>Back to Meetings</Button>
      </div>
    );
  }

  const statusInfo = statusConfig[meeting.status] || statusConfig.SCHEDULED;

  const submitDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!meetingId) return;

    setIsSubmitting(true);
    try {
      await apiService.submitSummaryApproval(meetingId, decision, comments || undefined);
      toast.success(decision === 'APPROVED' ? 'Summary approved' : 'Changes requested');

      const [meetingData, approvalData] = await Promise.all([
        apiService.getMeeting(meetingId),
        apiService.getApprovalStatus(meetingId),
      ]);
      setMeeting(meetingData);
      setApproval(approvalData);
      const refreshedSummary = await apiService.getSummaryByMeeting(meetingId);
      setSummary(refreshedSummary);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit approval');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveItem = async (itemId: string, itemType: 'action' | 'decision') => {
    if (!meetingId) return;

    setApprovingItemId(itemId);
    try {
      if (itemType === 'action') {
        await apiService.approveActionItem(itemId);
      } else {
        await apiService.approveDecisionItem(itemId);
      }

      await reloadSummaryAndApproval(meetingId);
      toast.success('Item approved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve item');
    } finally {
      setApprovingItemId(null);
    }
  };

  const resetActionEditor = () => {
    setEditingActionId(null);
    setShowActionEditor(false);
    setActionDescription('');
    setActionSourceContext('');
    setActionPriority('MEDIUM');
  };

  const resetDecisionEditor = () => {
    setEditingDecisionId(null);
    setShowDecisionEditor(false);
    setDecisionDescription('');
    setDecisionSourceContext('');
    setDecisionImpactSummary('');
  };

  const saveActionItem = async () => {
    if (!meetingId || !actionDescription.trim()) return;

    setIsSavingItem(true);
    try {
      const nextSummary = editingActionId
        ? await apiService.updateActionItem(editingActionId, {
            description: actionDescription.trim(),
            sourceContext: actionSourceContext.trim() || undefined,
            priority: actionPriority,
          })
        : await apiService.addActionItem(meetingId, {
            description: actionDescription.trim(),
            sourceContext: actionSourceContext.trim() || undefined,
            priority: actionPriority,
          });
      setSummary(nextSummary);
      resetActionEditor();
      toast.success(editingActionId ? 'Action item updated' : 'Action item added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save action item');
    } finally {
      setIsSavingItem(false);
    }
  };

  const removeActionItem = async (itemId: string) => {
    setIsSavingItem(true);
    try {
      const nextSummary = await apiService.deleteActionItem(itemId);
      setSummary(nextSummary);
      toast.success('Action item removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove action item');
    } finally {
      setIsSavingItem(false);
    }
  };

  const saveDecisionItem = async () => {
    if (!meetingId || !decisionDescription.trim()) return;

    setIsSavingItem(true);
    try {
      const nextSummary = editingDecisionId
        ? await apiService.updateDecision(editingDecisionId, {
            description: decisionDescription.trim(),
            sourceContext: decisionSourceContext.trim() || undefined,
            impactSummary: decisionImpactSummary.trim() || undefined,
          })
        : await apiService.addDecision(meetingId, {
            description: decisionDescription.trim(),
            sourceContext: decisionSourceContext.trim() || undefined,
            impactSummary: decisionImpactSummary.trim() || undefined,
          });
      setSummary(nextSummary);
      resetDecisionEditor();
      toast.success(editingDecisionId ? 'Decision updated' : 'Decision added');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save decision');
    } finally {
      setIsSavingItem(false);
    }
  };

  const removeDecisionItem = async (itemId: string) => {
    setIsSavingItem(true);
    try {
      const nextSummary = await apiService.deleteDecision(itemId);
      setSummary(nextSummary);
      toast.success('Decision removed');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove decision');
    } finally {
      setIsSavingItem(false);
    }
  };

  const currentUserApproval = (approval?.responses || []).find((r) => r.userId === currentUserId && r.response !== 'PENDING');
  const hasSubmittedSummaryDecision = Boolean(currentUserApproval);
  const hasAnyApprovedSummaryDecision = (approval?.currentApprovedCount || 0) > 0;
  const isMeetingFinalized = meeting.status === 'APPROVED' || meeting.status === 'REJECTED';
  const isItemEditingDisabled = isMeetingFinalized || hasSubmittedSummaryDecision;
  const canEditOrDeleteItems = isProjectOwner && !isItemEditingDisabled;
  const isAddDisabled = isItemEditingDisabled || hasAnyApprovedSummaryDecision;

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="-ml-2" onClick={() => navigate(`/project/${meeting.projectId}?tab=meetings`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meetings
          </Button>
          <Button variant="outline" onClick={() => navigate(`/project/${meeting.projectId}?tab=decisions`)}>
            Go to Decisions
          </Button>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
              <p className="text-sm text-gray-600 mt-1">Project: {meeting.projectName || 'N/A'}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                <div className="flex items-center gap-1"><Calendar className="w-4 h-4" />{formatMeetingDate(meeting.meetingDate)}</div>
                <div className="flex items-center gap-1"><Clock className="w-4 h-4" />{formatMeetingTime(meeting.meetingTime)}</div>
              </div>
            </div>
            <Badge variant="outline" className={statusInfo.color}>{statusInfo.label}</Badge>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Decisions</h2>
              <Button
                size="sm"
                variant="outline"
                disabled={isAddDisabled}
                onClick={() => {
                  setEditingDecisionId(null);
                  setDecisionDescription('');
                  setDecisionSourceContext('');
                  setDecisionImpactSummary('');
                  setShowDecisionEditor(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {showDecisionEditor && (
              <div className="mb-3 border rounded-lg p-3 bg-gray-50 space-y-2">
                <Input placeholder="Decision description" value={decisionDescription} onChange={(e) => setDecisionDescription(e.target.value)} />
                <Input placeholder="Source context (optional)" value={decisionSourceContext} onChange={(e) => setDecisionSourceContext(e.target.value)} />
                <Input placeholder="Impact summary (optional)" value={decisionImpactSummary} onChange={(e) => setDecisionImpactSummary(e.target.value)} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveDecisionItem} disabled={isSavingItem || !decisionDescription.trim() || isAddDisabled}>Save</Button>
                  <Button size="sm" variant="outline" onClick={resetDecisionEditor}>Cancel</Button>
                </div>
              </div>
            )}
            <ul className="space-y-2 text-sm text-gray-700">
              {(summary?.decisions || []).map((d) => (
                <li key={d.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p>{d.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Approval: {d.approvalStatus || 'PENDING'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(d.approvalStatus || 'PENDING') === 'APPROVED' || approvingItemId === d.id || hasSubmittedSummaryDecision}
                      onClick={() => approveItem(d.id, 'decision')}
                    >
                      {(d.approvalStatus || 'PENDING') === 'APPROVED' ? 'Approved' : 'Approve'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!canEditOrDeleteItems}
                      onClick={() => {
                        setEditingDecisionId(d.id);
                        setDecisionDescription(d.description || '');
                        setDecisionSourceContext(d.sourceContext || '');
                        setDecisionImpactSummary('');
                        setShowDecisionEditor(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={!canEditOrDeleteItems || isSavingItem} onClick={() => removeDecisionItem(d.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </li>
              ))}
              {(summary?.decisions || []).length === 0 && <li className="text-gray-500">No decisions yet</li>}
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-900">Action Items</h2>
              <Button
                size="sm"
                variant="outline"
                disabled={isAddDisabled}
                onClick={() => {
                  setEditingActionId(null);
                  setActionDescription('');
                  setActionSourceContext('');
                  setActionPriority('MEDIUM');
                  setShowActionEditor(true);
                }}
              >
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
            {showActionEditor && (
              <div className="mb-3 border rounded-lg p-3 bg-gray-50 space-y-2">
                <Input placeholder="Action item description" value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} />
                <Input placeholder="Source context (optional)" value={actionSourceContext} onChange={(e) => setActionSourceContext(e.target.value)} />
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={actionPriority}
                  onChange={(e) => setActionPriority(e.target.value)}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="CRITICAL">CRITICAL</option>
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveActionItem} disabled={isSavingItem || !actionDescription.trim() || isAddDisabled}>Save</Button>
                  <Button size="sm" variant="outline" onClick={resetActionEditor}>Cancel</Button>
                </div>
              </div>
            )}
            <ul className="space-y-2 text-sm text-gray-700">
              {(summary?.actionItems || []).map((a) => (
                <li key={a.id} className="border rounded-lg p-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p>{a.description}</p>
                    <p className="text-xs text-gray-500 mt-1">Approval: {a.approvalStatus || 'PENDING'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={(a.approvalStatus || 'PENDING') === 'APPROVED' || approvingItemId === a.id || hasSubmittedSummaryDecision}
                      onClick={() => approveItem(a.id, 'action')}
                    >
                      {(a.approvalStatus || 'PENDING') === 'APPROVED' ? 'Approved' : 'Approve'}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={!canEditOrDeleteItems}
                      onClick={() => {
                        setEditingActionId(a.id);
                        setActionDescription(a.description || '');
                        setActionSourceContext(a.sourceContext || '');
                        setActionPriority('MEDIUM');
                        setShowActionEditor(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" disabled={!canEditOrDeleteItems || isSavingItem} onClick={() => removeActionItem(a.id)}>
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </li>
              ))}
              {(summary?.actionItems || []).length === 0 && <li className="text-gray-500">No action items yet</li>}
            </ul>
            <p className="text-xs text-gray-500 mt-3">Only the project owner can edit or delete existing items. Adding new items is disabled once summary approval starts.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">AI Summary</h2>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-gray-200 p-4 bg-gray-50 text-sm whitespace-pre-wrap">
            {summary?.aiGeneratedContent || 'No summary generated yet.'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Changes</h2>
            <Button size="sm" variant="outline" onClick={() => navigate(`/meetings/${meetingId}/changes`)}>
              <ListChecks className="w-4 h-4 mr-2" />
              Review Changes
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            {changeRequests.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left border rounded-lg p-3 hover:bg-gray-50"
                onClick={() => setSelectedChange(c)}
              >
                {c.type.replace(/_/g, ' ')}
              </button>
            ))}
            {changeRequests.length === 0 && <p className="text-gray-500">No changes yet</p>}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Approvals</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {(approval?.responses || []).map((r) => (
              <div key={r.userId} className="px-3 py-2 rounded-lg border bg-gray-50 text-sm">
                {r.userName}: {r.response}
              </div>
            ))}
            {(approval?.responses || []).length === 0 && <p className="text-gray-500 text-sm">No approvals submitted yet</p>}
          </div>

          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Optional comments"
            className="mb-3"
            disabled={hasSubmittedSummaryDecision}
          />

          {hasSubmittedSummaryDecision && (
            <p className="text-sm text-gray-600 mb-3">
              You already responded: <span className="font-medium">{currentUserApproval?.response}</span>
            </p>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-red-300 text-red-700"
              onClick={() => submitDecision('REJECTED')}
              disabled={isSubmitting || hasSubmittedSummaryDecision}
            >
              <XCircle className="w-4 h-4 mr-2" /> Request Changes
            </Button>
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => submitDecision('APPROVED')}
              disabled={isSubmitting || hasSubmittedSummaryDecision}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Approve Summary
            </Button>
          </div>
        </div>
      </div>

      <ChangeDetailModal change={selectedChange} open={!!selectedChange} onClose={() => setSelectedChange(null)} />
    </div>
  );
}
