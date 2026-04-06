import { beforeEach, describe, expect, it } from 'vitest';
import { useChangeStore, type ChangeRequest } from './changeStore';

function buildChange(overrides: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: 'change-1',
    meetingId: 'meeting-1',
    meetingTitle: 'Sprint Sync',
    type: 'UPDATE_CARD',
    status: 'PENDING',
    requestedBy: 'system',
    requestedAt: new Date('2026-04-04T10:00:00.000Z').toISOString(),
    projectId: 'project-1',
    before: { id: 'card-1', title: 'Old title' },
    after: { id: 'card-1', title: 'New title' },
    affectedCards: ['card-1'],
    affectedStages: [],
    affectedMembers: [],
    riskLevel: 'LOW',
    approvals: [
      { userId: 'u-1', userName: 'Ava', status: 'pending' },
      { userId: 'u-2', userName: 'Ben', status: 'pending' },
    ],
    requiredApprovals: 2,
    rollbackAvailable: false,
    ...overrides,
  };
}

describe('useChangeStore (User Story 3)', () => {
  beforeEach(() => {
    useChangeStore.setState({ changes: [] });
  });

  it('approves a change and moves it to UNDER_REVIEW until quorum is met', () => {
    useChangeStore.getState().setChanges([buildChange()]);

    useChangeStore.getState().approveChange('change-1', 'u-1', 'Ava');

    const change = useChangeStore.getState().getChangeById('change-1');
    expect(change?.status).toBe('UNDER_REVIEW');
    expect(change?.approvals.find((a) => a.userId === 'u-1')?.status).toBe('approved');
  });

  it('marks change READY_FOR_APPLICATION when required approvals are reached', () => {
    useChangeStore.getState().setChanges([buildChange()]);

    useChangeStore.getState().approveChange('change-1', 'u-1', 'Ava');
    useChangeStore.getState().approveChange('change-1', 'u-2', 'Ben');

    const change = useChangeStore.getState().getChangeById('change-1');
    expect(change?.status).toBe('READY_FOR_APPLICATION');
  });

  it('rejects a change and stores feedback', () => {
    useChangeStore.getState().setChanges([buildChange()]);

    useChangeStore.getState().rejectChange('change-1', 'u-2', 'Ben', 'Conflicts with board state');

    const change = useChangeStore.getState().getChangeById('change-1');
    expect(change?.status).toBe('REJECTED');
    expect(change?.approvals.find((a) => a.userId === 'u-2')?.status).toBe('rejected');
    expect(change?.approvals.find((a) => a.userId === 'u-2')?.feedback).toBe('Conflicts with board state');
  });

  it('batch approves multiple changes', () => {
    useChangeStore.getState().setChanges([
      buildChange({ id: 'change-1', requiredApprovals: 1 }),
      buildChange({ id: 'change-2', requiredApprovals: 1 }),
    ]);

    useChangeStore.getState().batchApprove(['change-1', 'change-2'], 'u-1', 'Ava');

    expect(useChangeStore.getState().getChangeById('change-1')?.status).toBe('READY_FOR_APPLICATION');
    expect(useChangeStore.getState().getChangeById('change-2')?.status).toBe('READY_FOR_APPLICATION');
  });

  it('applies and rolls back a ready change', () => {
    useChangeStore.getState().setChanges([
      buildChange({ status: 'READY_FOR_APPLICATION', requiredApprovals: 1 }),
    ]);

    useChangeStore.getState().applyChange('change-1', 'u-1', 'Ava');
    const applied = useChangeStore.getState().getChangeById('change-1');
    expect(applied?.status).toBe('APPLIED');
    expect(applied?.appliedBy).toBe('Ava');
    expect(applied?.rollbackAvailable).toBe(true);

    useChangeStore.getState().rollbackChange('change-1');
    const rolledBack = useChangeStore.getState().getChangeById('change-1');
    expect(rolledBack?.status).toBe('READY_FOR_APPLICATION');
    expect(rolledBack?.rollbackAvailable).toBe(false);
  });

  it('does not mutate data when change id does not exist', () => {
    const original = buildChange();
    useChangeStore.getState().setChanges([original]);

    useChangeStore.getState().approveChange('missing-change', 'u-1', 'Ava');

    expect(useChangeStore.getState().getChangeById('change-1')).toEqual(original);
  });

  it('filters changes by meeting id', () => {
    useChangeStore.getState().setChanges([
      buildChange({ id: 'change-1', meetingId: 'meeting-1' }),
      buildChange({ id: 'change-2', meetingId: 'meeting-2' }),
    ]);

    const meetingOneChanges = useChangeStore.getState().getChangesByMeeting('meeting-1');

    expect(meetingOneChanges).toHaveLength(1);
    expect(meetingOneChanges[0]?.id).toBe('change-1');
  });

  it('adds a new change and toggles board application state', () => {
    useChangeStore.getState().addChange(buildChange({ id: 'change-new' }));

    let created = useChangeStore.getState().getChangeById('change-new');
    expect(created).toBeDefined();
    expect(created?.isAppliedToBoard).toBeUndefined();

    useChangeStore.getState().toggleBoardApplication('change-new');
    created = useChangeStore.getState().getChangeById('change-new');
    expect(created?.isAppliedToBoard).toBe(true);

    useChangeStore.getState().toggleBoardApplication('change-new');
    created = useChangeStore.getState().getChangeById('change-new');
    expect(created?.isAppliedToBoard).toBe(false);
  });

  it('applies changes in APPROVED status', () => {
    useChangeStore.getState().setChanges([
      buildChange({ status: 'APPROVED', requiredApprovals: 2 }),
    ]);

    useChangeStore.getState().applyChange('change-1', 'u-1', 'Ava');

    const applied = useChangeStore.getState().getChangeById('change-1');
    expect(applied?.status).toBe('APPLIED');
    expect(applied?.appliedBy).toBe('Ava');
    expect(applied?.rollbackAvailable).toBe(true);
  });
});
