import { create } from 'zustand';
import { BoardTask, BoardColumn } from './projectStore';

export type ChangeType = 'MOVE_CARD' | 'UPDATE_CARD' | 'CREATE_CARD' | 'DELETE_CARD';
export type ChangeStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'READY_FOR_APPLICATION' | 'APPLIED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ChangeRequest {
  id: string;
  meetingId: string;
  meetingTitle: string;
  type: ChangeType;
  status: ChangeStatus;
  requestedBy: string;
  requestedAt: string;
  projectId: string;
  
  // Before/After state
  before?: Partial<BoardTask> | { columnId: string; columnTitle: string };
  after?: Partial<BoardTask> | { columnId: string; columnTitle: string };
  
  // Impact analysis
  affectedCards: string[];
  affectedStages: string[];
  affectedMembers: string[];
  riskLevel: RiskLevel;
  
  // Approval workflow
  approvals: {
    userId: string;
    userName: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: string;
    feedback?: string;
  }[];
  requiredApprovals: number;
  
  // Applied state
  appliedAt?: string;
  appliedBy?: string;
  rollbackAvailable: boolean;
  isAppliedToBoard?: boolean;
}

const mockChanges: ChangeRequest[] = [
  {
    id: 'ch1',
    meetingId: 'm1',
    meetingTitle: 'Q1 Product Planning Meeting',
    type: 'MOVE_CARD',
    status: 'PENDING',
    requestedBy: 'Sarah Chen',
    requestedAt: '2026-02-28T15:30:00Z',
    projectId: '1',
    before: {
      id: 't1',
      title: 'Design homepage mockup',
      description: 'Create high-fidelity mockups for the new homepage design',
      assignee: { name: 'Sarah Chen' },
      priority: 'HIGH',
      columnId: 'todo',
    },
    after: {
      id: 't1',
      title: 'Design homepage mockup',
      description: 'Create high-fidelity mockups for the new homepage design',
      assignee: { name: 'Sarah Chen' },
      priority: 'HIGH',
      columnId: 'in-progress',
    },
    affectedCards: ['t1'],
    affectedStages: ['To Do', 'In Progress'],
    affectedMembers: ['Sarah Chen'],
    riskLevel: 'LOW',
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'pending' },
      { userId: 'u2', userName: 'Mike Johnson', status: 'pending' },
      { userId: 'u3', userName: 'Alex Kim', status: 'pending' },
    ],
    requiredApprovals: 2,
    rollbackAvailable: false,
  },
  {
    id: 'ch2',
    meetingId: 'm1',
    meetingTitle: 'Q1 Product Planning Meeting',
    type: 'UPDATE_CARD',
    status: 'UNDER_REVIEW',
    requestedBy: 'Mike Johnson',
    requestedAt: '2026-02-28T16:00:00Z',
    projectId: '1',
    before: {
      id: 't3',
      title: 'Implement authentication',
      description: 'Build user authentication system with JWT tokens',
      assignee: { name: 'Alex Kim' },
      priority: 'HIGH',
    },
    after: {
      id: 't3',
      title: 'Implement authentication & authorization',
      description: 'Build comprehensive auth system with JWT tokens, role-based access control, and OAuth integration',
      assignee: { name: 'Alex Kim' },
      priority: 'CRITICAL',
    },
    affectedCards: ['t3'],
    affectedStages: ['In Progress'],
    affectedMembers: ['Alex Kim', 'Mike Johnson'],
    riskLevel: 'MEDIUM',
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-28T16:30:00Z' },
      { userId: 'u2', userName: 'Mike Johnson', status: 'pending' },
      { userId: 'u3', userName: 'Alex Kim', status: 'pending' },
    ],
    requiredApprovals: 2,
    rollbackAvailable: false,
  },
  {
    id: 'ch3',
    meetingId: 'm1',
    meetingTitle: 'Q1 Product Planning Meeting',
    type: 'CREATE_CARD',
    status: 'APPROVED',
    requestedBy: 'John Doe',
    requestedAt: '2026-02-28T14:00:00Z',
    projectId: '1',
    after: {
      id: 't10',
      title: 'Implement dark mode support',
      description: 'Add dark mode theme toggle across entire application',
      assignee: { name: 'Sarah Chen' },
      priority: 'MEDIUM',
      columnId: 'todo',
    },
    affectedCards: [],
    affectedStages: ['To Do'],
    affectedMembers: ['Team'],
    riskLevel: 'LOW',
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-28T14:15:00Z' },
      { userId: 'u2', userName: 'Mike Johnson', status: 'approved', timestamp: '2026-02-28T14:30:00Z' },
      { userId: 'u3', userName: 'Alex Kim', status: 'approved', timestamp: '2026-02-28T14:45:00Z' },
    ],
    requiredApprovals: 2,
    rollbackAvailable: false,
  },
  {
    id: 'ch4',
    meetingId: 'm1',
    meetingTitle: 'Q1 Product Planning Meeting',
    type: 'MOVE_CARD',
    status: 'READY_FOR_APPLICATION',
    requestedBy: 'Alex Kim',
    requestedAt: '2026-02-28T13:00:00Z',
    projectId: '1',
    before: {
      id: 't2',
      title: 'Set up project repository',
      description: 'Initialize Git repository and set up project structure',
      assignee: { name: 'Mike Johnson' },
      priority: 'CRITICAL',
      columnId: 'todo',
    },
    after: {
      id: 't2',
      title: 'Set up project repository',
      description: 'Initialize Git repository and set up project structure',
      assignee: { name: 'Mike Johnson' },
      priority: 'CRITICAL',
      columnId: 'done',
    },
    affectedCards: ['t2'],
    affectedStages: ['To Do', 'Done'],
    affectedMembers: ['Mike Johnson'],
    riskLevel: 'LOW',
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-28T13:15:00Z' },
      { userId: 'u2', userName: 'Mike Johnson', status: 'approved', timestamp: '2026-02-28T13:20:00Z' },
      { userId: 'u3', userName: 'Alex Kim', status: 'approved', timestamp: '2026-02-28T13:25:00Z' },
    ],
    requiredApprovals: 2,
    rollbackAvailable: false,
  },
];

interface ChangeStore {
  changes: ChangeRequest[];
  getChangesByMeeting: (meetingId: string) => ChangeRequest[];
  getChangeById: (changeId: string) => ChangeRequest | undefined;
  approveChange: (changeId: string, userId: string, userName: string, feedback?: string) => void;
  rejectChange: (changeId: string, userId: string, userName: string, feedback: string) => void;
  batchApprove: (changeIds: string[], userId: string, userName: string) => void;
  applyChange: (changeId: string, userId: string, userName: string) => void;
  rollbackChange: (changeId: string) => void;
  addChange: (change: ChangeRequest) => void;
  toggleBoardApplication: (changeId: string) => void;
}

export const useChangeStore = create<ChangeStore>((set, get) => ({
  changes: mockChanges,
  
  getChangesByMeeting: (meetingId) => {
    return get().changes.filter((c) => c.meetingId === meetingId);
  },
  
  getChangeById: (changeId) => {
    return get().changes.find((c) => c.id === changeId);
  },
  
  approveChange: (changeId, userId, userName, feedback) => {
    set((state) => ({
      changes: state.changes.map((change) => {
        if (change.id !== changeId) return change;
        
        const updatedApprovals = change.approvals.map((approval) =>
          approval.userId === userId
            ? { ...approval, status: 'approved' as const, timestamp: new Date().toISOString(), feedback }
            : approval
        );
        
        const approvedCount = updatedApprovals.filter((a) => a.status === 'approved').length;
        const newStatus = approvedCount >= change.requiredApprovals ? 'READY_FOR_APPLICATION' : 'UNDER_REVIEW';
        
        return {
          ...change,
          approvals: updatedApprovals,
          status: newStatus,
        };
      }),
    }));
  },
  
  rejectChange: (changeId, userId, userName, feedback) => {
    set((state) => ({
      changes: state.changes.map((change) => {
        if (change.id !== changeId) return change;
        
        const updatedApprovals = change.approvals.map((approval) =>
          approval.userId === userId
            ? { ...approval, status: 'rejected' as const, timestamp: new Date().toISOString(), feedback }
            : approval
        );
        
        return {
          ...change,
          approvals: updatedApprovals,
          status: 'REJECTED',
        };
      }),
    }));
  },
  
  batchApprove: (changeIds, userId, userName) => {
    changeIds.forEach((changeId) => {
      get().approveChange(changeId, userId, userName);
    });
  },
  
  applyChange: (changeId, userId, userName) => {
    set((state) => ({
      changes: state.changes.map((change) =>
        change.id === changeId
          ? {
              ...change,
              status: 'APPLIED',
              appliedAt: new Date().toISOString(),
              appliedBy: userName,
              rollbackAvailable: true,
            }
          : change
      ),
    }));
  },
  
  rollbackChange: (changeId) => {
    set((state) => ({
      changes: state.changes.map((change) =>
        change.id === changeId
          ? {
              ...change,
              status: 'READY_FOR_APPLICATION',
              appliedAt: undefined,
              appliedBy: undefined,
              rollbackAvailable: false,
            }
          : change
      ),
    }));
  },
  
  addChange: (change) => {
    set((state) => ({
      changes: [...state.changes, change],
    }));
  },
  
  toggleBoardApplication: (changeId) => {
    set((state) => ({
      changes: state.changes.map((change) =>
        change.id === changeId
          ? {
              ...change,
              isAppliedToBoard: !change.isAppliedToBoard,
            }
          : change
      ),
    }));
  },
}));