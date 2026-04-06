import { create } from 'zustand';
import { BoardTask } from './projectStore';

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
  before?: Partial<BoardTask> | { columnId: string; columnTitle: string };
  after?: Partial<BoardTask> | { columnId: string; columnTitle: string };
  affectedCards: string[];
  affectedStages: string[];
  affectedMembers: string[];
  riskLevel: RiskLevel;
  approvals: {
    userId: string;
    userName: string;
    status: 'pending' | 'approved' | 'rejected';
    timestamp?: string;
    feedback?: string;
  }[];
  requiredApprovals: number;
  appliedAt?: string;
  appliedBy?: string;
  rollbackAvailable: boolean;
  isAppliedToBoard?: boolean;
}

interface ChangeStore {
  changes: ChangeRequest[];
  setChanges: (changes: ChangeRequest[]) => void;
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
  changes: [],

  setChanges: (changes) => set({ changes }),

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

        const hasMatchingApprover = change.approvals.some((approval) => approval.userId === userId);
        if (!hasMatchingApprover) {
          return change;
        }

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
        change.id === changeId && (change.status === 'READY_FOR_APPLICATION' || change.status === 'APPROVED')
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
