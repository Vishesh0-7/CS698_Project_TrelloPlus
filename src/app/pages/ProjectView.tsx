import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router';
import { useProjectStore } from '../store/projectStore';
import { useMeetingStore } from '../store/meetingStore';
import { useChangeStore, type ChangeRequest } from '../store/changeStore';
import { KanbanBoard } from './KanbanBoard';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ChangeDetailModal } from '../components/ChangeDetailModal';
import { Calendar, Clock, Plus, FileText, ListChecks, CheckCircle, BookOpen } from 'lucide-react';

type Tab = 'board' | 'meetings' | 'decisions';

export function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl || 'board');
  const [selectedChange, setSelectedChange] = useState<ChangeRequest | null>(null);
  
  // Update active tab when URL changes
  useEffect(() => {
    if (tabFromUrl && ['board', 'meetings', 'decisions'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);
  
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  const allMeetings = useMeetingStore((s) => s.meetings);
  const allChanges = useChangeStore((s) => s.changes);
  
  if (!project) {
    return (
      <div className="p-8 pt-24 text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
        <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
      </div>
    );
  }

  // Filter meetings for this project
  const projectMeetings = allMeetings.filter((m) => m.projectId === projectId);
  
  // Sort meetings by date (most recent first)
  const sortedMeetings = [...projectMeetings].sort((a, b) => {
    const dateA = new Date(a.date + 'T' + a.time);
    const dateB = new Date(b.date + 'T' + b.time);
    return dateB.getTime() - dateA.getTime();
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
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {decision.description}
                            </h3>
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
                  onClick={() => navigate(`/project/${projectId}/create-meeting`)}
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
                    const statusInfo = statusConfig[meeting.status];

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
                          
                          <Badge variant="outline" className={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
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
                                className="flex-1"
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
    </div>
  );
}