import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Sparkles, Loader2, Info, LayoutGrid } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useProjectStore, type BoardTask, type BoardColumn } from '../store/projectStore';
import { toast } from 'sonner';
import { apiService, mapCardResponseToTask, mapProjectResponseToProject } from '../services/api';

type FormState = 'default' | 'validating' | 'generating' | 'success';

export function CreateProject() {
  const navigate = useNavigate();
  const addProject = useProjectStore((s) => s.addProject);
  const [formState, setFormState] = useState<FormState>('default');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [showPreview, setShowPreview] = useState(false);
  const [generatedColumns, setGeneratedColumns] = useState<BoardColumn[]>([]);
  const [generatedTasks, setGeneratedTasks] = useState<BoardTask[]>([]);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { name?: string; description?: string } = {};
    if (!projectName.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (projectName.trim().length > 255) {
      newErrors.name = 'Project name must be 255 characters or fewer';
    }
    if (!projectDescription.trim()) {
      newErrors.description = 'Project description is required for AI generation';
    }
    if (projectDescription.trim().length > 5000) {
      newErrors.description = 'Project description must be 5000 characters or fewer';
    }
    if (projectDescription.trim() && projectDescription.trim().split(/\s+/).length < 5) {
      newErrors.description = 'Project description must contain at least 5 words for AI generation';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFormState('validating');
      return;
    }

    setErrors({});
    setFormState('generating');

    try {
      const response = await apiService.createProject({
        name: projectName.trim(),
        description: projectDescription.trim(),
        generateTasks: true,
      });

      const newProject = mapProjectResponseToProject(response);

      addProject(newProject);
      setFormState('success');
      setShowPreview(true);
      setCreatedProjectId(response.id);
      
      // Store generated tasks for preview
      setGeneratedColumns(newProject.columns);
      setGeneratedTasks(response.tasks.map(mapCardResponseToTask));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
      setFormState('default');
    }
  };

  const handleCreateEmptyBoard = async () => {
    if (!projectName.trim()) {
      setErrors({ name: 'Project name is required' });
      setFormState('validating');
      return;
    }

    if (projectName.trim().length > 255) {
      setErrors({ name: 'Project name must be 255 characters or fewer' });
      setFormState('validating');
      return;
    }

    if (projectDescription.trim().length > 5000) {
      setErrors({ description: 'Project description must be 5000 characters or fewer' });
      setFormState('validating');
      return;
    }

    setFormState('generating');
    try {
      const response = await apiService.createProject({
        name: projectName.trim(),
        description: projectDescription.trim() || 'No description provided',
        generateTasks: false,
      });

      const newProject = mapProjectResponseToProject(response);

      addProject(newProject);
      toast.success('Empty board created!');
      navigate(`/project/${response.id}?tab=board`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create project');
      setFormState('default');
    }
  };

  const handleConfirmBoard = () => {
    if (!createdProjectId) {
      toast.error('Project ID not found. Please try again.');
      return;
    }
    
    toast.success('Project created successfully!');
    navigate(`/project/${createdProjectId}?tab=board`);
  };

  // Group generated tasks by column for preview
  const tasksByColumn = generatedColumns.map((col) => ({
    ...col,
    tasks: generatedTasks.filter((t) => t.columnId === col.id),
  }));

  return (
    <div className="p-4 md:p-8 pt-20 md:pt-24 min-h-screen">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            className="mb-4 -ml-2"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Create New Project</h1>
          <p className="text-gray-600">
            Describe your project and let AI generate a complete Kanban board for you
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 md:p-8">
          {/* Project Name */}
          <div className="mb-6">
            <Label htmlFor="project-name" className="text-base">
              Project Name
            </Label>
            <Input
              id="project-name"
              placeholder="e.g., Website Redesign, Mobile App Launch"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setErrors({ ...errors, name: undefined });
              }}
              className={`mt-2 ${errors.name ? 'border-red-500' : ''}`}
              disabled={formState === 'generating'}
            />
            {errors.name && (
              <p className="text-sm text-red-600 mt-1">{errors.name}</p>
            )}
          </div>

          {/* Project Description */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Label htmlFor="project-description" className="text-base">
                Project Description
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Our AI analyzes your description to automatically create workflow stages and populate tasks. 
                      Be specific about goals, deliverables, and team structure for best results.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Textarea
              id="project-description"
              placeholder="Describe your project in detail. Include goals, key deliverables, timeline, and team roles. The more context you provide, the better the AI-generated board will be."
              value={projectDescription}
              onChange={(e) => {
                setProjectDescription(e.target.value);
                setErrors({ ...errors, description: undefined });
              }}
              className={`mt-2 min-h-[160px] md:min-h-[200px] ${errors.description ? 'border-red-500' : ''}`}
              disabled={formState === 'generating'}
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              {projectDescription.length} characters
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/')}
              disabled={formState === 'generating'}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCreateEmptyBoard}
              disabled={formState === 'generating'}
              className="flex-1"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Create Empty Board
            </Button>
            <Button
              type="submit"
              disabled={formState === 'generating'}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {formState === 'generating' ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span className="hidden sm:inline">Generating board...</span>
                  <span className="sm:hidden">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate AI Board
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Success Preview Modal */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                AI Board Generated Successfully
              </DialogTitle>
              <DialogDescription>
                Review the generated board structure below. You can customize it further once created.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4">
              <div className="bg-gray-50 rounded-lg p-4 md:p-6 mb-4">
                <h3 className="font-semibold text-lg mb-2">{projectName}</h3>
                <p className="text-gray-600 text-sm">{projectDescription}</p>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Generated Board Preview:</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {tasksByColumn.map((column) => (
                    <div key={column.id} className="bg-gray-100 rounded-lg p-3">
                      <h5 className="font-medium text-sm mb-2">
                        {column.title}
                        <span className="ml-1 text-xs text-gray-500">({column.tasks.length})</span>
                      </h5>
                      <div className="space-y-2">
                        {column.tasks.map((task) => (
                          <div key={task.id} className="bg-white rounded p-2 text-xs">
                            <div className="font-medium mb-1">{task.title}</div>
                            <div className="text-gray-500 line-clamp-2">{task.description}</div>
                          </div>
                        ))}
                        {column.tasks.length === 0 && (
                          <div className="text-xs text-gray-400 italic p-2">No tasks</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => setShowPreview(false)} className="flex-1">
                Back to Edit
              </Button>
              <Button onClick={handleConfirmBoard} className="flex-1">
                Create Board
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}