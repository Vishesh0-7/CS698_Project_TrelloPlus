import { Plus, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router';
import { ProjectCard } from '../components/ProjectCard';
import { useProjectStore } from '../store/projectStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService, mapProjectResponseToProject } from '../services/api';
import { toast } from 'sonner';
import { useWebSocketProjectUpdates } from '../hooks/useWebSocketProjectUpdates';

export function Dashboard() {
  const navigate = useNavigate();
  const projects = useProjectStore((s) => s.projects);
  const setProjects = useProjectStore((s) => s.setProjects);
  const shouldBlockInitialUIRef = useRef(projects.length === 0);
  const [isLoading, setIsLoading] = useState(shouldBlockInitialUIRef.current);

  const loadProjects = useCallback(async ({ showBlockingLoader = false, showErrorToast = false }: { showBlockingLoader?: boolean; showErrorToast?: boolean } = {}) => {
      if (showBlockingLoader) {
        setIsLoading(true);
      }

      try {
        const userProjects = await apiService.getUserProjects();
        const convertedProjects = userProjects.map(mapProjectResponseToProject);
        setProjects(convertedProjects);
      } catch (error) {
        if (showErrorToast) {
          toast.error(error instanceof Error ? error.message : 'Failed to load projects');
        }
      } finally {
        if (showBlockingLoader) {
          setIsLoading(false);
        }
      }
    }, [setProjects]);

  // Load projects on initial mount
  useEffect(() => {
    let isCancelled = false;

    const shouldBlockUI = shouldBlockInitialUIRef.current;
    void loadProjects({ showBlockingLoader: shouldBlockUI, showErrorToast: true });
    shouldBlockInitialUIRef.current = false;

    return () => {
      isCancelled = true;
    };
  }, [loadProjects]);

  // Callback for WebSocket to refresh projects
  const handleProjectsChanged = useCallback(() => {
    void loadProjects({ showErrorToast: false });
  }, [loadProjects]);

  // Enable real-time project list updates via WebSocket instead of polling
  useWebSocketProjectUpdates(handleProjectsChanged, projects.map(p => p.id));

  // Empty State
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4 md:p-8 pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4 md:p-8 pt-20 md:pt-24">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Projects</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">Manage your AI-generated Kanban boards</p>
            </div>
            <Button onClick={() => navigate('/create-project')} size="lg" className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-5 h-5 mr-2" />
              Create New Project
            </Button>
          </div>

          <div className="flex flex-col items-center justify-center py-12 md:py-20">
            <div className="w-48 h-48 md:w-64 md:h-64 mb-6 md:mb-8 opacity-50">
              <svg 
                viewBox="0 0 200 200" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Empty Kanban board illustration"
                role="img"
              >
                <rect x="40" y="60" width="120" height="100" rx="8" stroke="#9CA3AF" strokeWidth="2" fill="#F3F4F6"/>
                <rect x="50" y="70" width="30" height="80" rx="4" fill="#E5E7EB"/>
                <rect x="85" y="70" width="30" height="80" rx="4" fill="#E5E7EB"/>
                <rect x="120" y="70" width="30" height="80" rx="4" fill="#E5E7EB"/>
                <circle cx="100" cy="40" r="15" fill="#3B82F6"/>
                <path d="M95 40 L98 43 L105 36" stroke="white" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold text-gray-900 mb-2 text-center px-4">No projects yet</h2>
            <p className="text-sm md:text-base text-gray-600 mb-6 md:mb-8 text-center max-w-md px-4">
              Get started by creating your first project. Our AI will help you generate a complete Kanban board with tasks.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Success State - Projects displayed
  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4 md:p-8 pt-20 md:pt-24">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 md:mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm md:text-base text-gray-600 mt-1">Manage your AI-generated Kanban boards</p>
          </div>
          <div className="flex flex-wrap gap-2 md:gap-3 w-full sm:w-auto">
            <Button onClick={() => navigate('/create-project')} size="lg" className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-5 h-5 mr-2" />
              <span className="hidden sm:inline">Create New Project</span>
              <span className="sm:hidden">Create Project</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>
    </div>
  );
}