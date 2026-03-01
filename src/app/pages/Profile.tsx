import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { useProjectStore } from '../store/projectStore';
import { toast } from 'sonner';

export function Profile() {
  const navigate = useNavigate();
  const { user, updateUser } = useProjectStore();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);

  const handleSave = () => {
    updateUser({ name, email, role });
    toast.success('Profile updated successfully');
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600 mb-8">Manage your personal information</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="text-xl">{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{user.name}</h3>
              <p className="text-sm text-gray-500">{user.role}</p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div>
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="profile-role">Role</Label>
              <Input
                id="profile-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/')} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} className="flex-1">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}