# TrelloPlus - AI-Powered Workflow Management

An intelligent, team-focused project management application that leverages AI to streamline workflow automation, meeting management, and collaborative kanban boards.

## 🌟 Features

### 🤖 AI-Powered Board Generation
- Generate kanban boards automatically from project descriptions
- AI analyzes project requirements and creates optimal workflow stages
- Pre-populates work items based on project scope

### 📊 Kanban Board Management
- Drag-and-drop task management across workflow stages
- Create, edit, and organize tasks with rich details
- Real-time board synchronization across team members
- Customizable workflow columns and stages

### 🎙️ Meeting Management & AI Summaries
- Create and manage team meetings
- Automatic extraction of action items, decisions, and changes from transcripts
- Real-time meeting notes and follow-ups

### ✅ Change Review & Approval System
- Review proposed changes before applying them
- Kanban modification approval workflows
- Team-based decision making

### 👥 Team Collaboration
- Multi-user project management
- Role-based access control
- Team workspace management

### ♿ Accessibility First
- WCAG 2.1 Level AA compliant
- Keyboard navigation support
- Semantic HTML with ARIA labels
- Screen reader optimized
- High contrast mode support

## 🛠️ Tech Stack

### Frontend
- **React** 18.3.1 - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** 6.3.5 - Fast build tool
- **Tailwind CSS** 4.1.12 - Utility-first CSS framework
- **Radix UI** - Headless component library
- **React Router** 7.13.0 - Routing
- **React DnD** - Drag-and-drop library
- **Zustand** 5.0.11 - State management
- **React Hook Form** - Form management

### UI & Styling
- **shadcn/ui** - High-quality React components
- **Lucide React** - Icon library
- **Sonner** - Toast notifications
- **Framer Motion** - Animation library
- **Material-UI** - Additional UI components

### Additional Libraries
- **date-fns** - Date manipulation
- **Recharts** - Charts and graphs
- **React Slick** - Carousel component

## 📦 Installation

### Prerequisites
- Node.js 18+
- npm or pnpm

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

The application will be available at `http://localhost:5173`

## 🚀 Getting Started

### Create a New Project
1. Navigate to the Dashboard
2. Click "New Project"
3. Provide a project description
4. AI will auto-generate your kanban board with suggested workflow stages and initial tasks

### Manage Your Kanban Board
- **Drag tasks** between columns to update status
- **Click tasks** to view and edit details
- **Add new tasks** directly to any column
- **Rename or delete** columns as needed

### Schedule and Manage Meetings
1. Go to Meetings section
2. Create a new meeting or select an existing one
3. Add meeting notes and participants
4. End the meeting to generate AI summary
5. Review extracted action items and decisions

### Review Changes
1. View pending change approvals in your dashboard
2. Review proposed modifications to the kanban board
3. Approve or reject changes as a team
4. Applied changes are logged for audit purposes

## 📁 Project Structure

```
src/
├── app/
│   ├── components/          # Reusable UI components
│   │   ├── figma/          # Figma-specific components
│   │   └── ui/             # UI primitives (buttons, cards, etc.)
│   ├── pages/              # Page components (routes)
│   ├── store/              # Zustand state management
│   │   ├── projectStore.ts
│   │   ├── meetingStore.ts
│   │   └── changeStore.ts
│   ├── App.tsx             # Root component
│   └── routes.ts           # Route definitions
├── main.tsx                # Entry point
└── styles/                 # Global styles
```

## 🔒 Security & Privacy

- **Role-Based Access Control (RBAC)** - Fine-grained permission management
- **Authentication** - Secure user authentication
- **Data Encryption** - Sensitive data protection
- **Audit Logging** - Complete change history
- **Privacy Compliant** - User data handled responsibly

See [ACCESSIBILITY_COMPLIANCE.md](ACCESSIBILITY_COMPLIANCE.md) for accessibility details and [ATTRIBUTIONS.md](ATTRIBUTIONS.md) for component attributions.

## 📚 Documentation

- [Dev Spec 1](docs/dev_spec_1.md) - AI-powered board generation system
- [Dev Spec 2](docs/dev_spec_2.md) - Meeting management and AI summaries
- [Dev Spec 3](docs/dev_spec_3.md) - Change review and approval system
- [Accessibility Compliance](ACCESSIBILITY_COMPLIANCE.md) - WCAG 2.1 Level AA details

## 🎨 UI Components

Built with [shadcn/ui](https://ui.shadcn.com/) components and [Radix UI](https://www.radix-ui.com/) primitives, featuring:
- Modals and dialogs
- Form controls and validations
- Tables and data displays
- Tooltips and popovers
- Notifications and alerts
- Responsive navigation

## 🔄 State Management

The application uses **Zustand** for efficient state management with separate stores:
- `projectStore.ts` - Project and board state
- `meetingStore.ts` - Meeting and transcript state
- `changeStore.ts` - Change request and approval state

## 🌍 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari 14+
- Any modern ES2020+ compatible browser

## 📝 Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
```

## 🤝 Contributing

This is a CS698 course project. For questions or contributions, please contact the development team.

## 📄 License

See project documentation for licensing information.

## 🏆 Team

- **Luke Hill** - Lead Architect (Dev Spec 1)
- **Vishesh Raju** - Developer (Dev Spec 2)
- **Swechcha Ambati** - Software Engineer (Dev Spec 3)


---

**Version:** 0.0.1 | **Status:** In Development | **Last Updated:** March 2026
