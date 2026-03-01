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

// Default mock members
const defaultMembers: ProjectMember[] = [
  { id: 'm1', name: 'John Doe', email: 'john@example.com', role: 'owner' },
  { id: 'm2', name: 'Sarah Chen', email: 'sarah@example.com', role: 'editor' },
  { id: 'm3', name: 'Mike Johnson', email: 'mike@example.com', role: 'editor' },
];

const initialProjects: Project[] = [
  {
    id: '1',
    name: 'Website Redesign',
    description: 'Complete redesign of the company website with modern UI/UX principles',
    boardId: '1',
    members: [
      ...defaultMembers,
      { id: 'm4', name: 'Alex Kim', email: 'alex@example.com', role: 'editor' },
      { id: 'm5', name: 'Emma Davis', email: 'emma@example.com', role: 'viewer' },
    ],
    columns: [
      { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
      { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
      { id: 'review', title: 'Review', color: 'bg-yellow-100' },
      { id: 'done', title: 'Done', color: 'bg-green-100' },
    ],
    tasks: [
      {
        id: 't1',
        title: 'Design homepage mockup',
        description: 'Create high-fidelity mockups for the new homepage design',
        assignee: { name: 'Sarah Chen' },
        priority: 'HIGH',
        createdDate: '2026-02-20',
        columnId: 'todo',
      },
      {
        id: 't2',
        title: 'Set up project repository',
        description: 'Initialize Git repository and set up project structure',
        assignee: { name: 'Mike Johnson' },
        priority: 'CRITICAL',
        createdDate: '2026-02-21',
        columnId: 'todo',
      },
      {
        id: 't3',
        title: 'Implement authentication',
        description: 'Build user authentication system with JWT tokens',
        assignee: { name: 'Alex Kim' },
        priority: 'HIGH',
        createdDate: '2026-02-22',
        columnId: 'in-progress',
      },
      {
        id: 't4',
        title: 'Write API documentation',
        description: 'Document all API endpoints with examples',
        assignee: { name: 'Emma Davis' },
        priority: 'MEDIUM',
        createdDate: '2026-02-18',
        columnId: 'in-progress',
      },
      {
        id: 't5',
        title: 'Code review - User module',
        description: 'Review pull request for user management module',
        assignee: { name: 'David Lee' },
        priority: 'MEDIUM',
        createdDate: '2026-02-15',
        columnId: 'review',
      },
      {
        id: 't6',
        title: 'Database schema design',
        description: 'Completed initial database schema and migrations',
        assignee: { name: 'Lisa Wang' },
        priority: 'HIGH',
        createdDate: '2026-02-10',
        columnId: 'done',
      },
    ],
    decisions: [
      {
        id: 'd1',
        description: 'Move forward with React 19 migration',
        meetingId: 'm1',
        meetingTitle: 'Q1 Product Planning Meeting',
        sourceContext: 'Technical stack discussion',
        approvedAt: '2026-02-28',
        approvedBy: 'Team Consensus',
      },
      {
        id: 'd2',
        description: 'Decided on the tech stack for the project',
        meetingId: 'm2',
        meetingTitle: 'Tech Stack Selection Meeting',
        sourceContext: 'Technology evaluation',
        approvedAt: '2026-02-15',
        approvedBy: 'John Doe',
      },
    ],
  },
  {
    id: '2',
    name: 'Mobile App Development',
    description: 'Build a cross-platform mobile application for iOS and Android',
    boardId: '2',
    members: defaultMembers.slice(0, 2),
    columns: [
      { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
      { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
      { id: 'review', title: 'Review', color: 'bg-yellow-100' },
      { id: 'done', title: 'Done', color: 'bg-green-100' },
    ],
    tasks: [
      {
        id: 't7',
        title: 'Define app architecture',
        description: 'Choose tech stack and define the app architecture',
        assignee: { name: 'John Doe' },
        priority: 'HIGH',
        createdDate: '2026-02-25',
        columnId: 'todo',
      },
      {
        id: 't8',
        title: 'Create wireframes',
        description: 'Design wireframes for all major screens',
        assignee: { name: 'Sarah Chen' },
        priority: 'MEDIUM',
        createdDate: '2026-02-26',
        columnId: 'todo',
      },
    ],
    decisions: [
      {
        id: 'd3',
        description: 'Approved the project scope and timeline',
        meetingId: 'm3',
        meetingTitle: 'Project Kickoff Meeting',
        sourceContext: 'Project planning',
        approvedAt: '2026-02-25',
        approvedBy: 'John Doe',
      },
      {
        id: 'd4',
        description: 'Decided on the tech stack for the project',
        meetingId: 'm4',
        meetingTitle: 'Tech Stack Selection Meeting',
        sourceContext: 'Technology evaluation',
        approvedAt: '2026-02-26',
        approvedBy: 'Sarah Chen',
      },
    ],
  },
  {
    id: '3',
    name: 'Marketing Campaign Q1',
    description: 'Launch new marketing campaign for Q1 with social media strategy',
    boardId: '3',
    members: defaultMembers,
    columns: [
      { id: 'todo', title: 'To Do', color: 'bg-gray-100' },
      { id: 'in-progress', title: 'In Progress', color: 'bg-blue-100' },
      { id: 'done', title: 'Done', color: 'bg-green-100' },
    ],
    tasks: [
      {
        id: 't9',
        title: 'Create social media calendar',
        description: 'Plan content for all social media channels',
        assignee: { name: 'Mike Johnson' },
        priority: 'HIGH',
        createdDate: '2026-02-15',
        columnId: 'done',
      },
    ],
    decisions: [
      {
        id: 'd5',
        description: 'Approved the project scope and timeline',
        meetingId: 'm5',
        meetingTitle: 'Project Kickoff Meeting',
        sourceContext: 'Campaign planning',
        approvedAt: '2026-02-15',
        approvedBy: 'John Doe',
      },
      {
        id: 'd6',
        description: 'Decided on the tech stack for the project',
        meetingId: 'm6',
        meetingTitle: 'Strategy Alignment Meeting',
        sourceContext: 'Tools selection',
        approvedAt: '2026-02-20',
        approvedBy: 'Sarah Chen',
      },
    ],
  },
];

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
  
  updateUser: (updates: Partial<UserProfile>) => void;
  addTeamMember: (member: TeamMember) => void;
  removeTeamMember: (memberId: string) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: initialProjects,
  user: {
    name: 'John Doe',
    email: 'john.doe@flowboard.com',
    role: 'Manager',
  },
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
  
  updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
  
  addTeamMember: (member) => set((state) => ({
    teamMembers: [...state.teamMembers, member],
  })),
  
  removeTeamMember: (memberId) => set((state) => ({
    teamMembers: state.teamMembers.filter((m) => m.id !== memberId),
  })),
}));