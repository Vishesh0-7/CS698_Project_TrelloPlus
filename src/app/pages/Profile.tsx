import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { toast } from 'sonner';
import { apiService } from '../services/api';
import { useProjectStore } from '../store/projectStore';
import { SecurityQuestionsSetup } from './SecurityQuestionsSetup';

interface SecurityQuestions {
  question1: string;
  question2: string;
  customQuestion: string;
}

export function Profile() {
  const navigate = useNavigate();
  const updateUser = useProjectStore((s) => s.updateUser);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingSecurityQuestions, setIsSettingSecurityQuestions] = useState(false);
  const [securityQuestions, setSecurityQuestions] = useState<SecurityQuestions | null>(null);
  const [securityQuestionsChecked, setSecurityQuestionsChecked] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await apiService.getUserProfile();
        const resolvedEmail = profile.email || '';
        setFullName(profile.fullName || profile.full_name || '');
        setEmail(resolvedEmail);
        setUserId(profile.id || '');

        try {
          const questions = await apiService.getMySecurityQuestions();
          setSecurityQuestions(questions);
        } catch {
          setSecurityQuestions(null);
        }
      } catch (error) {
        toast.error('Failed to load profile');
      } finally {
        setSecurityQuestionsChecked(true);
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setIsSaving(true);
    try {
      const updatedProfile = await apiService.updateUserProfile({ fullName });
      const resolvedName = updatedProfile.fullName || updatedProfile.full_name || fullName;
      const resolvedEmail = updatedProfile.email || email;

      const storedUserRaw = localStorage.getItem('user');
      const storedUser = storedUserRaw ? JSON.parse(storedUserRaw) : {};
      const mergedUser = {
        ...storedUser,
        ...updatedProfile,
        fullName: resolvedName,
        email: resolvedEmail,
      };
      localStorage.setItem('user', JSON.stringify(mergedUser));

      updateUser({
        name: resolvedName,
        email: resolvedEmail,
      });

      setFullName(resolvedName);
      setEmail(resolvedEmail);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isSettingSecurityQuestions) {
    return (
      <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <Button variant="ghost" className="mb-4 -ml-2" onClick={() => setIsSettingSecurityQuestions(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Profile
          </Button>

          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Security Questions</h1>
          <p className="text-gray-600 mb-8">Set or update your password recovery questions</p>

          <SecurityQuestionsSetup
            userId={userId}
            displayMode="embedded"
            initialQuestions={securityQuestions}
            requireCurrentPassword={Boolean(securityQuestions)}
            onComplete={() => {
              setIsSettingSecurityQuestions(false);
              setSecurityQuestions(null);
              setSecurityQuestionsChecked(false);
              apiService.getMySecurityQuestions()
                .then((questions) => setSecurityQuestions(questions))
                .catch(() => setSecurityQuestions(null))
                .finally(() => setSecurityQuestionsChecked(true));
              toast.success('Security questions updated successfully');
            }}
          />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600 mb-8">Manage your personal information and account recovery</p>

        <div className="bg-white rounded-xl border border-gray-200 p-6 md:p-8 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="w-20 h-20">
                <AvatarFallback className="text-xl">{fullName?.split(' ').map(n => n[0]).join('') || 'U'}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{fullName || 'User'}</h3>
              <p className="text-sm text-gray-500">{email}</p>
            </div>
          </div>

          <div className="border-t pt-6 space-y-4">
            <div>
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                readOnly
                className="mt-2 bg-gray-50 text-gray-600"
              />
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed from profile settings.</p>
            </div>
          </div>

          <div className="border-t pt-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Security Questions</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {securityQuestions
                      ? 'Your recovery questions are configured. Answers stay hidden.'
                      : securityQuestionsChecked
                        ? 'Set the questions used to reset your password.'
                        : 'Checking recovery question status...'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSettingSecurityQuestions(true)}
                className="sm:flex-shrink-0"
              >
                Manage
              </Button>
            </div>
            {securityQuestions && (
              <div className="mt-5 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Question 1</p>
                  <p className="text-sm text-gray-900 mt-1">{securityQuestions.question1}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Question 2</p>
                  <p className="text-sm text-gray-900 mt-1">{securityQuestions.question2}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Custom Question</p>
                  <p className="text-sm text-gray-900 mt-1">{securityQuestions.customQuestion}</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => navigate('/')} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="flex-1">
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
