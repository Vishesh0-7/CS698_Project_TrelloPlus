import type { BoardTask, Project, ProjectMember } from '../store/projectStore';

const API_BASE_URL = 'http://localhost:8080/api/v1';
const REQUEST_TIMEOUT_MS = 15000;

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
}

interface AuthResponse {
  token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    username: string;
    fullName?: string;
    role: string;
    created_at: string;
  };
}

interface CreateProjectRequest {
  name: string;
  description: string;
  generateTasks?: boolean;
}

interface ProjectResponse {
  id: string;
  name: string;
  description: string;
  board_id: string;
  members: Array<{
    id: string;
    email: string;
    username: string;
    fullName?: string;
    role: string;
    created_at: string;
  }>;
  columns: Array<{
    id: string;
    title: string;
    color: string;
    cards: Array<{
      id: string;
      title: string;
      description: string;
      priority: string;
      column_id: string;
      created_at: string;
    }>;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    priority: string;
    column_id: string;
    created_at: string;
    assignee?: {
      id: string;
      email?: string;
      username?: string;
      fullName?: string;
    };
  }>;
  created_at: string;
}

interface CardRequest {
  title: string;
  description: string;
  priority: string;
  assignee_id?: string | null;
}

interface MoveCardRequest {
  target_stage_id: string;
}

interface StageRequest {
  title: string;
  color: string;
}

interface UpdateProjectRequest {
  name: string;
  description: string;
}

const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

const parseErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const error = await response.json();
    if (typeof error?.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }
    if (typeof error?.detail === 'string' && error.detail.trim().length > 0) {
      return error.detail;
    }
    if (typeof error?.error_description === 'string' && error.error_description.trim().length > 0) {
      return error.error_description;
    }
    if (typeof error?.error === 'string' && error.error.trim().length > 0) {
      return error.error;
    }
    return fallback;
  } catch {
    return fallback;
  }
};

const parseApiErrorMessage = async (response: Response, fallback: string): Promise<string> => {
  if (response.status === 401) {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    return 'Session expired. Please sign in again.';
  }

  if (response.status === 403) {
    return parseErrorMessage(response, 'You do not have permission to perform this action.');
  }

  if (response.status === 409) {
    return parseErrorMessage(response, 'This action conflicts with existing data.');
  }

  if (response.status === 429) {
    return parseErrorMessage(response, 'Too many requests. Please wait and try again.');
  }

  return parseErrorMessage(response, fallback);
};

const requestWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const mapMemberRole = (role: string): ProjectMember['role'] => {
  const normalized = role.toLowerCase();
  if (normalized === 'owner') return 'owner';
  if (normalized === 'viewer') return 'viewer';
  return 'editor';
};

export const mapCardResponseToTask = (task: ProjectResponse['tasks'][number]): BoardTask => ({
  id: task.id,
  title: task.title,
  description: task.description,
  assignee: task.assignee
    ? {
        id: task.assignee.id,
        name: task.assignee.fullName || task.assignee.username || task.assignee.email || 'Unknown User',
      }
    : undefined,
  priority: task.priority as BoardTask['priority'],
  columnId: task.column_id,
  createdDate: task.created_at,
});

export const mapProjectResponseToProject = (response: ProjectResponse): Project => ({
  id: response.id,
  name: response.name,
  description: response.description,
  boardId: response.board_id,
  members: response.members.map((m) => ({
    id: m.id,
    name: m.fullName || m.username,
    email: m.email,
    role: mapMemberRole(m.role),
  })),
  columns: response.columns.map((c) => ({
    id: c.id,
    title: c.title,
    color: c.color,
  })),
  tasks: response.tasks.map(mapCardResponseToTask),
  decisions: [],
});

export const apiService = {
  // Auth endpoints
  async register(request: RegisterRequest): Promise<AuthResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, 'Registration failed'));
    }

    return response.json();
  },

  async login(request: LoginRequest): Promise<AuthResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response, 'Login failed'));
    }

    return response.json();
  },

  async logout(): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok && response.status !== 401) {
      throw new Error(await parseApiErrorMessage(response, 'Logout failed'));
    }
  },

  // Project endpoints
  async createProject(request: CreateProjectRequest): Promise<ProjectResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Project creation failed'));
    }

    return response.json();
  },

  async getUserProjects(): Promise<ProjectResponse[]> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch projects'));
    }

    return response.json();
  },

  async getProject(projectId: string): Promise<ProjectResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch project'));
    }

    return response.json();
  },

  async updateProject(projectId: string, request: UpdateProjectRequest): Promise<ProjectResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update project'));
    }

    return response.json();
  },

  async deleteProject(projectId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to delete project'));
    }
  },

  // Board endpoints
  async addStage(boardId: string, request: StageRequest): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/${boardId}/stages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to add stage'));
    }

    return response.json();
  },

  async renameStage(stageId: string, request: { title: string }): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/stages/${stageId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to rename stage'));
    }

    return response.json();
  },

  async deleteStage(stageId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/stages/${stageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to delete stage'));
    }
  },

  // Card endpoints
  async createCard(stageId: string, request: CardRequest): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/stages/${stageId}/cards`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to create card'));
    }

    return response.json();
  },

  async updateCard(cardId: string, request: CardRequest): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/cards/${cardId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update card'));
    }

    return response.json();
  },

  async moveCard(cardId: string, request: MoveCardRequest): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/cards/${cardId}/move`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to move card'));
    }

    return response.json();
  },

  async deleteCard(cardId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/boards/cards/${cardId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to delete card'));
    }
  },

  // User profile endpoints
  async getUserProfile(): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/auth/profile`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch user profile'));
    }

    return response.json();
  },

  async updateUserProfile(request: { fullName: string; email: string }): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update user profile'));
    }

    return response.json();
  },

  // Team member endpoints
  async getProjectMembers(projectId: string): Promise<any[]> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}/members`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch project members'));
    }

    return response.json();
  },

  async addTeamMember(projectId: string, email: string, fullName: string, role: 'editor' | 'viewer'): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}/members`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, fullName, role }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to add team member'));
    }

    return response.json();
  },

  async removeTeamMember(projectId: string, userId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to remove team member'));
    }
  },

  async updateTeamMemberRole(projectId: string, userId: string, role: 'editor' | 'viewer'): Promise<any> {
    const response = await requestWithTimeout(`${API_BASE_URL}/projects/${projectId}/members/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ role }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update team member role'));
    }

    return response.json();
  },
};
