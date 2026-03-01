import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Sparkles, Loader2, Info, LayoutGrid } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { useProjectStore, type Project, type BoardTask } from '../store/projectStore';
import { toast } from 'sonner';

type FormState = 'default' | 'validating' | 'generating' | 'success';

// AI mock task generation based on project description
function generateMockTasks(projectName: string, description: string): BoardTask[] {
  const keywords = description.toLowerCase();
  const today = new Date().toISOString().split('T')[0];
  const tasks: BoardTask[] = [];

  // Generate contextual tasks based on keywords
  const taskTemplates: { condition: boolean; tasks: { title: string; desc: string; priority: BoardTask['priority']; col: string }[] }[] = [
    {
      condition: keywords.includes('design') || keywords.includes('ui') || keywords.includes('ux'),
      tasks: [
        { title: 'Create wireframes', desc: 'Design low-fidelity wireframes for all major screens', priority: 'HIGH', col: 'todo' },
        { title: 'Design system setup', desc: 'Set up color palette, typography, and component library', priority: 'MEDIUM', col: 'todo' },
        { title: 'UI mockups review', desc: 'Review and iterate on high-fidelity mockups', priority: 'MEDIUM', col: 'in-progress' },
      ],
    },
    {
      condition: keywords.includes('develop') || keywords.includes('build') || keywords.includes('code') || keywords.includes('app'),
      tasks: [
        { title: 'Set up development environment', desc: 'Initialize repository and configure CI/CD', priority: 'CRITICAL', col: 'todo' },
        { title: 'Implement core features', desc: 'Build the main functionality modules', priority: 'HIGH', col: 'todo' },
        { title: 'Write unit tests', desc: 'Create comprehensive test coverage for core modules', priority: 'MEDIUM', col: 'in-progress' },
      ],
    },
    {
      condition: keywords.includes('market') || keywords.includes('campaign') || keywords.includes('social'),
      tasks: [
        { title: 'Define target audience', desc: 'Research and document target demographics', priority: 'HIGH', col: 'todo' },
        { title: 'Create content calendar', desc: 'Plan content across all channels', priority: 'MEDIUM', col: 'todo' },
        { title: 'Design marketing assets', desc: 'Create banners, social posts, and email templates', priority: 'MEDIUM', col: 'in-progress' },
      ],
    },
  ];

  // Find matching templates
  let matchedTasks: { title: string; desc: string; priority: BoardTask['priority']; col: string }[] = [];
  for (const template of taskTemplates) {
    if (template.condition) {
      matchedTasks = [...matchedTasks, ...template.tasks];
    }
  }

  // If no keywords matched, generate generic tasks
  if (matchedTasks.length === 0) {
    matchedTasks = [
      { title: 'Define project scope', desc: `Outline the goals and requirements for ${projectName}`, priority: 'HIGH', col: 'todo' },
      { title: 'Create project plan', desc: 'Break down milestones and deliverables', priority: 'HIGH', col: 'todo' },
      { title: 'Assign team roles', desc: 'Determine responsibilities for each team member', priority: 'MEDIUM', col: 'todo' },
      { title: 'Initial research', desc: 'Research best practices and competitive landscape', priority: 'MEDIUM', col: 'in-progress' },
      { title: 'Set up communication channels', desc: 'Configure Slack channels, meeting cadence', priority: 'LOW', col: 'done' },
    ];
  }

  // Always add a few more generic tasks
  matchedTasks.push(
    { title: 'Stakeholder review', desc: 'Present progress to stakeholders and gather feedback', priority: 'MEDIUM', col: 'review' },
    { title: 'Documentation', desc: 'Write comprehensive project documentation', priority: 'LOW', col: 'todo' },
  );

  matchedTasks.forEach((t, i) => {
    tasks.push({
      id: `gen-${Date.now()}-${i}`,
      title: t.title,
      description: t.desc,
      priority: t.priority,
      createdDate: today,
      columnId: t.col,
    });
  });

  return tasks;
}

export function CreateProject() {
  const navigate = useNavigate();
  const addProject = useProjectStore((s) => s.addProject);
  const [formState, setFormState] = useState<FormState>('default');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [errors, setErrors] = useState<{ name?: string; description?: string }>({});
  const [showPreview, setShowPreview] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<BoardTask[]>([]);

  const defaultColumns = [
    { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
    { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
    { id: 'review', title: 'Review', color: 'bg-yellow-100' },
    { id: 'done', title: 'Done', color: 'bg-green-100' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { name?: string; description?: string } = {};
    if (!projectName.trim()) {
      newErrors.name = 'Project name is required';
    }
    if (!projectDescription.trim()) {
      newErrors.description = 'Project description is required for AI generation';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFormState('validating');
      return;
    }

    setErrors({});
    setFormState('generating');

    // Simulate AI generation
    setTimeout(() => {
      const tasks = generateMockTasks(projectName, projectDescription);
      setGeneratedTasks(tasks);
      setFormState('success');
      setShowPreview(true);
    }, 2500);
  };

  const handleCreateEmptyBoard = () => {
    if (!projectName.trim()) {
      setErrors({ name: 'Project name is required' });
      setFormState('validating');
      return;
    }

    const newId = Date.now().toString();
    const newProject: Project = {
      id: newId,
      name: projectName.trim(),
      description: projectDescription.trim() || 'No description provided',
      boardId: newId,
      members: [
        { id: 'm-owner', name: 'John Doe', email: 'john@example.com', avatar: 'https://i.pravatar.cc/150?img=12', role: 'owner' },
      ],
      columns: [
        { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
        { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
        { id: 'done', title: 'Done', color: 'bg-green-100' },
      ],
      tasks: [],
      decisions: [],
    };

    addProject(newProject);
    toast.success('Empty board created!');
    navigate(`/project/${newId}`);
  };

  const handleConfirmBoard = () => {
    const newId = Date.now().toString();
    const newProject: Project = {
      id: newId,
      name: projectName.trim(),
      description: projectDescription.trim(),
      boardId: newId,
      members: [
        { id: 'm-owner', name: 'John Doe', email: 'john@example.com', avatar: 'https://i.pravatar.cc/150?img=12', role: 'owner' },
      ],
      columns: defaultColumns,
      tasks: [], // Empty tasks array for AI-generated boards
      decisions: [],
    };

    addProject(newProject);
    toast.success('Project created successfully!');
    navigate(`/project/${newId}`);
  };

  // Group generated tasks by column for preview
  const tasksByColumn = defaultColumns.map((col) => ({
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