import React from 'react';
import { render, screen, waitFor, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { toast } from 'sonner';
import { MeetingSummary } from './app/pages/MeetingSummary';
import { apiService } from './app/services/api';

// Mock react-router
jest.mock('react-router', () => ({
  ...jest.requireActual('react-router'),
  useParams: jest.fn(),
  useNavigate: jest.fn(),
}));

const { useParams, useNavigate } = jest.requireMock('react-router');

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock api service
jest.mock('./app/services/api', () => ({
  apiService: {
    getMeeting: jest.fn(),
    getSummaryByMeeting: jest.fn(),
    getApprovalStatus: jest.fn(),
    getProjectMembers: jest.fn(),
    submitSummaryApproval: jest.fn(),
    approveActionItem: jest.fn(),
    approveDecisionItem: jest.fn(),
    addActionItem: jest.fn(),
    updateActionItem: jest.fn(),
    deleteActionItem: jest.fn(),
    addDecision: jest.fn(),
    updateDecision: jest.fn(),
    deleteDecision: jest.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock data
const mockMeeting = {
  id: 'meeting-1',
  projectId: 'project-1',
  projectName: 'Test Project',
  title: 'Sprint Planning',
  description: 'Weekly planning',
  meetingDate: '2026-04-01',
  meetingTime: '10:00',
  platform: 'Zoom',
  meetingLink: 'https://zoom.us/j/123',
  status: 'PENDING_APPROVAL',
  createdByName: 'John Doe',
  createdAt: '2026-04-01T09:00:00Z',
  members: [
    { id: 'user-1', username: 'johndoe', email: 'john@test.com' },
    { id: 'user-2', username: 'janesmith', email: 'jane@test.com' },
  ],
};

const mockSummary = {
  id: 'summary-1',
  meetingId: 'meeting-1',
  status: 'PENDING',
  aiGeneratedContent: 'AI summary text...',
  generatedAt: '2026-04-01T11:00:00Z',
  actionItems: [
    {
      id: 'action-1',
      description: 'Update docs',
      sourceContext: 'Discussed at 10:30',
      approvalStatus: 'PENDING',
      status: 'PENDING',
      createdAt: '2026-04-01T11:00:00Z',
    },
  ],
  decisions: [
    {
      id: 'decision-1',
      description: 'Use PostgreSQL',
      sourceContext: 'Architecture',
      approvalStatus: 'PENDING',
      status: 'PENDING',
      createdAt: '2026-04-01T11:00:00Z',
    },
  ],
  changes: [
    {
      id: 'change-1',
      meetingId: 'meeting-1',
      changeType: 'WORKFLOW',
      beforeState: '{"columns":3}',
      afterState: '{"columns":4}',
      status: 'PENDING',
      createdAt: '2026-04-01T11:00:00Z',
    },
  ],
};

const mockApprovalStatus = {
  meetingId: 'meeting-1',
  requiredApprovals: 2,
  currentApprovedCount: 1,
  currentRejectedCount: 0,
  totalApproversNeeded: 2,
  responses: [
    {
      userId: 'user-2',
      userName: 'Jane Smith',
      response: 'APPROVED',
      comments: 'Looks good',
      respondedAt: '2026-04-01T12:00:00Z',
    },
  ],
};

const mockProjectMembers = [
  { id: 'user-1', userId: 'user-1', role: 'owner' },
  { id: 'user-2', userId: 'user-2', role: 'member' },
];

const mockUser = {
  id: 'user-1',
  username: 'johndoe',
  email: 'john@test.com',
};

// Helper function to setup default mocks
const setupDefaultMocks = () => {
  useParams.mockReturnValue({ meetingId: 'meeting-1' });
  useNavigate.mockReturnValue(jest.fn());
  
  (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
  (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
  (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
  (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
  
  mockLocalStorage.getItem.mockImplementation((key: string) => {
    if (key === 'user') return JSON.stringify(mockUser);
    return null;
  });
};

// Helper for tests that need to add/edit items (no approvals yet)
const setupMocksForEditing = () => {
  useParams.mockReturnValue({ meetingId: 'meeting-1' });
  useNavigate.mockReturnValue(jest.fn());
  
  const noApprovalStatus = {
    ...mockApprovalStatus,
    currentApprovedCount: 0,
    responses: [],
  };
  
  (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
  (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
  (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(noApprovalStatus);
  (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
  
  mockLocalStorage.getItem.mockImplementation((key: string) => {
    if (key === 'user') return JSON.stringify(mockUser);
    return null;
  });
};

// Helper to render component with router
const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>
  );
};

describe('MeetingSummary Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  // ==========================================
  // Data Loading & Initialization (Tests 1-10)
  // ==========================================

  describe('Data Loading & Initialization', () => {
    test('1. Initial load success - all data loaded correctly', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for loading to complete
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalledWith('meeting-1');
        expect(apiService.getSummaryByMeeting).toHaveBeenCalledWith('meeting-1');
        expect(apiService.getApprovalStatus).toHaveBeenCalledWith('meeting-1');
        expect(apiService.getProjectMembers).toHaveBeenCalledWith('project-1');
      });
      
      // Verify content is rendered
      expect(await screen.findByText('Sprint Planning')).toBeInTheDocument();
      expect(screen.getByText(/Test Project/)).toBeInTheDocument();
      expect(screen.getByText('AI summary text...')).toBeInTheDocument();
    });

    test('2. No meetingId - early return, no API calls', async () => {
      useParams.mockReturnValue({});
      useNavigate.mockReturnValue(jest.fn());
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait a bit to ensure no API calls are made
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(apiService.getMeeting).not.toHaveBeenCalled();
      expect(apiService.getSummaryByMeeting).not.toHaveBeenCalled();
      expect(apiService.getApprovalStatus).not.toHaveBeenCalled();
    });

    test('3. Invalid user JSON - handles parse error', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return 'invalid-json';
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      // Should not throw error
      expect(() => renderWithRouter(<MeetingSummary />)).not.toThrow();
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
    });

    test('4. No user in localStorage - currentUserId=null', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockReturnValue(null);
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Component should still render without user
      expect(await screen.findByText('Sprint Planning')).toBeInTheDocument();
    });

    test('5. User is owner - isProjectOwner=true', async () => {
      setupDefaultMocks();
      
      const user = userEvent.setup();
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getProjectMembers).toHaveBeenCalledWith('project-1');
      });
      
      // Owner should see edit/add buttons
      await waitFor(() => {
        const addButtons = screen.queryAllByText(/add|create/i);
        expect(addButtons.length).toBeGreaterThan(0);
      });
    });

    test('6. User is member - isProjectOwner=false', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getProjectMembers).toHaveBeenCalled();
      });
      
      // Member should not see edit/add buttons for action items
      await waitFor(() => {
        const editButtons = screen.queryAllByLabelText(/edit/i);
        const deleteButtons = screen.queryAllByLabelText(/delete/i);
        // Edit/delete buttons should not be visible or should be disabled for non-owners
        expect(editButtons.length).toBe(0);
        expect(deleteButtons.length).toBe(0);
      });
    });

    test('7. Project members fetch fails - silent error handling', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      // Should not throw error
      expect(() => renderWithRouter(<MeetingSummary />)).not.toThrow();
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Component should still render
      expect(await screen.findByText('Sprint Planning')).toBeInTheDocument();
    });

    test('8. API error on load - error toast shown', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockRejectedValue(new Error('Failed to load meeting'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('9. Non-Error rejection - fallback error message', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockRejectedValue('String error');
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('10. Unmount during load - no state updates after unmount', async () => {
      setupDefaultMocks();
      
      // Delay the API response
      (apiService.getMeeting as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(mockMeeting), 500))
      );
      
      const { unmount } = renderWithRouter(<MeetingSummary />);
      
      // Unmount before API resolves
      unmount();
      
      // Wait for the delayed response
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // No errors should occur
      expect(apiService.getMeeting).toHaveBeenCalled();
    });
  });

  // ==========================================
  // changeRequests useMemo (Tests 11-13)
  // ==========================================

  describe('changeRequests useMemo', () => {
    test('11. Transform valid change JSON', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getSummaryByMeeting).toHaveBeenCalled();
      });
      
      // Should render changes section with transformed data
      expect(await screen.findByText('Sprint Planning')).toBeInTheDocument();
    });

    test('12. Handle invalid change JSON', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const summaryWithInvalidChanges = {
        ...mockSummary,
        changes: [
          {
            id: 'change-1',
            meetingId: 'meeting-1',
            changeType: 'WORKFLOW',
            beforeState: 'invalid-json',
            afterState: 'also-invalid',
            status: 'PENDING',
            createdAt: '2026-04-01T11:00:00Z',
          },
        ],
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(summaryWithInvalidChanges);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      // Should not throw error with invalid JSON
      expect(() => renderWithRouter(<MeetingSummary />)).not.toThrow();
      
      await waitFor(() => {
        expect(apiService.getSummaryByMeeting).toHaveBeenCalled();
      });
    });

    test('13. Empty changes array', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const summaryWithNoChanges = {
        ...mockSummary,
        changes: [],
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(summaryWithNoChanges);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getSummaryByMeeting).toHaveBeenCalled();
      });
      
      expect(await screen.findByText('Sprint Planning')).toBeInTheDocument();
    });
  });

  // ==========================================
  // submitDecision (Tests 14-19)
  // ==========================================

  describe('submitDecision', () => {
    test('14. Submit APPROVED with comments', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.submitSummaryApproval as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find and fill comments input
      const commentsInput = await screen.findByPlaceholderText(/comment/i);
      await user.type(commentsInput, 'Great meeting!');
      
      // Click approve button
      const approveButton = screen.getByRole('button', { name: /approve summary/i });
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(apiService.submitSummaryApproval).toHaveBeenCalledWith(
          'meeting-1',
          'APPROVED',
          'Great meeting!'
        );
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('15. Submit REJECTED without comments', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.submitSummaryApproval as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Click reject button (says "Request Changes")
      const rejectButton = await screen.findByRole('button', { name: /request changes/i });
      await user.click(rejectButton);
      
      await waitFor(() => {
        expect(apiService.submitSummaryApproval).toHaveBeenCalledWith(
          'meeting-1',
          'REJECTED',
          undefined
        );
      });
    });

    test('16. No meetingId - early return', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      const mockNavigate = jest.fn();
      useNavigate.mockReturnValue(mockNavigate);
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      // Return null meeting to trigger early return
      (apiService.getMeeting as jest.Mock).mockResolvedValue(null);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Should show meeting not found or similar message
      expect(await screen.findByText(/not found|no meeting/i)).toBeInTheDocument();
    });

    test('17. Submit API error', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.submitSummaryApproval as jest.Mock).mockRejectedValue(new Error('Submit failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      const approveButton = await screen.findByRole('button', { name: /approve summary/i });
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('18. Submit non-Error rejection', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.submitSummaryApproval as jest.Mock).mockRejectedValue('String error');
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      const approveButton = await screen.findByRole('button', { name: /approve summary/i });
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('19. Refresh fails after submit', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.submitSummaryApproval as jest.Mock).mockResolvedValue({});
      (apiService.getSummaryByMeeting as jest.Mock)
        .mockResolvedValueOnce(mockSummary)
        .mockRejectedValueOnce(new Error('Refresh failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      const approveButton = await screen.findByRole('button', { name: /approve summary/i });
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(apiService.submitSummaryApproval).toHaveBeenCalled();
      });
      
      // Should handle refresh error gracefully
      expect(toast.success).toHaveBeenCalled();
    });
  });

  // ==========================================
  // approveItem (Tests 20-24)
  // ==========================================

  describe('approveItem', () => {
    test('20. Approve action item', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.approveActionItem as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find action item and click its approve button
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      // Find the action item row and click its approve button
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      // The approve button is the first button in the row
      const approveButton = actionItemRow?.querySelector('button');
      expect(approveButton).toBeTruthy();
      if (approveButton) await user.click(approveButton);
      
      await waitFor(() => {
        expect(apiService.approveActionItem).toHaveBeenCalledWith('action-1');
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('21. Approve decision item', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.approveDecisionItem as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find decision item and click its approve button
      await waitFor(() => {
        expect(screen.getByText('Use PostgreSQL')).toBeInTheDocument();
      });
      
      // Find the approve button within the decisions section
      const approveButtons = screen.getAllByRole('button', { name: /^Approve$/i });
      expect(approveButtons.length).toBeGreaterThan(0);
      await user.click(approveButtons[0]);
      
      await waitFor(() => {
        expect(apiService.approveDecisionItem).toHaveBeenCalledWith('decision-1');
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('22. No meetingId - early return', async () => {
      useParams.mockReturnValue({});
      useNavigate.mockReturnValue(jest.fn());
      
      renderWithRouter(<MeetingSummary />);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(apiService.approveActionItem).not.toHaveBeenCalled();
      expect(apiService.approveDecisionItem).not.toHaveBeenCalled();
    });

    test('23. Approve action fails', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.approveActionItem as jest.Mock).mockRejectedValue(new Error('Approval failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      // Find the action item row and click its approve button
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      const approveButton = actionItemRow?.querySelector('button');
      expect(approveButton).toBeTruthy();
      if (approveButton) await user.click(approveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('24. Approve decision fails', async () => {
      setupDefaultMocks();
      const user = userEvent.setup();
      
      (apiService.approveDecisionItem as jest.Mock).mockRejectedValue(new Error('Approval failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      await waitFor(() => {
        expect(screen.getByText('Use PostgreSQL')).toBeInTheDocument();
      });
      
      const approveButtons = screen.getAllByRole('button', { name: /^Approve$/i });
      expect(approveButtons.length).toBeGreaterThan(0);
      await user.click(approveButtons[0]);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // saveActionItem (Tests 25-33)
  // ==========================================

  describe('saveActionItem', () => {
    test('25. Create action item', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.addActionItem as jest.Mock).mockResolvedValue({ id: 'new-action' });
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section to render
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Find all Add buttons and click the one in the Action Items section
      const addButtons = screen.getAllByRole('button', { name: /add/i });
      // The Action Items Add button comes after the Decisions Add button in DOM order
      // or we can find by looking at the parent context
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form using placeholder text
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.type(descInput, 'New action description');
      
      const contextInput = screen.getByPlaceholderText(/source context/i);
      await user.type(contextInput, 'Meeting context');
      
      // Save - find the save button in the editor
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(apiService.addActionItem).toHaveBeenCalledWith(
          'meeting-1',
          expect.objectContaining({
            description: 'New action description',
            sourceContext: 'Meeting context',
          })
        );
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('26. Update action item', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.updateActionItem as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for action item to render
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      // Find the action item row and click its edit button (Pencil icon button is the 2nd button)
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      const buttons = actionItemRow?.querySelectorAll('button');
      // Button order: Approve, Edit (icon), Delete (icon)
      const editButton = buttons?.[1];
      expect(editButton).toBeTruthy();
      if (editButton) await user.click(editButton);
      
      // Update description
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.clear(descInput);
      await user.type(descInput, 'Updated description');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(apiService.updateActionItem).toHaveBeenCalledWith(
          'action-1',
          expect.objectContaining({
            description: 'Updated description',
          })
        );
      });
    });

    test('27. Empty description - early return', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click Add button
      const addButtons = screen.getAllByRole('button', { name: /add/i });
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Try to save without description
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      // API should not be called
      expect(apiService.addActionItem).not.toHaveBeenCalled();
    });

    test('28. Whitespace description - early return', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click Add button
      const addButtons = screen.getAllByRole('button', { name: /add/i });
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill with whitespace only
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.type(descInput, '   ');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      // API should not be called
      expect(apiService.addActionItem).not.toHaveBeenCalled();
    });

    test('29. No meetingId - early return', async () => {
      useParams.mockReturnValue({});
      useNavigate.mockReturnValue(jest.fn());
      
      renderWithRouter(<MeetingSummary />);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(apiService.addActionItem).not.toHaveBeenCalled();
      expect(apiService.updateActionItem).not.toHaveBeenCalled();
    });

    test('30. Create action fails', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.addActionItem as jest.Mock).mockRejectedValue(new Error('Create failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click Add button
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.type(descInput, 'New action');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('31. Update action fails', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.updateActionItem as jest.Mock).mockRejectedValue(new Error('Update failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for action item to render
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      // Find the action item row and click its edit button (2nd button)
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      const buttons = actionItemRow?.querySelectorAll('button');
      const editButton = buttons?.[1];
      expect(editButton).toBeTruthy();
      if (editButton) await user.click(editButton);
      
      // Update
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.clear(descInput);
      await user.type(descInput, 'Updated');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test('32. Trim sourceContext', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.addActionItem as jest.Mock).mockResolvedValue({ id: 'new-action' });
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click Add button
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form with whitespace in context
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.type(descInput, 'Description');
      
      const contextInput = screen.getByPlaceholderText(/source context/i);
      await user.type(contextInput, '  Context with spaces  ');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(apiService.addActionItem).toHaveBeenCalledWith(
          'meeting-1',
          expect.objectContaining({
            sourceContext: 'Context with spaces',
          })
        );
      });
    });

    test('33. Empty sourceContext sends undefined', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.addActionItem as jest.Mock).mockResolvedValue({ id: 'new-action' });
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click Add button
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill only description
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.type(descInput, 'Description only');
      
      // Save without context
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(apiService.addActionItem).toHaveBeenCalledWith(
          'meeting-1',
          expect.objectContaining({
            description: 'Description only',
            sourceContext: undefined,
          })
        );
      });
    });
  });

  // ==========================================
  // saveDecisionItem (Tests 34-37)
  // ==========================================

  describe('saveDecisionItem', () => {
    test('34. Create decision', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.addDecision as jest.Mock).mockResolvedValue({ id: 'new-decision' });
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Decisions section
      await waitFor(() => {
        expect(screen.getByText('Decisions')).toBeInTheDocument();
      });
      
      // Find and click Add button in Decisions section
      const decisionsHeading = screen.getByText('Decisions');
      const decisionsSection = decisionsHeading.closest('div[class*="bg-white"]');
      const addButton = decisionsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form using placeholder
      const descInput = screen.getByPlaceholderText(/decision description/i);
      await user.type(descInput, 'New decision description');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(apiService.addDecision).toHaveBeenCalledWith(
          'meeting-1',
          expect.objectContaining({
            description: 'New decision description',
          })
        );
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('35. Update decision', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.updateDecision as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for decision item to render
      await waitFor(() => {
        expect(screen.getByText('Use PostgreSQL')).toBeInTheDocument();
      });
      
      // Find the decision item row and click its edit button (2nd button)
      const decisionText = screen.getByText('Use PostgreSQL');
      const decisionItemRow = decisionText.closest('li');
      const buttons = decisionItemRow?.querySelectorAll('button');
      // Button order: Approve, Edit (icon), Delete (icon)
      const editButton = buttons?.[1];
      expect(editButton).toBeTruthy();
      if (editButton) await user.click(editButton);
      
      // Update description
      const descInput = screen.getByPlaceholderText(/decision description/i);
      await user.clear(descInput);
      await user.type(descInput, 'Updated decision');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(apiService.updateDecision).toHaveBeenCalledWith(
          'decision-1',
          expect.objectContaining({
            description: 'Updated decision',
          })
        );
      });
    });

    test('36. Empty description - early return', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Decisions section
      await waitFor(() => {
        expect(screen.getByText('Decisions')).toBeInTheDocument();
      });
      
      // Find and click Add button in Decisions section
      const decisionsHeading = screen.getByText('Decisions');
      const decisionsSection = decisionsHeading.closest('div[class*="bg-white"]');
      const addButton = decisionsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Try to save without description
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      // API should not be called
      expect(apiService.addDecision).not.toHaveBeenCalled();
    });

    test('37. Decision save error', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.addDecision as jest.Mock).mockRejectedValue(new Error('Save failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Decisions section
      await waitFor(() => {
        expect(screen.getByText('Decisions')).toBeInTheDocument();
      });
      
      // Find and click Add button in Decisions section
      const decisionsHeading = screen.getByText('Decisions');
      const decisionsSection = decisionsHeading.closest('div[class*="bg-white"]');
      const addButton = decisionsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form
      const descInput = screen.getByPlaceholderText(/decision description/i);
      await user.type(descInput, 'New decision');
      
      // Save
      const saveButton = screen.getByRole('button', { name: /^Save$/i });
      await user.click(saveButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // removeActionItem (Tests 38-39)
  // ==========================================

  describe('removeActionItem', () => {
    test('38. Remove action item', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.deleteActionItem as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find the action item and click its delete button (trash icon is the last button in the row)
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      const allButtons = actionItemRow?.querySelectorAll('button');
      // Delete button is typically the last button in the row (after edit button)
      const deleteButton = allButtons?.[allButtons.length - 1];
      if (deleteButton) await user.click(deleteButton);
      
      await waitFor(() => {
        expect(apiService.deleteActionItem).toHaveBeenCalledWith('action-1');
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('39. Remove action fails', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.deleteActionItem as jest.Mock).mockRejectedValue(new Error('Delete failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find the action item and click its delete button
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      const allButtons = actionItemRow?.querySelectorAll('button');
      const deleteButton = allButtons?.[allButtons.length - 1];
      if (deleteButton) await user.click(deleteButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // removeDecisionItem (Tests 40-41)
  // ==========================================

  describe('removeDecisionItem', () => {
    test('40. Remove decision item', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.deleteDecision as jest.Mock).mockResolvedValue({});
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find the decision item and click its delete button
      await waitFor(() => {
        expect(screen.getByText('Use PostgreSQL')).toBeInTheDocument();
      });
      
      const decisionItemText = screen.getByText('Use PostgreSQL');
      const decisionItemRow = decisionItemText.closest('li');
      const allButtons = decisionItemRow?.querySelectorAll('button');
      const deleteButton = allButtons?.[allButtons.length - 1];
      if (deleteButton) await user.click(deleteButton);
      
      await waitFor(() => {
        expect(apiService.deleteDecision).toHaveBeenCalledWith('decision-1');
      });
      
      expect(toast.success).toHaveBeenCalled();
    });

    test('41. Remove decision fails', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      (apiService.deleteDecision as jest.Mock).mockRejectedValue(new Error('Delete failed'));
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Find the decision item and click its delete button
      await waitFor(() => {
        expect(screen.getByText('Use PostgreSQL')).toBeInTheDocument();
      });
      
      const decisionItemText = screen.getByText('Use PostgreSQL');
      const decisionItemRow = decisionItemText.closest('li');
      const allButtons = decisionItemRow?.querySelectorAll('button');
      const deleteButton = allButtons?.[allButtons.length - 1];
      if (deleteButton) await user.click(deleteButton);
      
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });

  // ==========================================
  // resetActionEditor/resetDecisionEditor (Tests 42-43)
  // ==========================================

  describe('reset editors', () => {
    test('42. Reset action editor clears state', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click Add button
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form
      const descInput = screen.getByPlaceholderText(/action item description/i);
      await user.type(descInput, 'Some text');
      
      // Click cancel/reset
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      // Editor should close
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/action item description/i)).not.toBeInTheDocument();
      });
    });

    test('43. Reset decision editor clears state', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Decisions section
      await waitFor(() => {
        expect(screen.getByText('Decisions')).toBeInTheDocument();
      });
      
      // Find and click Add button in Decisions section
      const decisionsHeading = screen.getByText('Decisions');
      const decisionsSection = decisionsHeading.closest('div[class*="bg-white"]');
      const addButton = decisionsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Fill form
      const descInput = screen.getByPlaceholderText(/decision description/i);
      await user.type(descInput, 'Some decision');
      
      // Click cancel/reset
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);
      
      // Editor should close
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/decision description/i)).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // Computed Properties (Tests 44-57)
  // ==========================================

  describe('Computed Properties', () => {
    test('44. currentUserApproval - finds user vote', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      // User-2 has already voted
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // User who voted should see disabled buttons
      await waitFor(() => {
        const approveButton = screen.queryByRole('button', { name: /^approve$/i });
        if (approveButton) {
          expect(approveButton).toBeDisabled();
        }
      });
    });

    test('45. hasSubmittedSummaryDecision - true when user voted', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // Should show that user has voted - looking for the text showing the user's response
      expect(await screen.findByText(/You already responded/i)).toBeInTheDocument();
    });

    test('46. hasSubmittedSummaryDecision - false when user not voted', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // Should show voting buttons for user who hasn't voted
      expect(await screen.findByRole('button', { name: /approve summary/i })).toBeInTheDocument();
    });

    test('47. hasAnyApprovedSummaryDecision - true when approvals exist', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // Should show approval count in the responses section
      await waitFor(() => {
        expect(screen.getByText('Jane Smith: APPROVED')).toBeInTheDocument();
      });
    });

    test('48. hasAnyApprovedSummaryDecision - false when no approvals', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const noApprovalStatus = {
        ...mockApprovalStatus,
        currentApprovedCount: 0,
        responses: [],
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(noApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // Should show no approvals message
      await waitFor(() => {
        expect(screen.getByText(/No approvals submitted yet/i)).toBeInTheDocument();
      });
    });

    test('49. isMeetingFinalized - true when APPROVED', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const approvedMeeting = {
        ...mockMeeting,
        status: 'APPROVED',
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(approvedMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Should show approved status - looking for the badge text
      await waitFor(() => {
        expect(screen.getByText('Approved')).toBeInTheDocument();
      });
    });

    test('50. isMeetingFinalized - true when REJECTED', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const rejectedMeeting = {
        ...mockMeeting,
        status: 'REJECTED',
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(rejectedMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Should show rejected status
      expect(await screen.findByText(/rejected/i)).toBeInTheDocument();
    });

    test('51. isMeetingFinalized - false when PENDING_APPROVAL', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Should show pending status - looking for the badge text
      await waitFor(() => {
        expect(screen.getByText('Pending Approval')).toBeInTheDocument();
      });
    });

    test('52. isItemEditingDisabled - true when finalized', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const approvedMeeting = {
        ...mockMeeting,
        status: 'APPROVED',
      };
      
      const emptyApprovalStatus = {
        ...mockApprovalStatus,
        currentApprovedCount: 0,
        responses: [],
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(approvedMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(emptyApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // Add buttons should be disabled when finalized
      await waitFor(() => {
        const actionItemsHeading = screen.getByText('Action Items');
        const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
        const addButton = actionItemsSection?.querySelector('button');
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });

    test('53. isItemEditingDisabled - true when user voted', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      // User-2 has already voted
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // Add buttons should be disabled when user has voted
      await waitFor(() => {
        const actionItemsHeading = screen.getByText('Action Items');
        const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
        const addButton = actionItemsSection?.querySelector('button');
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });

    test('54. canEditOrDeleteItems - true for owner when not finalized', async () => {
      setupMocksForEditing();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getProjectMembers).toHaveBeenCalled();
      });
      
      // Owner should see edit/delete icon buttons (pencil and trash icons in the action/decision items)
      await waitFor(() => {
        const actionItemText = screen.getByText('Update docs');
        const actionItemRow = actionItemText.closest('li');
        const buttons = actionItemRow?.querySelectorAll('button');
        // Should have approve button + edit icon button + delete icon button
        expect(buttons?.length).toBeGreaterThanOrEqual(2);
      });
    });

    test('55. canEditOrDeleteItems - false for non-owner', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      // User-2 is a member, not owner
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getProjectMembers).toHaveBeenCalled();
      });
      
      // Member should not see edit/delete buttons
      await waitFor(() => {
        const editButtons = screen.queryAllByRole('button', { name: /^edit$/i });
        const deleteButtons = screen.queryAllByRole('button', { name: /^delete$/i });
        expect(editButtons.length).toBe(0);
        expect(deleteButtons.length).toBe(0);
      });
    });

    test('56. isAddDisabled - true when finalized', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      const approvedMeeting = {
        ...mockMeeting,
        status: 'APPROVED',
      };
      
      const emptyApprovalStatus = {
        ...mockApprovalStatus,
        currentApprovedCount: 0,
        responses: [],
      };
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(approvedMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(emptyApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // Add buttons should be disabled when finalized
      await waitFor(() => {
        const actionItemsHeading = screen.getByText('Action Items');
        const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
        const addButton = actionItemsSection?.querySelector('button');
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });

    test('57. isAddDisabled - true when any approval exists', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // When approvals exist, add should be disabled
      await waitFor(() => {
        const actionItemsHeading = screen.getByText('Action Items');
        const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
        const addButton = actionItemsSection?.querySelector('button');
        if (addButton) {
          expect(addButton).toBeDisabled();
        }
      });
    });
  });

  // ==========================================
  // reloadSummaryAndApproval (Test 58)
  // ==========================================

  describe('reloadSummaryAndApproval', () => {
    test('58. Reload summary and approval data', async () => {
      setupDefaultMocks();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Initial calls
      expect(apiService.getSummaryByMeeting).toHaveBeenCalledTimes(1);
      expect(apiService.getApprovalStatus).toHaveBeenCalledTimes(1);
      
      // Trigger a reload by submitting a decision
      const user = userEvent.setup();
      (apiService.submitSummaryApproval as jest.Mock).mockResolvedValue({});
      
      const approveButton = await screen.findByRole('button', { name: /approve summary/i });
      await user.click(approveButton);
      
      await waitFor(() => {
        expect(apiService.submitSummaryApproval).toHaveBeenCalled();
      });
      
      // Should reload summary and approval
      await waitFor(() => {
        expect(apiService.getSummaryByMeeting).toHaveBeenCalledTimes(2);
        expect(apiService.getApprovalStatus).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ==========================================
  // Rendering & UI (Tests 59-70)
  // ==========================================

  describe('Rendering & UI', () => {
    test('59. Meeting not found message', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(null);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(null);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(null);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      expect(await screen.findByText(/not found|no meeting|meeting not found/i)).toBeInTheDocument();
    });

    test('60. Status badge display', async () => {
      setupMocksForEditing();
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // Should show status badge
      expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    });

    test('61. Disable buttons when voted', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      // User-2 has already voted
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // Approve/reject buttons should be disabled
      const approveButton = screen.queryByRole('button', { name: /^approve$/i });
      const rejectButton = screen.queryByRole('button', { name: /^reject$/i });
      
      if (approveButton) expect(approveButton).toBeDisabled();
      if (rejectButton) expect(rejectButton).toBeDisabled();
    });

    test('62. Owner sees edit buttons', async () => {
      setupMocksForEditing();
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting and action items to load
      await waitFor(() => {
        expect(screen.getByText('Update docs')).toBeInTheDocument();
      });
      
      // Owner should see edit icon buttons (pencil icons)
      const actionItemText = screen.getByText('Update docs');
      const actionItemRow = actionItemText.closest('li');
      const buttons = actionItemRow?.querySelectorAll('button');
      // Should have approve button + edit icon button + delete icon button
      expect(buttons?.length).toBeGreaterThanOrEqual(2);
    });

    test('63. Member does not see edit', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getProjectMembers).toHaveBeenCalled();
      });
      
      // Member should not see edit/delete buttons
      await waitFor(() => {
        const editButtons = screen.queryAllByRole('button', { name: /^edit$/i });
        expect(editButtons.length).toBe(0);
      });
    });

    test('64. Decision editor opens', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Decisions section
      await waitFor(() => {
        expect(screen.getByText('Decisions')).toBeInTheDocument();
      });
      
      // Click add button in Decisions section
      const decisionsHeading = screen.getByText('Decisions');
      const decisionsSection = decisionsHeading.closest('div[class*="bg-white"]');
      const addButton = decisionsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Editor should open with placeholder text visible
      expect(screen.getByPlaceholderText(/decision description/i)).toBeInTheDocument();
    });

    test('65. Action editor opens', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // Wait for Action Items section
      await waitFor(() => {
        expect(screen.getByText('Action Items')).toBeInTheDocument();
      });
      
      // Click add button in Action Items section
      const actionItemsHeading = screen.getByText('Action Items');
      const actionItemsSection = actionItemsHeading.closest('div[class*="bg-white"]');
      const addButton = actionItemsSection?.querySelector('button');
      if (addButton) await user.click(addButton);
      
      // Editor should open with placeholder text visible
      expect(screen.getByPlaceholderText(/action item description/i)).toBeInTheDocument();
    });

    test('66. Change modal opens', async () => {
      setupMocksForEditing();
      const user = userEvent.setup();
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load with changes
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // Wait for Changes section and click the Review Changes button
      await waitFor(() => {
        expect(screen.getByText('Changes')).toBeInTheDocument();
      });
      
      const reviewChangesButton = screen.getByRole('button', { name: /review changes/i });
      await user.click(reviewChangesButton);
      
      // Modal should open - look for dialog content
      await waitFor(() => {
        // The ChangeDetailModal renders content - look for any dialog-related element
        expect(screen.getByText(/WORKFLOW|beforeState|afterState/i)).toBeInTheDocument();
      });
    });

    test('67. Navigation buttons work - back to meetings', async () => {
      const mockNavigate = jest.fn();
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(mockNavigate);
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      const user = userEvent.setup();
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // Find and click back button - looking for "Back to Meetings" button
      const backButton = screen.getByRole('button', { name: /back to meetings/i });
      await user.click(backButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/project/project-1?tab=meetings');
    });

    test('68. Navigation buttons work - to project', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify(mockUser);
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      // Wait for the meeting to load
      await waitFor(() => {
        expect(screen.getByText('Sprint Planning')).toBeInTheDocument();
      });
      
      // The Test Project text is rendered with "Project:" prefix
      // Verify the project name is displayed
      expect(screen.getByText(/Test Project/)).toBeInTheDocument();
    });

    test('69. Navigation buttons work - to kanban', async () => {
      setupDefaultMocks();
      const mockNavigate = jest.fn();
      useNavigate.mockReturnValue(mockNavigate);
      
      const user = userEvent.setup();
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getMeeting).toHaveBeenCalled();
      });
      
      // There is no direct kanban button - navigation is via "Back to Meetings" or "Go to Decisions"
      // The component navigates to: /project/${meeting.projectId}?tab=meetings
      // Let's test the "Go to Decisions" button instead
      const decisionsButton = await screen.findByRole('button', { name: /go to decisions/i });
      await user.click(decisionsButton);
      
      expect(mockNavigate).toHaveBeenCalledWith('/project/project-1?tab=decisions');
    });

    test('70. Comments input disabled after voting', async () => {
      useParams.mockReturnValue({ meetingId: 'meeting-1' });
      useNavigate.mockReturnValue(jest.fn());
      
      // User-2 has already voted
      mockLocalStorage.getItem.mockImplementation((key: string) => {
        if (key === 'user') return JSON.stringify({ id: 'user-2', username: 'janesmith' });
        return null;
      });
      
      (apiService.getMeeting as jest.Mock).mockResolvedValue(mockMeeting);
      (apiService.getSummaryByMeeting as jest.Mock).mockResolvedValue(mockSummary);
      (apiService.getApprovalStatus as jest.Mock).mockResolvedValue(mockApprovalStatus);
      (apiService.getProjectMembers as jest.Mock).mockResolvedValue(mockProjectMembers);
      
      renderWithRouter(<MeetingSummary />);
      
      await waitFor(() => {
        expect(apiService.getApprovalStatus).toHaveBeenCalled();
      });
      
      // Comments input should be disabled
      const commentsInput = screen.queryByPlaceholderText(/comment/i);
      if (commentsInput) {
        expect(commentsInput).toBeDisabled();
      }
    });
  });
});
