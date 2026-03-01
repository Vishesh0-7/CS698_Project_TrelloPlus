import { create } from 'zustand';

export interface ActionItem {
  id: string;
  description: string;
  sourceContext: string;
  comment?: string;
}

export interface Decision {
  id: string;
  description: string;
  sourceContext: string;
  comment?: string;
}

export interface Change {
  id: string;
  description: string;
  sourceContext: string;
  comment?: string;
}

export interface OtherNote {
  id: string;
  description: string;
  sourceContext?: string;
  comment?: string;
}

export interface Approval {
  userId: string;
  userName: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp?: string;
}

export interface Meeting {
  id: string;
  projectId: string;
  title: string;
  date: string;
  time: string;
  members: string[];
  agenda: string;
  platform?: string;
  link?: string;
  transcript?: string;
  status: 'scheduled' | 'in-progress' | 'pending-approval' | 'approved' | 'rejected';
  actionItems: ActionItem[];
  decisions: Decision[];
  changes: Change[];
  otherNotes: OtherNote[];
  approvals: Approval[];
  totalApprovers: number;
  userHasApproved: boolean;
  approvalComments?: string;
}

const initialMeetings: Meeting[] = [
  {
    id: 'm1',
    projectId: '1',
    title: 'Q1 Product Planning Meeting',
    date: '2026-02-28',
    time: '14:00',
    members: ['John Doe', 'Sarah Chen', 'Mike Johnson', 'Alex Kim', 'Emma Davis'],
    agenda: 'Review Q1 goals, discuss product roadmap, and plan upcoming sprints',
    platform: 'Zoom',
    link: 'https://zoom.us/j/123456789',
    transcript: 'Meeting transcript would be here...',
    status: 'pending-approval',
    totalApprovers: 5,
    userHasApproved: false,
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'pending' },
      { userId: 'u2', userName: 'Sarah Chen', status: 'approved', timestamp: '2026-02-28T15:30:00Z' },
      { userId: 'u3', userName: 'Mike Johnson', status: 'pending' },
      { userId: 'u4', userName: 'Alex Kim', status: 'approved', timestamp: '2026-02-28T16:00:00Z' },
      { userId: 'u5', userName: 'Emma Davis', status: 'pending' },
    ],
    actionItems: [
      {
        id: 'a1',
        description: 'Create wireframes for new dashboard feature',
        sourceContext: 'Discussed during feature prioritization segment (00:45:20)',
        comment: 'Wireframes should be completed by end of March',
      },
      {
        id: 'a2',
        description: 'Research competitor pricing models',
        sourceContext: 'Mentioned in market analysis discussion (01:15:30)',
        comment: 'Focus on top 5 competitors',
      },
      {
        id: 'a3',
        description: 'Draft technical architecture proposal',
        sourceContext: 'Technical review segment (01:45:00)',
        comment: 'Include scalability and security considerations',
      },
    ],
    decisions: [
      {
        id: 'd1',
        description: 'Move forward with React 19 migration',
        sourceContext: 'Technical stack discussion (00:30:15)',
        comment: 'Ensure compatibility with existing codebase',
      },
      {
        id: 'd2',
        description: 'Postpone mobile app launch to Q2',
        sourceContext: 'Timeline review segment (01:00:45)',
        comment: 'Review Q2 priorities',
      },
    ],
    changes: [
      {
        id: 'c1',
        description: 'Move Design homepage mockup to In Progress',
        sourceContext: 'Task status discussion (00:20:00)',
        comment: 'Sarah to start working on this immediately',
      },
      {
        id: 'c2',
        description: 'Update Implement authentication task to include OAuth',
        sourceContext: 'Security review segment (01:10:30)',
        comment: 'Expand scope to include OAuth integration',
      },
      {
        id: 'c3',
        description: 'Create new card for dark mode support',
        sourceContext: 'UI enhancement discussion (01:25:00)',
        comment: 'New feature requested by users',
      },
      {
        id: 'c4',
        description: 'Move Set up project repository to Done',
        sourceContext: 'Sprint progress review (00:15:00)',
        comment: 'Repository is already completed',
      },
    ],
    otherNotes: [],
  },
  {
    id: 'm2',
    projectId: '1',
    title: 'Tech Stack Selection Meeting',
    date: '2026-02-15',
    time: '10:00',
    members: ['John Doe', 'Sarah Chen', 'Mike Johnson'],
    agenda: 'Evaluate and select technology stack for the website redesign project',
    platform: 'Google Meet',
    link: 'https://meet.google.com/abc-defg-hij',
    transcript: 'Meeting transcript...',
    status: 'approved',
    totalApprovers: 3,
    userHasApproved: true,
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-15T11:00:00Z' },
      { userId: 'u2', userName: 'Sarah Chen', status: 'approved', timestamp: '2026-02-15T11:15:00Z' },
      { userId: 'u3', userName: 'Mike Johnson', status: 'approved', timestamp: '2026-02-15T11:30:00Z' },
    ],
    actionItems: [
      {
        id: 'a7',
        description: 'Set up development environment with selected stack',
        sourceContext: 'Implementation planning',
        comment: 'Complete setup by next week',
      },
    ],
    decisions: [
      {
        id: 'd3',
        description: 'Decided on the tech stack for the project',
        sourceContext: 'Technology evaluation',
        comment: 'React 19, TypeScript, Tailwind CSS approved',
      },
    ],
    changes: [],
    otherNotes: [],
  },
  {
    id: 'm3',
    projectId: '2',
    title: 'Project Kickoff Meeting',
    date: '2026-02-25',
    time: '15:00',
    members: ['John Doe', 'Sarah Chen'],
    agenda: 'Kick off mobile app development project and align on objectives',
    platform: 'Zoom',
    link: 'https://zoom.us/j/987654321',
    transcript: 'Meeting transcript...',
    status: 'approved',
    totalApprovers: 2,
    userHasApproved: true,
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-25T16:00:00Z' },
      { userId: 'u2', userName: 'Sarah Chen', status: 'approved', timestamp: '2026-02-25T16:15:00Z' },
    ],
    actionItems: [
      {
        id: 'a8',
        description: 'Research React Native vs Flutter',
        sourceContext: 'Technology selection discussion',
        comment: 'Compare pros and cons',
      },
    ],
    decisions: [
      {
        id: 'd4',
        description: 'Approved the project scope and timeline',
        sourceContext: 'Project planning',
        comment: '6-month development timeline approved',
      },
    ],
    changes: [],
    otherNotes: [],
  },
  {
    id: 'm4',
    projectId: '2',
    title: 'Tech Stack Selection Meeting',
    date: '2026-02-26',
    time: '14:00',
    members: ['John Doe', 'Sarah Chen'],
    agenda: 'Select mobile development framework and tools',
    platform: 'Google Meet',
    link: 'https://meet.google.com/xyz-uvwx-yz',
    transcript: 'Meeting transcript...',
    status: 'approved',
    totalApprovers: 2,
    userHasApproved: true,
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-26T15:00:00Z' },
      { userId: 'u2', userName: 'Sarah Chen', status: 'approved', timestamp: '2026-02-26T15:15:00Z' },
    ],
    actionItems: [
      {
        id: 'a9',
        description: 'Set up React Native development environment',
        sourceContext: 'Implementation planning',
        comment: 'Install required tools and dependencies',
      },
    ],
    decisions: [
      {
        id: 'd5',
        description: 'Decided on the tech stack for the project',
        sourceContext: 'Technology evaluation',
        comment: 'React Native with Expo selected',
      },
    ],
    changes: [],
    otherNotes: [],
  },
  {
    id: 'm5',
    projectId: '3',
    title: 'Project Kickoff Meeting',
    date: '2026-02-15',
    time: '11:00',
    members: ['John Doe', 'Sarah Chen', 'Mike Johnson'],
    agenda: 'Launch Q1 marketing campaign and define strategy',
    platform: 'Microsoft Teams',
    link: 'https://teams.microsoft.com/l/meetup-join/xxx',
    transcript: 'Meeting transcript...',
    status: 'approved',
    totalApprovers: 3,
    userHasApproved: true,
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-15T12:00:00Z' },
      { userId: 'u2', userName: 'Sarah Chen', status: 'approved', timestamp: '2026-02-15T12:10:00Z' },
      { userId: 'u3', userName: 'Mike Johnson', status: 'approved', timestamp: '2026-02-15T12:15:00Z' },
    ],
    actionItems: [
      {
        id: 'a10',
        description: 'Create content calendar for social media',
        sourceContext: 'Content planning discussion',
        comment: 'Plan posts for next 3 months',
      },
    ],
    decisions: [
      {
        id: 'd6',
        description: 'Approved the project scope and timeline',
        sourceContext: 'Campaign planning',
        comment: 'Q1 2026 campaign approved',
      },
    ],
    changes: [],
    otherNotes: [],
  },
  {
    id: 'm6',
    projectId: '3',
    title: 'Strategy Alignment Meeting',
    date: '2026-02-20',
    time: '13:00',
    members: ['John Doe', 'Sarah Chen', 'Mike Johnson'],
    agenda: 'Align on marketing strategy and campaign messaging',
    platform: 'Zoom',
    link: 'https://zoom.us/j/555666777',
    transcript: 'Meeting transcript...',
    status: 'approved',
    totalApprovers: 3,
    userHasApproved: true,
    approvals: [
      { userId: 'u1', userName: 'John Doe', status: 'approved', timestamp: '2026-02-20T14:00:00Z' },
      { userId: 'u2', userName: 'Sarah Chen', status: 'approved', timestamp: '2026-02-20T14:10:00Z' },
      { userId: 'u3', userName: 'Mike Johnson', status: 'approved', timestamp: '2026-02-20T14:15:00Z' },
    ],
    actionItems: [
      {
        id: 'a11',
        description: 'Finalize campaign messaging and creative assets',
        sourceContext: 'Creative review',
        comment: 'Complete by end of week',
      },
    ],
    decisions: [
      {
        id: 'd7',
        description: 'Decided on the tech stack for the project',
        sourceContext: 'Tools selection',
        comment: 'HubSpot for automation, Canva for design',
      },
    ],
    changes: [],
    otherNotes: [],
  },
];

interface MeetingStore {
  meetings: Meeting[];
  addMeeting: (meeting: Meeting) => void;
  updateMeeting: (id: string, updates: Partial<Meeting>) => void;
  deleteMeeting: (id: string) => void;
  updateItemDescription: (meetingId: string, itemType: 'actionItem' | 'decision' | 'change', itemId: string, newDescription: string) => void;
  approveItem: (meetingId: string, itemType: 'actionItem' | 'decision' | 'change', itemId: string, approved: boolean, comment?: string) => void;
  submitApproval: (meetingId: string, status: 'approved' | 'rejected', comments?: string) => void;
  generateSummary: (meetingId: string) => void;
  addOtherNote: (meetingId: string, description: string) => void;
  removeOtherNote: (meetingId: string, noteId: string) => void;
  processMeetingApproval: (meetingId: string) => { actionItems: ActionItem[], decisions: Decision[], changes: Change[] };
}

export const useMeetingStore = create<MeetingStore>((set, get) => ({
  meetings: initialMeetings,
  
  addMeeting: (meeting) => set((state) => ({ meetings: [...state.meetings, meeting] })),
  
  updateMeeting: (id, updates) => set((state) => ({
    meetings: state.meetings.map((m) => m.id === id ? { ...m, ...updates } : m),
  })),
  
  deleteMeeting: (id) => set((state) => ({
    meetings: state.meetings.filter((m) => m.id !== id),
  })),
  
  updateItemDescription: (meetingId, itemType, itemId, newDescription) => set((state) => ({
    meetings: state.meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;
      
      const updateItems = (items: any[]) =>
        items.map((item) => item.id === itemId ? { ...item, description: newDescription } : item);
      
      return {
        ...meeting,
        actionItems: itemType === 'actionItem' ? updateItems(meeting.actionItems) : meeting.actionItems,
        decisions: itemType === 'decision' ? updateItems(meeting.decisions) : meeting.decisions,
        changes: itemType === 'change' ? updateItems(meeting.changes) : meeting.changes,
      };
    }),
  })),
  
  approveItem: (meetingId, itemType, itemId, approved, comment) => set((state) => ({
    meetings: state.meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;
      
      const updateItems = (items: any[]) =>
        items.map((item) => item.id === itemId ? { ...item, approved, comment } : item);
      
      return {
        ...meeting,
        actionItems: itemType === 'actionItem' ? updateItems(meeting.actionItems) : meeting.actionItems,
        decisions: itemType === 'decision' ? updateItems(meeting.decisions) : meeting.decisions,
        changes: itemType === 'change' ? updateItems(meeting.changes) : meeting.changes,
      };
    }),
  })),
  
  submitApproval: (meetingId, status, comments) => set((state) => ({
    meetings: state.meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;
      
      const updatedApprovals = meeting.approvals.map((approval) =>
        approval.userId === 'u1' // Current user
          ? { ...approval, status, timestamp: new Date().toISOString(), comments }
          : approval
      );
      
      const approvedCount = updatedApprovals.filter((a) => a.status === 'approved').length;
      const newStatus = approvedCount === meeting.totalApprovers ? 'approved' : 'pending-approval';
      
      return {
        ...meeting,
        approvals: updatedApprovals,
        status: newStatus,
        userHasApproved: true,
        approvalComments: comments,
      };
    }),
  })),
  
  processMeetingApproval: (meetingId) => {
    const meeting = get().meetings.find((m) => m.id === meetingId);
    if (!meeting || meeting.status !== 'approved') {
      return { actionItems: [], decisions: [], changes: [] };
    }
    
    return {
      actionItems: meeting.actionItems,
      decisions: meeting.decisions,
      changes: meeting.changes,
    };
  },
  
  generateSummary: (meetingId) => set((state) => ({
    meetings: state.meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;
      
      // Mock AI-generated summary items
      const mockActionItems: ActionItem[] = [
        {
          id: `ai-a-${Date.now()}-1`,
          description: 'Follow up on discussed budget allocation',
          sourceContext: 'Generated from transcript analysis',
        },
        {
          id: `ai-a-${Date.now()}-2`,
          description: 'Schedule next team sync meeting',
          sourceContext: 'Generated from transcript analysis',
        },
      ];
      
      const mockDecisions: Decision[] = [
        {
          id: `ai-d-${Date.now()}-1`,
          description: 'Approved new project timeline',
          sourceContext: 'Generated from transcript analysis',
        },
      ];
      
      const mockChanges: Change[] = [
        {
          id: `ai-c-${Date.now()}-1`,
          description: 'Update team workflow process',
          sourceContext: 'Generated from transcript analysis',
        },
      ];
      
      return {
        ...meeting,
        actionItems: mockActionItems,
        decisions: mockDecisions,
        changes: mockChanges,
        status: 'pending-approval',
      };
    }),
  })),
  
  addOtherNote: (meetingId, description) => set((state) => ({
    meetings: state.meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;
      
      const newNote: OtherNote = {
        id: `n-${Date.now()}`,
        description,
      };
      
      return {
        ...meeting,
        otherNotes: [...meeting.otherNotes, newNote],
      };
    }),
  })),
  
  removeOtherNote: (meetingId, noteId) => set((state) => ({
    meetings: state.meetings.map((meeting) => {
      if (meeting.id !== meetingId) return meeting;
      
      return {
        ...meeting,
        otherNotes: meeting.otherNotes.filter((note) => note.id !== noteId),
      };
    }),
  })),
}));