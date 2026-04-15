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

### Frontend Environment Variables

The frontend reads deployment settings from Vite env vars. For local development, the defaults in `.env.example` point to the local backend. For AWS deployment, set these in Amplify to your API Gateway and realtime endpoint:

- `VITE_API_BASE_URL` - REST API base URL, for example `https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/api/v1`
- `VITE_WS_ENDPOINT` - WebSocket/SockJS endpoint, for example `https://your-backend-host/api/v1/ws/board`
- `VITE_REQUEST_TIMEOUT_MS` - Optional frontend timeout for regular API calls in milliseconds, for example `30000`
- `VITE_LLM_REQUEST_TIMEOUT_MS` - Optional frontend timeout for long AI/summary requests in milliseconds, for example `90000`

If you only deploy the REST API to API Gateway, keep the WebSocket endpoint on a backend host that supports SockJS or disable the realtime board hook until you add a WebSocket-compatible AWS endpoint.

## 🚀 Simple Deployment: Render + Vercel

If you want the lowest-friction production setup for this repo, use Render for the backend and Vercel for the frontend.

### Render Backend
- Create a new Render service from the repository and point it at `render.yaml`, or create a Java web service manually with `backend` as the root directory.
- Set `SPRING_PROFILES_ACTIVE=prod`.
- Set `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, and `CORS_ALLOWED_ORIGINS` in Render.
- If you use Render Postgres, copy its JDBC connection string into `DB_URL`.
- Optional: set `OLLAMA_BASE_URL` if the AI features should talk to a deployed Ollama service.

### Vercel Frontend
- Import the repository into Vercel and keep the project root at the repo root.
- Set `VITE_API_BASE_URL` to your Render backend URL, for example `https://your-backend.onrender.com/api/v1`.
- Set `VITE_WS_ENDPOINT` to the websocket endpoint on that backend, for example `https://your-backend.onrender.com/api/v1/ws/board`.
- `vercel.json` handles client-side routing so deep links like `/board/:projectId` work after refresh.

### Build Commands
- Frontend build: `npm run build`
- Backend build: `cd backend && mvn -DskipTests package`

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

## Testing on Local Machine

This section covers everything needed to run tests manually on a developer machine for both frontend and backend, including required frameworks/libraries and coverage commands.

### Frontend Testing

#### Prerequisites
- Node.js 18+ (Node 20 LTS recommended)
- npm (bundled with Node.js)

#### Frameworks and Libraries (installed by npm)
Run `npm install` in the repository root to install all frontend dependencies from `package.json`, including:
- React + React DOM
- TypeScript + Vite
- Jest + ts-jest + jest-environment-jsdom
- Testing Library (`@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`)
- UI/runtime libraries (Tailwind, Radix UI, React Router, React DnD, Zustand, etc.)

#### Install and run tests
From repository root:

Windows (PowerShell), macOS, and Linux:

```bash
npm install
npm run test
```

Useful commands:

```bash
npm run test:watch      # watch mode
npm run test:coverage   # full frontend coverage
```

#### Frontend targeted coverage
Target files:
- US1: `src/app/pages/KanbanBoard.tsx`
- US2: `src/app/pages/MeetingSummary.tsx`
- US3: `src/app/pages/MeetingChanges.tsx`

Run from repository root:

Windows (PowerShell), macOS, and Linux:

```bash
npm run test -- src/app/pages/__tests__/MeetingSummary.test.tsx src/app/pages/__tests__/MeetingChanges.test.tsx src/app/pages/__tests__/KanbanBoard.test.tsx --coverage --collectCoverageFrom="src/app/pages/KanbanBoard.tsx" --collectCoverageFrom="src/app/pages/MeetingSummary.tsx" --collectCoverageFrom="src/app/pages/MeetingChanges.tsx"
```

### Backend Testing

#### Prerequisites
- Java 21 JDK
- Maven 3.8+
- PostgreSQL 16+ (or Docker for local database)

#### Frameworks and Libraries (resolved by Maven)
Run Maven once to resolve all backend dependencies defined in `backend/pom.xml`, including:
- Spring Boot (Web, Data JPA, Security, Validation, WebSocket)
- Flyway
- PostgreSQL JDBC driver
- JWT libraries (`jjwt`)
- Jackson
- Lombok
- Spring Boot Test + Spring Security Test
- JaCoCo Maven plugin (coverage)

#### Install dependencies and run tests
From `backend` folder:

Windows (PowerShell), macOS, and Linux:

```bash
mvn clean install -DskipTests
mvn test
```

Run backend tests with coverage:

Windows (PowerShell), macOS, and Linux:

```bash
mvn clean test jacoco:report
```

Open JaCoCo HTML report:

Windows (PowerShell):

```powershell
start target/site/jacoco/index.html
```

macOS:

```bash
open target/site/jacoco/index.html
```

Linux:

```bash
xdg-open target/site/jacoco/index.html
```

Coverage artifacts:
- HTML report: `backend/target/site/jacoco/index.html`
- CSV report: `backend/target/site/jacoco/jacoco.csv`
- Test reports: `backend/target/surefire-reports`

#### Backend targeted coverage
Target files:
- U1: `backend/src/main/java/com/flowboard/service/ProjectService.java`
- U2: `backend/src/main/java/com/flowboard/service/SummaryService.java`
- U3: `backend/src/main/java/com/flowboard/service/ChangeApplicationService.java`

Run from backend folder:

Windows PowerShell:

```powershell
mvn "-Dtest=ProjectServiceTest,SummaryServiceTest,SummaryServiceUserStory2Test,ChangeApplicationServiceUserStory3Test" test jacoco:report
```

macOS/Linux (bash/zsh):

```bash
mvn -Dtest=ProjectServiceTest,SummaryServiceTest,SummaryServiceUserStory2Test,ChangeApplicationServiceUserStory3Test test jacoco:report
```

Print coverage for only those 3 backend files (PowerShell):

```powershell
$csv = Import-Csv "target/site/jacoco/jacoco.csv"
$targets = @("ProjectService", "SummaryService", "ChangeApplicationService")
$csv |
  Where-Object { $_.PACKAGE -eq "com.flowboard.service" -and $targets -contains $_.CLASS } |
  ForEach-Object {
    $miss = [double]$_.LINE_MISSED
    $cov = [double]$_.LINE_COVERED
    $pct = if (($miss + $cov) -gt 0) { [math]::Round((100 * $cov / ($miss + $cov)), 2) } else { 0 }
    [PSCustomObject]@{ Class = $_.CLASS; LineCoveragePct = $pct }
  } |
  Format-Table -AutoSize
```

Print coverage for only those 3 backend files (macOS/Linux shell):

```bash
awk -F, 'BEGIN { OFS="," } NR==1 || ($2=="com/flowboard/service" && ($3=="ProjectService" || $3=="SummaryService" || $3=="ChangeApplicationService")) { print }' target/site/jacoco/jacoco.csv | \
awk -F, 'NR==1 { next } { total=$8+$9; pct=(total>0)?(100*$9/total):0; printf "%s %.2f%%\n", $3, pct }'
```

Current backend results for these files:
- U1 ProjectService.java: 98.05%
- U2 SummaryService.java: 97.75%
- U3 ChangeApplicationService.java: 96.77%

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
