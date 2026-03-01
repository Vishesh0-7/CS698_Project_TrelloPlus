import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

export function Settings() {
  const navigate = useNavigate();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [taskReminders, setTaskReminders] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('en');
  const [defaultView, setDefaultView] = useState('board');

  const handleSave = () => {
    toast.success('Settings saved successfully');
  };

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" className="mb-4 -ml-2" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
        </Button>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600 mb-8">Configure your application preferences</p>

        <div className="space-y-6">
          {/* Notifications */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Email Notifications</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Receive updates via email</p>
                </div>
                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Push Notifications</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Browser push notifications</p>
                </div>
                <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Task Reminders</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Get reminded about upcoming deadlines</p>
                </div>
                <Switch checked={taskReminders} onCheckedChange={setTaskReminders} />
              </div>
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Appearance</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Dark Mode</Label>
                  <p className="text-xs text-gray-500 mt-0.5">Toggle dark theme</p>
                </div>
                <Switch checked={darkMode} onCheckedChange={setDarkMode} />
              </div>
              <div>
                <Label className="text-sm font-medium">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Board Defaults */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Board Defaults</h3>
            <div>
              <Label className="text-sm font-medium">Default View</Label>
              <Select value={defaultView} onValueChange={setDefaultView}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="board">Board View</SelectItem>
                  <SelectItem value="list">List View</SelectItem>
                  <SelectItem value="calendar">Calendar View</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleSave} className="w-full">Save Settings</Button>
        </div>
      </div>
    </div>
  );
}
