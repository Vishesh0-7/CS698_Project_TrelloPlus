import React from "react";
import { createBrowserRouter } from "react-router";
import { Dashboard } from "./pages/Dashboard";
import { CreateProject } from "./pages/CreateProject";
import { KanbanBoard } from "./pages/KanbanBoard";
import { ProjectView } from "./pages/ProjectView";
import { Root } from "./pages/Root";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Logout } from "./pages/Logout";
import { ForgotPassword } from "./pages/ForgotPassword";
import { Meetings } from "./pages/Meetings";
import { MeetingSummary } from "./pages/MeetingSummary";
import { CreateMeeting } from "./pages/CreateMeeting";
import { MeetingTranscript } from "./pages/MeetingTranscript";
import { MeetingChanges } from "./pages/MeetingChanges";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Application routes configuration
export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/logout",
    Component: Logout,
  },
  {
    path: "/",
    element: <ProtectedRoute><Root /></ProtectedRoute>,
    children: [
      { index: true, Component: Dashboard },
      { path: "create-project", Component: CreateProject },
      { path: "project/:projectId", Component: ProjectView },
      { path: "project/:projectId/create-meeting", Component: CreateMeeting },
      { path: "board/:projectId", Component: KanbanBoard },
      { path: "meetings", Component: Meetings },
      { path: "create-meeting", Component: CreateMeeting },
      { path: "meeting-transcript/:meetingId", Component: MeetingTranscript },
      { path: "meetings/:meetingId", Component: MeetingSummary },
      { path: "meetings/:meetingId/changes", Component: MeetingChanges },
      { path: "profile", Component: Profile },
      { path: "settings", Component: Settings },
    ],
  },
]);
