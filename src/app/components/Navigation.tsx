import { Menu, PanelLeftClose, PanelLeft, LogOut, FolderKanban, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { useNavigate, useLocation } from 'react-router';
import { useProjectStore } from '../store/projectStore';
import { toast } from 'sonner';
import { cn } from './ui/utils';

interface NavigationProps {
  onMenuClick?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
}

export function Navigation({ onMenuClick, onToggleSidebar, sidebarCollapsed }: NavigationProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useProjectStore((s) => s.user);

  const handleLogout = () => {
    navigate('/logout');
  };

  const navItems = [
    { icon: FolderKanban, label: 'Projects', path: '/' },
    { icon: Users, label: 'Meetings', path: '/meetings' },
  ];

  return (
    <nav className="h-16 bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
      <div className="h-full px-3 md:px-6 flex items-center justify-between gap-2 md:gap-0">
        {/* Left Section */}
        <div className="flex items-center gap-2 md:gap-6">
          {/* Logo */}
          <div className="flex items-center gap-2 md:gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">AI</span>
            </div>
            <span className="text-lg md:text-xl font-bold text-gray-900 hidden md:inline">FlowBoard</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm',
                    isActive
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>
          
          {/* Mobile Navigation Links */}
          <div className="flex md:hidden items-center gap-1">
            <button
              onClick={() => navigate('/')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium',
                location.pathname === '/'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <FolderKanban className="w-4 h-4" />
              Projects
            </button>
            
            <button
              onClick={() => navigate('/meetings')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium',
                location.pathname === '/meetings'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              <Users className="w-4 h-4" />
              Meetings
            </button>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div>
                <button 
                  className="flex items-center gap-3 hover:bg-gray-50 rounded-lg p-1.5 transition-colors"
                  aria-label={`User menu for ${user.name}`}
                  aria-haspopup="menu"
                  aria-expanded="false"
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>{user.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                  </Avatar>
                  <div className="text-left hidden xl:block">
                    <div className="text-sm font-medium text-gray-900">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.role}</div>
                  </div>
                </button>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-xs font-medium text-gray-500">Your account</p>
                  <p className="text-sm font-medium text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/profile')}>Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/team')}>Team</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="w-4 h-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
}