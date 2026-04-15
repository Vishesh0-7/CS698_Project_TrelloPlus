import type { BoardTask, Project, ProjectMember } from '../store/projectStore';
import { API_BASE_URL } from './runtimeConfig';

const parseTimeout = (value: string | undefined, fallbackMs: number): number => {
  if (!value) {
    return fallbackMs;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallbackMs;
  }

  return Math.floor(parsed);
};

const REQUEST_TIMEOUT_MS = parseTimeout(import.meta.env.VITE_REQUEST_TIMEOUT_MS, 15000);
const LLM_REQUEST_TIMEOUT_MS = parseTimeout(import.meta.env.VITE_LLM_REQUEST_TIMEOUT_MS, 60000);

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

export interface ProjectResponse {
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

export interface MeetingUserResponse {
  id: string;
  username: string;
  email: string;
}

export interface MeetingResponse {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  platform?: string;
  meetingLink?: string;
  status: string;
  createdByName?: string;
  createdAt: string;
  members: MeetingUserResponse[];
}

export interface CreateMeetingApiRequest {
  projectId: string;
  title: string;
  description?: string;
  meetingDate: string;
  meetingTime: string;
  platform?: string;
  meetingLink?: string;
  additionalMemberIds?: string[];
}

export interface UpdateMeetingApiRequest {
  title: string;
  description?: string;
  meetingDate: string;
  meetingTime?: string;
  platform?: string;
  meetingLink?: string;
}

export interface EndMeetingApiRequest {
  meetingId: string;
  transcript: string;
}

export interface SummaryItemDTO {
  id: string;
  description: string;
  sourceContext?: string;
  approvalStatus?: 'PENDING' | 'APPROVED';
  status?: string;
  createdAt?: string;
}

export interface MeetingSummaryResponse {
  id: string;
  meetingId: string;
  status: string;
  aiGeneratedContent?: string;
  generatedAt?: string;
  approvedAt?: string;
  actionItems: SummaryItemDTO[];
  decisions: SummaryItemDTO[];
  changes: Array<{
    id: string;
    meetingId: string;
    changeType: string;
    beforeState?: string;
    afterState?: string;
    status: string;
    createdAt: string;
  }>;
}

export interface ApprovalStatusResponse {
  meetingId: string;
  requiredApprovals: number;
  currentApprovedCount: number;
  currentRejectedCount: number;
  totalApproversNeeded: number;
  responses: Array<{
    userId: string;
    userName: string;
    response: string;
    comments?: string;
    respondedAt?: string;
  }>;
}

export interface ChangeResponse {
  id: string;
  meetingId: string;
  changeType: string;
  beforeState?: string;
  afterState?: string;
  status: string;
  createdAt: string;
}

export interface ChangeApplyResultResponse {
  changeId: string;
  status: string;
  applied: boolean;
  message: string;
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
    }, LLM_REQUEST_TIMEOUT_MS);

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

  // Meeting endpoints
  async getMeetingsByProject(projectId: string): Promise<MeetingResponse[]> {
    const response = await requestWithTimeout(`${API_BASE_URL}/meetings/project/${projectId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch meetings'));
    }

    return response.json();
  },

  async createMeeting(request: CreateMeetingApiRequest): Promise<MeetingResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/meetings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to create meeting'));
    }

    return response.json();
  },

  async getMeeting(meetingId: string): Promise<MeetingResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/meetings/${meetingId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch meeting'));
    }

    return response.json();
  },

  async updateMeeting(meetingId: string, request: UpdateMeetingApiRequest): Promise<MeetingResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/meetings/${meetingId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update meeting'));
    }

    return response.json();
  },

  async deleteMeeting(meetingId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to delete meeting'));
    }
  },

  async endMeeting(meetingId: string, transcript: string): Promise<MeetingResponse> {
    const payload: EndMeetingApiRequest = { meetingId, transcript };
    const response = await requestWithTimeout(`${API_BASE_URL}/meetings/${meetingId}/end`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to submit transcript'));
    }

    return response.json();
  },

  async generateSummary(meetingId: string): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ meetingId }),
    }, LLM_REQUEST_TIMEOUT_MS);

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to generate summary'));
    }

    return response.json();
  },

  async getSummaryByMeeting(meetingId: string): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/meeting/${meetingId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch summary'));
    }

    return response.json();
  },

  async getApprovalStatus(meetingId: string): Promise<ApprovalStatusResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/approvals/summary/${meetingId}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch approval status'));
    }

    return response.json();
  },

  async submitSummaryApproval(meetingId: string, decision: 'APPROVED' | 'REJECTED', comments?: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/approvals/summary/${meetingId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ meetingId, response: decision, comments }),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to submit approval'));
    }
  },

  async approveActionItem(itemId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/approvals/items/action-items/${itemId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to approve action item'));
    }
  },

  async approveDecisionItem(itemId: string): Promise<void> {
    const response = await requestWithTimeout(`${API_BASE_URL}/approvals/items/decisions/${itemId}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to approve decision item'));
    }
  },

  async addActionItem(meetingId: string, request: { description: string; sourceContext?: string; priority?: string }): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/meeting/${meetingId}/action-items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to add action item'));
    }

    return response.json();
  },

  async updateActionItem(itemId: string, request: { description: string; sourceContext?: string; priority?: string }): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/action-items/${itemId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update action item'));
    }

    return response.json();
  },

  async deleteActionItem(itemId: string): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/action-items/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to delete action item'));
    }

    return response.json();
  },

  async addDecision(meetingId: string, request: { description: string; sourceContext?: string; impactSummary?: string }): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/meeting/${meetingId}/decisions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to add decision'));
    }

    return response.json();
  },

  async updateDecision(itemId: string, request: { description: string; sourceContext?: string; impactSummary?: string }): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/decisions/${itemId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to update decision'));
    }

    return response.json();
  },

  async deleteDecision(itemId: string): Promise<MeetingSummaryResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/summaries/decisions/${itemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to delete decision'));
    }

    return response.json();
  },

  async listChanges(params?: { meetingId?: string; projectId?: string; status?: string }): Promise<ChangeResponse[]> {
    const searchParams = new URLSearchParams();
    if (params?.meetingId) searchParams.set('meetingId', params.meetingId);
    if (params?.projectId) searchParams.set('projectId', params.projectId);
    if (params?.status) searchParams.set('status', params.status);

    const query = searchParams.toString();
    const response = await requestWithTimeout(`${API_BASE_URL}/changes${query ? `?${query}` : ''}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to fetch changes'));
    }

    return response.json();
  },

  async applyChange(changeId: string): Promise<ChangeApplyResultResponse> {
    const response = await requestWithTimeout(`${API_BASE_URL}/changes/${changeId}/apply`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(await parseApiErrorMessage(response, 'Failed to apply change to board'));
    }

    return response.json();
  },
};
