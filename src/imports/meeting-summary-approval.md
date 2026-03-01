Figma Make Prompt (Frontend Feature Addition)

Context
You are working on an existing React + TypeScript web application frontend.
The frontend for User Story #1 (live meeting capture) is already implemented and must remain unchanged.
You are now implementing User Story #2 only.

User Story #2

As a meeting facilitator, I want to end the meeting and automatically generate a structured summary of action items, decisions, and changes, displayed in a separate approval checklist section, so that attendees can review and approve before changes take effect.

Task

Design and implement the frontend UI and interaction flow for the Meeting Summary & Approval Checklist feature.

Scope & Constraints

Do NOT modify existing meeting capture UI

Do NOT redesign global navigation or layout

Add new components, views, and states only where necessary

Assume backend APIs already exist and function correctly

Focus on clarity, reviewability, and approval UX

Required UI Components
1. End Meeting → Summary Generation State

Add an “End Meeting” confirmation flow

After confirmation:

Show a loading / generating summary state

Display progress indicator (e.g. “Analyzing meeting notes…”)

Handle error and retry states

2. Meeting Summary View (New Screen or Panel)

Create a Meeting Summary view containing:

A. Summary Header

Meeting title

Date & duration

Summary status badge: Pending Approval / Approved / Rejected

B. Structured Sections (Collapsible)

Each section should be visually distinct and scannable:

Action Items

Checkbox per item

Description

Assignee (if present)

Due date (if present)

Priority badge

Expandable “source context”

Decisions

Decision description

Rationale (if present)

Impact summary

Timestamp

Expandable context

Changes

Change description

Change type badge

Impact level badge

Affected entities list

Expandable context

3. Approval Checklist Interface

Each summary item has:

Approve / Reject toggle

Optional comment field

Section-level approval indicators

Overall approval progress indicator (e.g. “3 of 5 approvers”)

Disabled editing once user submits approval

4. Approval Actions

Primary CTA: Submit Approval

Secondary CTA: Request Changes

Confirmation modal before submission

Read-only mode once approval is finalized

Interaction & State Requirements

Loading, empty, error, and success states for all sections

Optimistic UI updates on approval actions

Clear visual distinction between:

Pending

Approved

Rejected items

Accessibility-friendly components (keyboard + contrast safe)

Design Expectations

Match existing design system (colors, typography, spacing)

Use cards, badges, and collapsible panels

Emphasize review clarity over data density

No visual noise; this is a “decision moment” screen

Deliverables

New components for:

MeetingSummaryView

ActionItemList

DecisionList

ChangeList

ApprovalChecklist

Updated meeting flow showing transition from “Active Meeting” → “Summary Review”

Responsive layouts for desktop and tablet