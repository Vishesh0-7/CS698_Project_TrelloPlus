import { FolderKanban, Users } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { cn } from './ui/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const location = useLocation();

  const navItems = [
    { icon: FolderKanban, label: 'Projects', path: '/', id: 'projects' },
    { icon: Users, label: 'Meetings', path: '/meetings', id: 'meetings' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        'fixed left-0 top-16 h-[calc(100vh-4rem)] bg-white border-r border-gray-200 z-40 transition-all duration-300',
        // Mobile
        'md:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop
        collapsed ? 'md:w-16' : 'md:w-64',
        'w-64'
      )}>
        <div className="flex flex-col h-full">
          {/* Navigation Items */}
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => onMobileClose()}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100',
                    collapsed && 'md:justify-center'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={cn(
                    'font-medium',
                    collapsed && 'md:hidden'
                  )}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}