import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMeetingStore } from '../store/meetingStore';
import { useProjectStore } from '../store/projectStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { ArrowLeft, Calendar, Clock, Users, FileText, Link as LinkIcon, Video, X } from 'lucide-react';
import { toast } from 'sonner';

export function CreateMeeting() {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId?: string }>();
  const addMeeting = useMeetingStore((s) => s.addMeeting);
  const teamMembers = useProjectStore((s) => s.teamMembers);
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [agenda, setAgenda] = useState('');
  const [platform, setPlatform] = useState('');
  const [link, setLink] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const handleToggleMember = (memberName: string) => {
    setSelectedMembers((prev) =>
      prev.includes(memberName)
        ? prev.filter((m) => m !== memberName)
        : [...prev, memberName]
    );
  };

  const handleCreateMeeting = () => {
    if (!title.trim() || !date || !time || selectedMembers.length === 0) {
      toast.error('Please fill in all required fields and select at least one team member');
      return;
    }

    const newMeeting = {
      id: `m-${Date.now()}`,
      projectId: projectId || '', // Use projectId from route or empty string for global meetings
      title: title.trim(),
      date,
      time,
      members: selectedMembers,
      agenda: agenda.trim(),
      platform: platform.trim(),
      link: link.trim(),
      status: 'scheduled' as const,
      actionItems: [],
      decisions: [],
      changes: [],
      otherNotes: [],
      approvals: selectedMembers.map((member, idx) => ({
        userId: `u${idx + 1}`,
        userName: member,
        status: 'pending' as const,
      })),
      totalApprovers: selectedMembers.length,
      userHasApproved: false,
    };

    addMeeting(newMeeting);
    toast.success('Meeting created successfully');
    
    // Navigate back to project meetings tab or global meetings page
    if (projectId) {
      navigate(`/project/${projectId}?tab=meetings`);
    } else {
      navigate('/meetings');
    }
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 md:mb-8">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => projectId ? navigate(`/project/${projectId}`) : navigate('/meetings')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {projectId && project ? `Back to ${project.name}` : 'Back to Meetings'}
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Create New Meeting</h1>
          <p className="text-gray-600">
            {projectId && project 
              ? `Set up a new meeting for ${project.name}` 
              : 'Set up a new meeting with your team'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title" className="mb-2">
              Meeting Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="e.g., Q1 Planning Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Date and Time */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="time" className="mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Time <span className="text-red-500">*</span>
              </Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Team Members */}
          <div>
            <Label className="mb-3">
              <Users className="w-4 h-4 inline mr-1" />
              Team Members <span className="text-red-500">*</span>
            </Label>
            {teamMembers.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  No team members found. Please add team members from the{' '}
                  <button
                    onClick={() => navigate('/team')}
                    className="font-medium underline hover:text-yellow-900"
                  >
                    Team page
                  </button>{' '}
                  first.
                </p>
              </div>
            ) : (
              <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`member-${member.id}`}
                      checked={selectedMembers.includes(member.name)}
                      onCheckedChange={() => handleToggleMember(member.name)}
                    />
                    <Label
                      htmlFor={`member-${member.id}`}
                      className="flex-1 cursor-pointer text-gray-900"
                    >
                      {member.name}
                      <span className="text-sm text-gray-500 ml-2">({member.email})</span>
                    </Label>
                  </div>
                ))}
              </div>
            )}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedMembers.map((member) => (
                  <Badge
                    key={member}
                    variant="outline"
                    className="pl-3 pr-1 py-1.5 bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {member}
                    <button
                      onClick={() => handleToggleMember(member)}
                      className="ml-2 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Agenda */}
          <div>
            <Label htmlFor="agenda" className="mb-2">
              <FileText className="w-4 h-4 inline mr-1" />
              Agenda
            </Label>
            <Textarea
              id="agenda"
              placeholder="What will be discussed in this meeting?"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Platform */}
          <div>
            <Label htmlFor="platform" className="mb-2">
              <Video className="w-4 h-4 inline mr-1" />
              Platform
            </Label>
            <Input
              id="platform"
              placeholder="e.g., Zoom, Google Meet, Microsoft Teams"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            />
          </div>

          {/* Meeting Link */}
          <div>
            <Label htmlFor="link" className="mb-2">
              <LinkIcon className="w-4 h-4 inline mr-1" />
              Meeting Link
            </Label>
            <Input
              id="link"
              placeholder="https://..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button variant="outline" onClick={() => navigate('/meetings')} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleCreateMeeting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              disabled={teamMembers.length === 0}
            >
              Create Meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}