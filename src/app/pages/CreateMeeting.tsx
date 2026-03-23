import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { ArrowLeft, Calendar, Clock, Users, FileText, Link as LinkIcon, Video, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiService, type ProjectResponse } from '../services/api';

interface ProjectMember {
  id: string;
  name: string;
  email: string;
}

export function CreateMeeting() {
  const navigate = useNavigate();

  const [projects, setProjects] = useState<ProjectResponse[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [agenda, setAgenda] = useState('');
  const [platform, setPlatform] = useState('');
  const [link, setLink] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        const userProjects = await apiService.getUserProjects();
        setProjects(userProjects);
        if (userProjects.length > 0) {
          setSelectedProjectId(userProjects[0].id);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load projects');
      } finally {
        setLoadingProjects(false);
      }
    };

    void loadProjects();
  }, []);

  // Load members when project is selected
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectMembers([]);
      setSelectedMemberIds([]);
      return;
    }

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const members = await apiService.getProjectMembers(selectedProjectId);
        
        // Map members to the expected structure
        const mappedMembers: ProjectMember[] = members.map((m: any) => ({
          id: m.id || m.userId || '',
          name: m.name || m.fullName || m.username || '',
          email: m.email || '',
        }));
        
        setProjectMembers(mappedMembers);
        // Auto-select all project members
        setSelectedMemberIds(mappedMembers.map((m) => m.id));
      } catch (error) {
        toast.error('Failed to load project members');
        setProjectMembers([]);
        setSelectedMemberIds([]);
      } finally {
        setLoadingMembers(false);
      }
    };

    void loadMembers();
  }, [selectedProjectId]);

  const handleToggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreateMeeting = async () => {
    if (!selectedProjectId) {
      toast.error('Please select a project');
      return;
    }

    if (!title.trim() || !date || !time || selectedMemberIds.length === 0) {
      toast.error('Please fill in all required fields and select at least one team member');
      return;
    }

    const scheduledAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(scheduledAt.getTime())) {
      toast.error('Please enter a valid meeting date and time');
      return;
    }

    if (scheduledAt.getTime() < Date.now()) {
      toast.error('Meeting cannot be scheduled in the past');
      return;
    }

    try {
      await apiService.createMeeting({
        projectId: selectedProjectId,
        title: title.trim(),
        description: agenda.trim(),
        meetingDate: date,
        meetingTime: `${time}:00`,
        platform: platform.trim() || undefined,
        meetingLink: link.trim() || undefined,
        additionalMemberIds: selectedMemberIds,
      });

      toast.success('Meeting created successfully');
      navigate(`/project/${selectedProjectId}?tab=meetings`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create meeting');
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
            onClick={() => navigate('/meetings')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Meetings
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Create New Meeting</h1>
          <p className="text-gray-600">Set up a new meeting and choose exactly who participates</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6">
          {/* Project Selection */}
          <div>
            <Label htmlFor="project" className="mb-2">
              Select Project <span className="text-red-500">*</span>
            </Label>
            {loadingProjects ? (
              <div className="h-10 bg-gray-100 rounded-md animate-pulse" />
            ) : (
              <select
                id="project"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select a project --</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
            {projects.length === 0 && !loadingProjects && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-2">
                <p className="text-sm text-yellow-800">
                  No projects found. Please{' '}
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="font-medium underline hover:text-yellow-900"
                  >
                    create a project
                  </button>{' '}
                  first.
                </p>
              </div>
            )}
          </div>

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
                min={new Date().toISOString().split('T')[0]}
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
            {loadingMembers ? (
              <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 bg-gray-200 rounded animate-pulse" />
              </div>
            ) : projectMembers.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  No team members found for this project. Please add members to the project first.
                </p>
              </div>
            ) : (
              <div className="space-y-2 bg-gray-50 border border-gray-200 rounded-lg p-4">
                {projectMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <Checkbox
                      id={`member-${member.id}`}
                      checked={selectedMemberIds.includes(member.id)}
                      onCheckedChange={() => handleToggleMember(member.id)}
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
            {selectedMemberIds.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedMemberIds.map((memberId) => {
                  const member = projectMembers.find((m) => m.id === memberId);
                  const label = member ? member.name : memberId;
                  return (
                  <Badge
                    key={memberId}
                    variant="outline"
                    className="pl-3 pr-1 py-1.5 bg-blue-50 text-blue-700 border-blue-200"
                  >
                    {label}
                    <button
                      onClick={() => handleToggleMember(memberId)}
                      className="ml-2 hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                  );
                })}
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
              disabled={!selectedProjectId || projectMembers.length === 0 || selectedMemberIds.length === 0 || loadingProjects || loadingMembers}
            >
              Create Meeting
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}