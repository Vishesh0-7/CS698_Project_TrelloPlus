import { create } from 'zustand';

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface ProjectDecision {
  id: string;
  description: string;
  meetingId: string;
  meetingTitle: string;
  sourceContext: string;
  approvedAt: string;
  approvedBy: string;
}

export interface BoardColumn {
  id: string;
  title: string;
  color: string;
}

export interface BoardTask {
  id: string;
  title: string;
  description: string;
  assignee?: {
    id: string;
    name: string;
  };
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdDate: string;
  columnId: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  boardId: string;
  members: ProjectMember[];
  columns: BoardColumn[];
  tasks: BoardTask[];
  decisions: ProjectDecision[];
}

const initialProjects: Project[] = [];

// User profile
export interface UserProfile {
  name: string;
  email: string;
  role: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: 'active' | 'invited';
}

interface ProjectStore {
  projects: Project[];
  user: UserProfile;
  teamMembers: TeamMember[];
  
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  duplicateProject: (id: string) => void;
  
  addMemberToProject: (projectId: string, member: ProjectMember) => void;
  removeMemberFromProject: (projectId: string, memberId: string) => void;
  
  addColumnToProject: (projectId: string, column: BoardColumn) => void;
  renameColumn: (projectId: string, columnId: string, newTitle: string) => void;
  deleteColumn: (projectId: string, columnId: string) => void;
  
  addTask: (projectId: string, task: BoardTask) => void;
  updateTask: (projectId: string, task: BoardTask) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  moveTask: (projectId: string, taskId: string, newColumnId: string) => void;
  
  addDecision: (projectId: string, decision: ProjectDecision) => void;
  
  setProjects: (projects: Project[]) => void;
  
  updateUser: (updates: Partial<UserProfile>) => void;
  addTeamMember: (member: TeamMember) => void;
  removeTeamMember: (memberId: string) => void;
  
  // Real-time update methods for WebSocket board changes
  addCardToBoard: (card: any) => void;
  updateCardFromRealTime: (card: any) => void;
  deleteCardFromRealTime: (stageId: string, cardId: string) => void;
  addStageToBoard: (stage: any) => void;
  updateStageFromRealTime: (stage: any) => void;
  deleteStageFromBoard: (stageId: string) => void;
  
  // Team member real-time handlers
  addTeamMemberToProject: (projectId: string, memberId: string, member: any) => void;
  removeTeamMemberFromProject: (projectId: string, memberId: string) => void;
  updateTeamMemberRole: (projectId: string, memberId: string, newRole: string) => void;
}

// Get initial user from localStorage
const getInitialUser = (): UserProfile => {
  try {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsed = JSON.parse(storedUser);
      const resolvedName = parsed.fullName || parsed.full_name || parsed.username || 'User';
      const resolvedRole = parsed.role || 'Member';
      return {
        name: resolvedName,
        email: parsed.email || '',
        role: resolvedRole,
      };
    }
  } catch (e) {
    console.error('Failed to load user from localStorage:', e);
  }
  return {
    name: 'User',
    email: '',
    role: 'Member',
  };
};

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: initialProjects,
  user: getInitialUser(),
  teamMembers: [
    { id: 'tm1', name: 'John Doe', email: 'john@flowboard.com', role: 'Admin', status: 'active' },
    { id: 'tm2', name: 'Sarah Chen', email: 'sarah@flowboard.com', role: 'Member', status: 'active' },
    { id: 'tm3', name: 'Mike Johnson', email: 'mike@flowboard.com', role: 'Member', status: 'active' },
    { id: 'tm4', name: 'Alex Kim', email: 'alex@flowboard.com', role: 'Member', status: 'active' },
    { id: 'tm5', name: 'Emma Davis', email: 'emma@flowboard.com', role: 'Member', status: 'invited' },
  ],
  
  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),
  
  updateProject: (id, updates) => set((state) => ({
    projects: state.projects.map((p) => p.id === id ? { ...p, ...updates } : p),
  })),
  
  deleteProject: (id) => set((state) => ({
    projects: state.projects.filter((p) => p.id !== id),
  })),
  
  duplicateProject: (id) => set((state) => {
    const project = state.projects.find((p) => p.id === id);
    if (!project) return state;
    const newId = Date.now().toString();
    const newProject: Project = {
      ...project,
      id: newId,
      boardId: newId,
      name: `${project.name} (Copy)`,
      tasks: project.tasks.map((t) => ({ ...t, id: `${t.id}-copy-${newId}` })),
    };
    return { projects: [...state.projects, newProject] };
  }),
  
  addMemberToProject: (projectId, member) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, members: [...p.members, member] } : p
    ),
  })),
  
  removeMemberFromProject: (projectId, memberId) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, members: p.members.filter((m) => m.id !== memberId) } : p
    ),
  })),
  
  addColumnToProject: (projectId, column) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, columns: [...p.columns, column] } : p
    ),
  })),
  
  renameColumn: (projectId, columnId, newTitle) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId
        ? { ...p, columns: p.columns.map((c) => c.id === columnId ? { ...c, title: newTitle } : c) }
        : p
    ),
  })),
  
  deleteColumn: (projectId, columnId) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId
        ? {
            ...p,
            columns: p.columns.filter((c) => c.id !== columnId),
            tasks: p.tasks.filter((t) => t.columnId !== columnId),
          }
        : p
    ),
  })),
  
  addTask: (projectId, task) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p
    ),
  })),
  
  updateTask: (projectId, task) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.map((t) => t.id === task.id ? task : t) }
        : p
    ),
  })),
  
  deleteTask: (projectId, taskId) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p
    ),
  })),
  
  moveTask: (projectId, taskId, newColumnId) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.map((t) => t.id === taskId ? { ...t, columnId: newColumnId } : t) }
        : p
    ),
  })),
  
  addDecision: (projectId, decision) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId ? { ...p, decisions: [...p.decisions, decision] } : p
    ),
  })),
  
  setProjects: (projects) => set({ projects }),
  
  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
  
  addTeamMember: (member) => set((state) => ({
    teamMembers: [...state.teamMembers, member],
  })),
  
  removeTeamMember: (memberId) => set((state) => ({
    teamMembers: state.teamMembers.filter((m) => m.id !== memberId),
  })),
  
  // Real-time update methods for WebSocket board changes
  addCardToBoard: (card) => set((state) => {
    // Find the project and stage based on the card data
    const updatedProjects = state.projects.map((project) => {
      const column = project.columns.find((col) => col.id === card.stageId);
      if (!column) return project;
      
      const newTask: BoardTask = {
        id: card.id,
        title: card.title,
        description: card.description || '',
        assignee: card.assigneeId ? {
          id: card.assigneeId,
          name: card.assigneeName || 'Unassigned',
        } : undefined,
        priority: card.priority || 'MEDIUM',
        createdDate: card.createdDate || new Date().toISOString(),
        columnId: card.stageId,
      };
      
      return {
        ...project,
        tasks: [...project.tasks, newTask],
      };
    });
    return { projects: updatedProjects };
  }),
  
  updateCardFromRealTime: (card) => set((state) => {
    console.log('[STORE] updateCardFromRealTime called with card:', card);
    console.log('[STORE] Current projects:', state.projects);
    const updatedProjects = state.projects.map((project) => {
      const taskIndex = project.tasks.findIndex((t) => t.id === card.id);
      if (taskIndex === -1) {
        console.log('[STORE] Card not found in project', project.id);
        return project;
      }
      
      const oldTask = project.tasks[taskIndex];
      console.log('[STORE] Found task in project', project.id, 'oldTask:', oldTask);
      console.log('[STORE] Project columns:', project.columns);
      console.log('[STORE] Updating columnId from', oldTask.columnId, 'to', card.stageId);
      
      // Check if the stageId matches a column in this project
      const columnExists = project.columns.some(col => col.id === card.stageId);
      console.log('[STORE] Column exists for stageId', card.stageId, '?', columnExists);
      
      const updatedTasks = [...project.tasks];
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        title: card.title,
        description: card.description || '',
        assignee: card.assigneeId ? {
          id: card.assigneeId,
          name: card.assigneeName || 'Unassigned',
        } : undefined,
        priority: card.priority || 'MEDIUM',
        columnId: card.stageId,  // CRITICAL: Update the stage/column ID when card moves
      };
      
      console.log('[STORE] Updated task:', updatedTasks[taskIndex]);
      return { ...project, tasks: updatedTasks };
    });
    console.log('[STORE] Projects after update:', updatedProjects);
    return { projects: updatedProjects };
  }),
  
  deleteCardFromRealTime: (stageId, cardId) => set((state) => ({
    projects: state.projects.map((p) => ({
      ...p,
      tasks: p.tasks.filter((t) => t.id !== cardId),
    })),
  })),
  
  addStageToBoard: (stage) => set((state) => {
    const updatedProjects = state.projects.map((project) => {
      const newColumn: BoardColumn = {
        id: stage.id,
        title: stage.title,
        color: stage.color || '#000000',
      };
      
      return {
        ...project,
        columns: [...project.columns, newColumn],
      };
    });
    return { projects: updatedProjects };
  }),
  
  updateStageFromRealTime: (stage) => set((state) => {
    const updatedProjects = state.projects.map((project) => {
      const columnIndex = project.columns.findIndex((c) => c.id === stage.id);
      if (columnIndex === -1) return project;
      
      const updatedColumns = [...project.columns];
      updatedColumns[columnIndex] = {
        ...updatedColumns[columnIndex],
        title: stage.title,
        color: stage.color || updatedColumns[columnIndex].color,
      };
      
      return { ...project, columns: updatedColumns };
    });
    return { projects: updatedProjects };
  }),
  
  deleteStageFromBoard: (stageId) => set((state) => ({
    projects: state.projects.map((p) => ({
      ...p,
      columns: p.columns.filter((c) => c.id !== stageId),
      tasks: p.tasks.filter((t) => t.columnId !== stageId),
    })),
  })),
  
  // Team member real-time handlers
  addTeamMemberToProject: (projectId, memberId, member) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId 
        ? { ...p, members: [...p.members, { id: memberId, name: member.name, email: member.email, role: member.role || 'viewer' }] }
        : p
    ),
  })),
  
  removeTeamMemberFromProject: (projectId, memberId) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId 
        ? { ...p, members: p.members.filter((m) => m.id !== memberId) }
        : p
    ),
  })),
  
  updateTeamMemberRole: (projectId, memberId, newRole) => set((state) => ({
    projects: state.projects.map((p) =>
      p.id === projectId 
        ? { 
            ...p, 
            members: p.members.map((m) => 
              m.id === memberId ? { ...m, role: newRole as any } : m
            ) 
          }
        : p
    ),
  })),
}));