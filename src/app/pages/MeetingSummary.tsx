import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useMeetingStore } from '../store/meetingStore';
import { useChangeStore, type ChangeRequest } from '../store/changeStore';
import { useProjectStore, type ProjectDecision, type BoardTask } from '../store/projectStore';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { ChangeDetailModal } from '../components/ChangeDetailModal';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  FileText,
  CheckCircle2,
  XCircle,
  ListChecks,
  AlertCircle,
  Sparkles,
  User,
  Plus,
  Trash2,
} from 'lucide-react';

const statusConfig = {
  'scheduled': { label: 'Scheduled', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  'in-progress': { label: 'In Progress', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Sparkles },
  'pending-approval': { label: 'Pending Approval', color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: AlertCircle },
  'approved': { label: 'Approved', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  'rejected': { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

function CollapsibleItemList({ items, onRemove, onItemClick }: { items: any[]; onRemove?: (id: string) => void; onItemClick?: (item: any) => void }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No items
      </div>
    );
  }

  // Helper function to get description from various item types
  const getItemDescription = (item: any) => {
    // For ChangeRequest objects
    if (item.type) {
      const taskData = (item.after || item.before) as any;
      const taskTitle = taskData?.title || 'Unknown task';
      
      switch (item.type) {
        case 'CREATE_CARD':
          return `Create new card: ${taskTitle}`;
        case 'UPDATE_CARD':
          return `Update card: ${taskTitle}`;
        case 'MOVE_CARD':
          const fromCol = (item.before as any)?.columnId || 'Unknown';
          const toCol = (item.after as any)?.columnId || 'Unknown';
          return `Move ${taskTitle} from ${fromCol} to ${toCol}`;
        case 'DELETE_CARD':
          return `Delete card: ${taskTitle}`;
        default:
          return item.type.replace(/_/g, ' ');
      }
    }
    
    // For regular items with description
    return item.description || item.title || 'No description';
  };

  return (
    <div className="space-y-2">
      {items.map((item: any) => (
        <div 
          key={item.id} 
          className={`border border-gray-200 rounded-lg p-3 transition-colors ${
            onItemClick ? 'hover:bg-gray-50 cursor-pointer' : 'hover:bg-gray-50'
          }`}
          onClick={() => onItemClick?.(item)}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm text-gray-900 flex-1">{getItemDescription(item)}</p>
            {onRemove && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item.id);
                }}
                className="text-red-500 hover:text-red-700 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          {item.sourceContext && (
            <p className="text-xs text-gray-500 mt-1">{item.sourceContext}</p>
          )}
          {item.comment && (
            <p className="text-xs text-blue-600 mt-1 italic">{item.comment}</p>
          )}
        </div>
      ))}
    </div>
  );
}

export function MeetingSummary() {
  const { meetingId } = useParams<{ meetingId: string }>();
  const navigate = useNavigate();
  const meeting = useMeetingStore((s) => s.meetings.find((m) => m.id === meetingId));
  const submitApproval = useMeetingStore((s) => s.submitApproval);
  const addOtherNote = useMeetingStore((s) => s.addOtherNote);
  const removeOtherNote = useMeetingStore((s) => s.removeOtherNote);
  const allChanges = useChangeStore((s) => s.changes);
  const addChange = useChangeStore((s) => s.addChange);
  const addDecision = useProjectStore((s) => s.addDecision);
  const addTask = useProjectStore((s) => s.addTask);
  const projects = useProjectStore((s) => s.projects);

  const [approvalComments, setApprovalComments] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);

  if (!meeting) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Meeting not found</h2>
        <Button onClick={() => navigate('/meetings')}>Back to Meetings</Button>
      </div>
    );
  }

  const statusInfo = statusConfig[meeting.status];
  const StatusIcon = statusInfo.icon;
  const readOnly = meeting.userHasApproved || meeting.status === 'approved';
  
  // Get changes from the changeStore that are associated with this meeting
  const changeRequests = allChanges.filter((c) => c.meetingId === meeting.id);
  const pendingChangesCount = changeRequests.length;

  const handleBack = () => {
    if (meeting.projectId) {
      navigate(`/project/${meeting.projectId}`);
    } else {
      navigate('/meetings');
    }
  };

  const handleSubmitApproval = (action: 'approved' | 'rejected') => {
    if (meeting) {
      submitApproval(meeting.id, action, approvalComments);
      
      // If this is the final approval, process the meeting outcomes
      if (action === 'approved') {
        const updatedApprovals = meeting.approvals.map((approval) =>
          approval.userId === 'u1'
            ? { ...approval, status: 'approved' as const }
            : approval
        );
        
        const approvedCount = updatedApprovals.filter((a) => a.status === 'approved').length;
        
        // Check if this approval completes the meeting
        if (approvedCount === meeting.totalApprovers) {
          processMeetingApproval(meeting);
          toast.success('Meeting approved! Action items, decisions, and changes have been processed.');
        } else {
          toast.success('Meeting summary approved successfully');
        }
      } else {
        toast.success('Changes requested for meeting summary');
      }
    }
  };
  
  const processMeetingApproval = (approvedMeeting: typeof meeting) => {
    if (!approvedMeeting) return;
    
    const project = projects.find((p) => p.id === approvedMeeting.projectId);
    if (!project) return;
    
    // Add decisions to the project
    approvedMeeting.decisions.forEach((decision) => {
      const projectDecision: ProjectDecision = {
        id: `dec-${decision.id}-${Date.now()}`,
        description: decision.description,
        meetingId: approvedMeeting.id,
        meetingTitle: approvedMeeting.title,
        sourceContext: decision.sourceContext,
        approvedAt: new Date().toISOString(),
        approvedBy: 'Meeting Approval',
      };
      
      addDecision(approvedMeeting.projectId, projectDecision);
    });
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={handleBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {meeting.projectId ? 'Back to Project' : 'Back to Meetings'}
          </Button>
        </div>

        {/* Meeting Header Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <div className="flex items-start gap-3">
            <StatusIcon className="w-6 h-6 text-gray-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h1 className="text-2xl font-bold text-gray-900">{meeting.title}</h1>
                <Badge variant="outline" className={statusInfo.color}>
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(meeting.date).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  {meeting.time}
                </div>
              </div>
              {/* Purpose Statement */}
              {!readOnly && (
                <p className="text-sm text-gray-600 border-t pt-3 mt-3">
                  Please review the decisions, changes, and action items below before approving.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Approval Status - Horizontal */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 text-sm">Approval Status</h3>
            {pendingChangesCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/meetings/${meetingId}/changes`)}
                className="gap-2"
              >
                <ListChecks className="w-4 h-4" />
                Review Board Changes
                <Badge variant="outline" className="ml-1 bg-blue-50 text-blue-700 border-blue-200">
                  {pendingChangesCount}
                </Badge>
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {meeting.approvals.map((approval) => (
              <div
                key={approval.userId}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
                  approval.status === 'approved'
                    ? 'bg-green-50 border-green-200'
                    : approval.status === 'rejected'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                {approval.status === 'approved' && (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                )}
                {approval.status === 'rejected' && (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                )}
                {approval.status === 'pending' && (
                  <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                )}
                <span className="text-sm text-gray-900">{approval.userName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Review Sections - 2x2 Grid */}
        <div className="grid lg:grid-cols-2 gap-4 mb-4">
          {/* 1. Decisions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Decisions</h2>
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                {meeting.decisions.length}
              </Badge>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <CollapsibleItemList items={meeting.decisions} />
            </div>
          </div>

          {/* 2. Changes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Changes</h2>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                {pendingChangesCount}
              </Badge>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <CollapsibleItemList 
                items={changeRequests} 
                onItemClick={(change) => setSelectedChange(change)}
              />
            </div>
          </div>

          {/* 3. Action Items */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Action Items</h2>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {meeting.actionItems.length}
              </Badge>
            </div>
            <div className="max-h-[280px] overflow-y-auto">
              <CollapsibleItemList items={meeting.actionItems} />
            </div>
          </div>

          {/* 4. Other Notes */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Other Notes</h2>
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {meeting.otherNotes.length}
              </Badge>
            </div>
            <div className="max-h-[280px] overflow-y-auto space-y-3">
              {meeting.otherNotes.length > 0 && (
                <CollapsibleItemList
                  items={meeting.otherNotes}
                  onRemove={!readOnly ? (noteId) => removeOtherNote(meeting.id, noteId) : undefined}
                />
              )}
              {!readOnly && (
                <div className="space-y-2">
                  <Input
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="Add a new note"
                    className="w-full"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newNoteText.trim()) {
                        addOtherNote(meeting.id, newNoteText);
                        setNewNoteText('');
                      }
                    }}
                  />
                  <Button
                    onClick={() => {
                      if (newNoteText.trim()) {
                        addOtherNote(meeting.id, newNoteText);
                        setNewNoteText('');
                        toast.success('Note added');
                      }
                    }}
                    size="sm"
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              )}
              {meeting.otherNotes.length === 0 && readOnly && (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No additional notes
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Final Decision Zone - Compact */}
        {!readOnly && (
          <div className="bg-gradient-to-b from-gray-50 to-white rounded-xl border-2 border-gray-300 p-4 shadow-lg">
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSubmitApproval('rejected')}
                className="flex-1 border-red-300 text-red-700 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4 mr-2" />
                Request Changes
              </Button>
              <Button
                onClick={() => handleSubmitApproval('approved')}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 font-semibold"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve Meeting Summary
              </Button>
            </div>
          </div>
        )}

        {/* Show approval feedback if already approved */}
        {readOnly && meeting.approvalComments && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Your Feedback</h3>
            <p className="text-gray-700">{meeting.approvalComments}</p>
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