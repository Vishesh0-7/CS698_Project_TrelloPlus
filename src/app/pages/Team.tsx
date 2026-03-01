import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, UserPlus, Mail, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { useProjectStore } from '../store/projectStore';
import { toast } from 'sonner';

export function Team() {
  const navigate = useNavigate();
  const { teamMembers, addTeamMember, removeTeamMember } = useProjectStore();
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Member');

  const handleInvite = () => {
    if (!newName.trim() || !newEmail.trim()) {
      toast.error('Please enter name and email');
      return;
    }
    addTeamMember({
      id: `tm-${Date.now()}`,
      name: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      status: 'invited',
    });
    setNewName('');
    setNewEmail('');
    setNewRole('Member');
    toast.success(`Invitation sent to ${newName.trim()}`);
  };

  const handleRemove = (id: string, name: string) => {
    removeTeamMember(id);
    toast.success(`${name} removed from team`);
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Team</h1>
        <p className="text-gray-600 mb-8">Manage your team members and invitations</p>

        {/* Invite New Member */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Invite Team Member</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <Label htmlFor="invite-name" className="text-xs">Name</Label>
              <Input
                id="invite-name"
                placeholder="Full name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="invite-email" className="text-xs">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Label className="text-xs">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Member">Member</SelectItem>
                  <SelectItem value="Viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInvite}>
              <UserPlus className="w-4 h-4 mr-2" />
              Invite
            </Button>
          </div>
        </div>

        {/* Team Members List */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Team Members ({teamMembers.length})</h3>
          <div className="space-y-3">
            {teamMembers.map((member) => (
              <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{member.name}</p>
                      <Badge variant="outline" className="text-xs">
                        {member.role}
                      </Badge>
                    </div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={member.status === 'invited' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-green-50 text-green-700 border-green-200'}
                  >
                    {member.status === 'invited' ? 'Invited' : 'Active'}
                  </Badge>
                  {member.role !== 'Admin' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-500 hover:text-red-700"
                      onClick={() => handleRemove(member.id, member.name)}
                      aria-label={`Remove ${member.name} from team`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}