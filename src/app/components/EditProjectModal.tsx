import { useState } from 'react';
import { UserPlus, Trash2, Check, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { type Project, type ProjectMember, useProjectStore } from '../store/projectStore';
import { toast } from 'sonner';

interface EditProjectModalProps {
  project: Project;
  onClose: () => void;
}

export function EditProjectModal({ project, onClose }: EditProjectModalProps) {
  const { updateProject, addMemberToProject, removeMemberFromProject, renameColumn } = useProjectStore();
  const [projectName, setProjectName] = useState(project.name);
  const [projectDescription, setProjectDescription] = useState(project.description);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<ProjectMember['role']>('viewer');
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState('');

  const handleSaveGeneral = () => {
    updateProject(project.id, { name: projectName, description: projectDescription });
    toast.success('Project updated successfully');
  };

  const handleAddMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      toast.error('Please enter both name and email');
      return;
    }
    const newMember: ProjectMember = {
      id: `m-${Date.now()}`,
      name: newMemberName.trim(),
      email: newMemberEmail.trim(),
      role: newMemberRole,
    };
    addMemberToProject(project.id, newMember);
    setNewMemberName('');
    setNewMemberEmail('');
    setNewMemberRole('viewer');
    toast.success(`${newMember.name} added to project`);
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    removeMemberFromProject(project.id, memberId);
    toast.success(`${memberName} removed from project`);
  };

  const handleStartEditColumn = (columnId: string, currentTitle: string) => {
    setEditingColumnId(columnId);
    setEditingColumnTitle(currentTitle);
  };

  const handleSaveColumnName = () => {
    if (editingColumnId && editingColumnTitle.trim()) {
      renameColumn(project.id, editingColumnId, editingColumnTitle.trim());
      toast.success('Column renamed');
    }
    setEditingColumnId(null);
    setEditingColumnTitle('');
  };

  // Get fresh project data from store
  const currentProject = useProjectStore((s) => s.projects.find((p) => p.id === project.id));
  if (!currentProject) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-full md:max-w-2xl max-h-[85vh] overflow-y-auto p-0 mx-4" aria-describedby="edit-project-description">
        <DialogTitle className="sr-only">Edit Project - {project.name}</DialogTitle>
        <DialogDescription className="sr-only" id="edit-project-description">
          Edit project details, manage team members, and configure columns
        </DialogDescription>
        
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 md:px-6 py-3 md:py-4 z-10">
          <h2 className="text-lg md:text-xl font-semibold text-gray-900">Edit Project</h2>
        </div>

        <div className="px-4 md:px-6 pb-6">
          <Tabs defaultValue="general" className="mt-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="columns">Columns</TabsTrigger>
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-4 mt-4">
              <div>
                <Label htmlFor="edit-name">Project Name</Label>
                <Input
                  id="edit-name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-desc">Description</Label>
                <Input
                  id="edit-desc"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className="mt-2"
                />
              </div>
              <Button onClick={handleSaveGeneral} className="w-full">
                Save Changes
              </Button>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="space-y-4 mt-4">
              {/* Current Members */}
              <div>
                <Label className="text-sm mb-3 block">Current Members ({currentProject.members.length})</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {currentProject.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{member.name.split(' ').map((n) => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {member.role}
                        </Badge>
                        {member.role !== 'owner' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-700"
                            onClick={() => handleRemoveMember(member.id, member.name)}
                            aria-label={`Remove ${member.name} from project`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Member */}
              <div className="border-t pt-4">
                <Label className="text-sm mb-3 block">Add New Member</Label>
                <div className="space-y-3">
                  <Input
                    placeholder="Name"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                  <Select value={newMemberRole} onValueChange={(v: ProjectMember['role']) => setNewMemberRole(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddMember} className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* Columns Tab */}
            <TabsContent value="columns" className="space-y-3 mt-4">
              <Label className="text-sm mb-3 block">Board Columns</Label>
              {currentProject.columns.map((column) => (
                <div key={column.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  {editingColumnId === column.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editingColumnTitle}
                        onChange={(e) => setEditingColumnTitle(e.target.value)}
                        className="h-8"
                        autoFocus
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveColumnName()}
                      />
                      <Button 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={handleSaveColumnName}
                        aria-label="Save column name"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                        <span className="text-sm font-medium">{column.title}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleStartEditColumn(column.id, column.title)}
                        aria-label={`Edit column: ${column.title}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}