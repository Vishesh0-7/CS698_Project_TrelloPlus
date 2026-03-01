You are a senior product designer creating a high-fidelity UI mockup for an AI-powered workflow management web application.

Goal:
Design all UI screens and interface states for the following user story:

As a project manager, I want to provide a brief project description and have the AI automatically generate a Kanban board with appropriate workflow stages and pre-populated work items.

🖥 Product Context

This is a modern SaaS web application built with:

React (web-based SPA)

Kanban board interface

AI-powered board generation

Role-based access (Admin, Manager, Member, Viewer)

Design for desktop first (1440px width) but include responsive behavior annotations for tablet (1024px) and mobile (390px).

🎨 Design Requirements
1️⃣ Screen 1 – Dashboard / Projects List

Include:

Top navigation bar

Logo (left)

Search bar (center)

User avatar dropdown (right)

Sidebar (collapsible)

Dashboard

Projects

Boards

Settings

Main content area:

“Create New Project” primary button

Project cards grid (name, description preview, status badge)

Empty state (no projects yet)

Required States:

Empty state (illustration + CTA)

Loading state (skeleton cards)

Error state (API failure message)

Success state (projects displayed)

2️⃣ Screen 2 – Create Project (AI Board Generation)

Layout:

Page title: “Create New Project”

Form:

Project Name (input)

Project Description (large textarea)

AI helper tooltip explaining automatic board generation

Primary CTA button: “Generate AI Board”

Secondary button: Cancel

Required States:

Default form state

Validation error state (empty fields)

Loading state after clicking Generate:

Spinner

Text: “Analyzing project description…”

AI failure state:

“AI service unavailable. Retry?”

Success state:

Redirect preview modal of generated board structure

3️⃣ Screen 3 – Generated Kanban Board View

Layout:

Top bar:

Board name

Project breadcrumb

Share button

Board settings menu

Horizontal scrollable Kanban board:

Columns (Stages)

Cards inside columns

Card design should include:

Title

Short description preview

Assignee avatar

Priority badge (LOW, MEDIUM, HIGH, CRITICAL)

Created date

Required Board States:

Empty board state

AI-generated populated board

Drag-and-drop hover state

Card selected (modal open)

Card edit mode

Error saving card

Offline state (banner: “You are offline. Changes will sync when connected.”)

4️⃣ Card Detail Modal

Include:

Title (editable)

Description (rich text)

Assignee dropdown

Priority selector

Comment section

Activity history

Delete card button

States:

Default view

Editing mode

Saving state

Error state

Success confirmation

🎯 Visual Design Guidelines

Style:

Clean modern SaaS aesthetic

Soft shadows

Rounded corners (8px–12px)

8pt spacing system

Subtle background (#F9FAFB or similar)

Neutral grayscale palette + one primary accent color (blue or purple)

Typography:

Headings: Bold

Body: Regular

Clear hierarchy (H1, H2, H3, body, caption)

📱 Responsive Behavior (Annotate in Figma)

Clearly annotate:

Sidebar collapses to icons at < 1024px

Kanban columns become horizontally scrollable

Cards stack vertically on mobile

Modal becomes full screen on mobile

Navigation becomes hamburger menu on mobile

Add notes explaining layout changes.

🧠 Interaction Notes (Add Annotations)

Document:

Drag and drop behavior between columns

Hover states

Button pressed states

Loading animations

API failure feedback behavior

Token expiration behavior (session timeout modal)

🔐 Role-Based UI Differences

Include variations for:

Admin (can manage users)

Manager (create/edit boards)

Member (edit assigned cards only)

Viewer (read-only board)

Indicate disabled buttons where applicable.

📦 Deliverables in Figma

Separate frames for each screen

Variants for each state (use Auto Layout and Components)

Clearly labeled components:

Button

Input

Card

Column

Modal

Navbar

Use component variants for:

Button states (default / hover / disabled / loading)

Card states

Form states

If you want, I can also give you:

✅ A simplified version (if your professor doesn’t need extreme detail)

✅ A checklist to make sure you get full grading credit

✅ A component breakdown so you can build it faster in Figma

✅ A layout wireframe structure so you don’t get stuck staring at a blank canvas

It is just a UI mock up 

Perfect — since this is just a UI mockup (not full UX system design), you don’t need all that enterprise-level detail.

Here’s a clean, simplified prompt you can paste into Figma AI to generate exactly what your assignment requires — nothing excessive.

✅ Simple Figma Prompt (High-Fidelity UI Mockup)

You are a senior UI designer.

Create high-fidelity desktop mockups (1440px width) for an AI-powered Kanban workflow web application.

User Story:
As a project manager, I want to enter a project description and have the system automatically generate a Kanban board with workflow stages and tasks.

Design the following screens with all interface states:

1️⃣ Dashboard / Projects Page

Include:

Top navigation bar (logo, search, user avatar)

Sidebar (Dashboard, Projects, Boards, Settings)

“Create New Project” button

Project cards grid

Include these states:

Empty state (no projects yet)

Loading state (skeleton cards)

Error state (API failure message)

Normal state (projects visible)

2️⃣ Create Project Page (AI Board Generation)

Include:

Project Name input

Project Description textarea

“Generate AI Board” primary button

Cancel button

Include these states:

Default form

Validation error (empty fields)

Loading state (spinner + “Analyzing project…”)

AI error state

Success state (transition to board view)

3️⃣ Kanban Board View

Include:

Board title at top

Horizontal columns (To Do, In Progress, Review, Done)

Cards inside columns

Each card must include:

Title

Short description

Assignee avatar

Priority tag

Include these states:

Empty board

Board populated with AI-generated tasks

Dragging a card

Card hover state

Error saving card

Offline banner at top

4️⃣ Card Detail Modal

Include:

Editable title

Description field

Assignee dropdown

Priority selector

Comment section

Save + Delete buttons

Include:

Default view

Editing state

Saving state

Error state

Success state

Visual Style Requirements

Clean modern SaaS design

Rounded corners (8–12px)

Soft shadows

Neutral light background

Blue or purple primary color

Clear typography hierarchy

8px spacing system

Responsive Annotation Requirement

Add small text annotations explaining:

Sidebar collapses on smaller screens

Kanban becomes horizontally scrollable

Modal becomes full screen on mobile

Technical Detail Requirement

Include enough visual detail for a developer to implement:

Spacing

Button states (default / hover / disabled)

Input states (focused / error)

Hover effects

Drag-and-drop indication