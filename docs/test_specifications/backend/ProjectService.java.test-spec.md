# ProjectService Test Specification

**Purpose**: Comprehensive unit tests for ProjectService.java with 80%+ code coverage  
**Focus**: Path coverage, exception handling, permission validation, and database isolation  
**Strategy**: All external dependencies (repositories, AIEngine, BoardGenerator, BoardBroadcastService) are mocked

---

## Implementation Status

| Aspect | Status |
|--------|--------|
| Total Tests | 120 ✅ |
| All Tests Passing | Yes ✅ |
| Code Coverage | 80%+ ✅ |
| Deterministic UUIDs | Implemented ✅ |
| Validation Constants | Implemented ✅ |
| Explicit Mock Verification | Implemented ✅ |
| Mock Strictness (STRICT_STUBS) | Future Phase 2 ⏳ |

### Key Improvements Implemented

1. **Deterministic Test Data** - All UUIDs and validation strings use named constants for reliability
2. **Explicit Mock Verification** - Broadcasting operations verify `times(1)` for exactly-once semantics
3. **Validation Threshold Isolation** - Changes to validation limits (e.g., 5→6 word requirement) require updating only one constant; ~30 affected tests auto-align

**Result**: Single-point updates prevent cascade failures when business rules change.

---

## Test Implementation Best Practices

### 1. Deterministic Test Data ✅ IMPLEMENTED
**What**: All UUIDs and validation strings defined as class-level constants  
**Constants**:
- User IDs: `OWNER_ID = 00000000-0000-0000-0000-000000000001`, `MEMBER1_ID = ...000000000002`, etc.
- Entity IDs: `PROJECT_ID = 00000000-0000-0000-0000-000001000001`, `BOARD_ID = ...000002000001`, etc.

**Benefit**: Deterministic test outputs, easy debugging, consistent logs across runs

### 2. Validation Threshold Constants ✅ IMPLEMENTED
**What**: All hardcoded validation strings replaced with named constants  
**Constants**:
- `VALID_AI_PROMPT_DESCRIPTION = "This is a five word description here"` (~15 tests use this)
- `INSUFFICIENT_AI_DESCRIPTION = "Only four words"` (~5 tests)
- `MAX_PROJECT_NAME_LENGTH = 255`, `MAX_PROJECT_DESCRIPTION_LENGTH = 5000`, `MAX_STAGE_TITLE_LENGTH = 100`

**Benefit**: Single-point updates. Changing 5→6 word requirement updates one constant; ~30 tests auto-align

### 3. Explicit Mock Verification ✅ IMPLEMENTED
**What**: Critical operations use explicit call counts (e.g., `verify(..., times(1))`)  
**Applied To**: Broadcasting events requiring exactly-once semantics
- `broadcastProjectCreated(ProjectDTO)`
- `broadcastCardUpdated(boardId, stageId, CardDTO)`
- `broadcastStageDeleted(boardId, stageId)`
- `broadcastTeamMemberAdded(projectId, TeamMemberDTO)`

**Benefit**: Detects duplicate calls that silent `verify(...)` would miss

### 4. Mock Strictness Configuration ⏳ PHASE 2
**Current**: Using `Strictness.LENIENT` with comprehensive documentation  
**Rationale**: Balancing stability with quality; 50+ tests with unused stubs documented for future refactoring  
**Future Path**: Phase 2 will switch to `STRICT_STUBS` after systematic refactoring

---

## Functions Under Test

| # | Function | Purpose |
|---|----------|---------|
| 1 | `createProject(CreateProjectRequest, User)` | Creates new project with optional AI board generation |
| 2 | `getProject(UUID, UUID)` | Retrieves project with board and members |
| 3 | `getUserProjects(UUID)` | Fetches all active projects for user |
| 4 | `updateProject(UUID, UUID, UpdateProjectRequest)` | Updates project name/description |
| 5 | `deleteProject(UUID, UUID)` | Marks project as deleted |
| 6 | `createCard(UUID, String, String, String, UUID, UUID)` | Creates new card in stage |
| 7 | `updateCard(UUID, String, String, String, UUID, UUID)` | Updates card properties |
| 8 | `moveCard(UUID, UUID, UUID)` | Moves card between stages |
| 9 | `deleteCard(UUID, UUID)` | Marks card as deleted |
| 10 | `addStage(UUID, String, String, UUID)` | Adds new stage to board |
| 11 | `deleteStage(UUID, UUID)` | Marks stage as deleted |
| 12 | `renameStage(UUID, String, UUID)` | Updates stage title |
| 13 | `getProjectMembers(UUID, UUID)` | Retrieves team members with roles |
| 14 | `addTeamMember(UUID, String, String, UUID)` | Adds member to project |
| 15 | `updateTeamMemberRole(UUID, UUID, String, UUID)` | Changes member role |
| 16 | `removeTeamMember(UUID, UUID, UUID)` | Removes member from project |
| 17+ | Helper methods | `toProjectDTO()`, `toStageDTO()`, `toCardDTO()`, `parsePriority()`, normalization utilities |

---

## Mocking Strategy

### Mocked Dependencies
| Component | Mocked Methods |
|-----------|----------------|
| **ProjectRepository** | `findActiveByOwnerAndNameIgnoreCase()`, `findById()`, `findActiveProjectsForUserId()`, `save()` |
| **BoardRepository** | `findByProjectId()`, `findById()`, `save()` |
| **StageRepository** | `findById()`, `findByBoardIdOrderByPosition()`, `save()` |
| **CardRepository** | `findById()`, `findByStageIdOrderByPosition()`, `save()` |
| **UserRepository** | `existsById()`, `findByEmailIgnoreCase()`, `findById()`, `findAllById()` |
| **ProjectMemberRepository** | `upsertMemberRole()`, `findMemberRole()`, `findProjectMemberRoles()`, `deleteMember()` |
| **AIEngine** | `analyzeProjectDescription()` returns controlled MeetingAnalysisResult |
| **BoardGenerator** | `generateEmptyBoard()`, `generateBoard()` |
| **BoardBroadcastService** | All broadcast methods (no-op for tests) |

---

## Test Specifications

| Test ID | Test Purpose | Test Inputs | Expected Output | Edge Cases / Mocks | Coverage Path |
|---------|--------------|-------------|-----------------|-------------------|----------------|
| **T1.1** | Create project with AI board generation enabled | `CreateProjectRequest(name="AI Project", description="5+ word description", generateTasks=true)`, owner=User(id=UUID1) | ProjectDTO with id, name, board generated via AIEngine, member list contains owner | Mock AIEngine.analyzeProjectDescription() returns valid AnalysisResult, Mock BoardGenerator.generateBoard() | Happy path + AI generation |
| **T1.2** | Create project without AI board generation | `CreateProjectRequest(name="Manual Project", description="Custom description", generateTasks=false)`, owner=User(id=UUID1) | ProjectDTO with name, empty board (via generateEmptyBoard), no AI processing | Mock BoardGenerator.generateEmptyBoard() | Happy path - manual board |
| **T1.3** | Create project with auto-generation default (null generateTasks) | `CreateProjectRequest(name="Default", description="5+ word desc", generateTasks=null)`, owner=User(id=UUID1) | ProjectDTO with AI-generated board (treats null as true) | generateTasks defaults to true when not specified | Default behavior |
| **T1.4** | Reject project creation: empty name | `CreateProjectRequest(name="", description="Valid description")` | Throw ResponseStatusException(BAD_REQUEST, "Project name is required") | Input validation before DB | Input validation |
| **T1.5** | Reject project creation: blank name (whitespace only) | `CreateProjectRequest(name="   ", description="Valid description")` | Throw ResponseStatusException(BAD_REQUEST, "Project name is required") | Trim and validate | Input validation |
| **T1.6** | Reject project creation: name exceeds 255 chars | `CreateProjectRequest(name="x" * 256, description="Valid desc")` | Throw ResponseStatusException(BAD_REQUEST, "Project name exceeds maximum length of 255") | Length validation | Input validation |
| **T1.7** | Reject project creation: description exceeds 5000 chars | `CreateProjectRequest(name="Valid", description="x" * 5001)` | Throw ResponseStatusException(BAD_REQUEST, "Project description exceeds maximum length of 5000") | Length validation | Input validation |
| **T1.8** | Reject project creation: insufficient description for AI generation | `CreateProjectRequest(name="Valid", description="Only 4 words", generateTasks=true)` | Throw ResponseStatusException(BAD_REQUEST, "Project description must contain at least 5 words for AI generation") | Word count validation | Input validation |
| **T1.9** | Reject project creation: duplicate project name for owner | `CreateProjectRequest(name="Existing")`, owner=User(id=UUID1) | Throw ResponseStatusException(CONFLICT, "Project name already exists for this owner") | Mock projectRepository.findActiveByOwnerAndNameIgnoreCase() returns non-empty list | Uniqueness constraint |
| **T1.10** | Allow case-insensitive duplicate name check | Create project named "My Project", then attempt "my project" | Throw CONFLICT error | Same name different case should be rejected | Case-insensitive validation |
| **T1.11** | Create project with null description | `CreateProjectRequest(name="Valid", description=null)` | ProjectDTO with null/empty description | normalizeOptionalText() handles null | Null handling |
| **T1.12** | Create project: owner added to members and role set to OWNER | Create project with owner User(UUID1) | Project.members contains owner, projectMemberRepository.upsertMemberRole(projectId, UUID1, "owner") called | Verify upsertMemberRole() is called | Access control setup |
| **T1.13** | Broadcast creation event | After successful createProject() | broadcastService.broadcastProjectCreated(ProjectDTO) invoked once | Mock broadcastService | Event broadcasting |
| **T1.14** | Create project: name trimming | `CreateProjectRequest(name="  Trimmed Project  ")` | ProjectDTO with name="Trimmed Project" | normalizeRequiredText() strips whitespace | Input validation |
| **T1.15** | Update project: name trimming | `request.name="  New Name  "` | ProjectDTO name="New Name" | Ensure whitespace is removed before saving | Trimming |
| **T2.1** | Get project as member with valid projectId and requesterId | projectId=UUID1, requesterId=UUID1 (owner) | ProjectDTO with project details, board, stages, cards | Mock projectRepository.findById() returns valid project with owner, mock boardRepository.findByProjectId() | Happy path |
| **T2.2** | Get project: project not found | projectId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Project not found") | Mock projectRepository.findById() returns empty | Not found handling |
| **T2.3** | Get project: project marked for deletion | projectId=UUID1, project.isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Project not found") | isDeletionMarked check | Soft delete verification |
| **T2.4** | Get project: user not project member | projectId=UUID1, requesterId=UUID999 (not member/owner) | Throw ResponseStatusException(FORBIDDEN, "You do not have access to this project") | isProjectMember() returns false | Access control |
| **T2.5** | Get project: no board exists | projectId=UUID1, boardRepository.findByProjectId() returns empty | ProjectDTO with boardId=null, empty columns list | Handle missing board gracefully | Edge case - no board |
| **T2.6** | Get project: board with multiple stages and cards | Full project structure | ProjectDTO.columns contains all non-deleted stages, all tasks present | Mock full board hierarchy | Complex structure |
| **T3.1** | Get user projects: valid userId with multiple projects | userId=UUID1 | List<ProjectDTO> with all active projects owned/shared with user | Mock projectRepository.findActiveProjectsForUserId() returns list | Happy path |
| **T3.2** | Get user projects: user not found | userId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "User not found") | Mock userRepository.existsById() returns false | User validation |
| **T3.3** | Get user projects: user with no projects | userId=UUID1, findActiveProjectsForUserId() returns empty | Empty List<ProjectDTO> returned (not error) | Mock returns empty list | Empty result handling |
| **T3.4** | Get user projects: user references include stages and cards | Multiple projects with boards | Each ProjectDTO includes related board data | Build board context for each project | Data aggregation |
| **T4.1** | Update project name | projectId=UUID1, userId=UUID1 (owner), request.name="Updated Name" | ProjectDTO with new name, old fields preserved | requireEditableProject() passes for owner | Happy path - owner edit |
| **T4.2** | Update project description | projectId=UUID1, request.description="New description" | ProjectDTO with new description | normalizeOptionalText() applied | Text update |
| **T4.3** | Update project: name not provided (null) | request.name=null | Project name unchanged | Conditional update only if name provided | Partial update |
| **T4.4** | Update project: description not provided (null) | request.description=null | Project description unchanged | Conditional update | Partial update |
| **T4.5** | Update project: name exceeds limit | request.name="x" * 256 | Throw ResponseStatusException(BAD_REQUEST, "Project name exceeds maximum length of 255") | Length validation | Validation |
| **T4.6** | Update project: duplicate name (after update) | Update to existing project's name | Throw ResponseStatusException(CONFLICT, "Project name already exists for this owner") | Check excludes current project | Uniqueness check |
| **T4.7** | Update project: non-owner EDITOR attempts update | userId=UUID2 (editor role) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") or allow for editor | Depends on ProjectMemberRole.canEdit() | Role-based access |
| **T4.8** | Update project: not found | projectId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Project not found") | getProjectForAccess() validates | Error handling |
| **T4.9** | Update project: broadcast update event | After successful update | broadcastService.broadcastProjectUpdated(projectId, ProjectDTO) called | Mock broadcastService | Event broadcasting |
| **T5.1** | Delete project as owner | projectId=UUID1, userId=UUID1 (owner) | Project.isDeletionMarked set to true, save called | ensureProjectOwner() passes | Happy path |
| **T5.2** | Delete project: non-owner not allowed | projectId=UUID1, userId=UUID2 (editor) | Throw ResponseStatusException(FORBIDDEN, "Only project owner can perform this action") | ensureProjectOwner() enforced | Access control |
| **T5.3** | Delete project: project not found | projectId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Project not found") | getProjectForAccess() validates | Error handling |
| **T5.4** | Delete project: broadcast deletion event | After delete | broadcastService.broadcastProjectDeleted(projectId) called | Mock broadcastService | Event broadcasting |
| **T6.1** | Create card in stage | stageId=UUID1, title="Task Title", description="Details", priority="HIGH", assigneeId=UUID1, userId=UUID1 (editor) | CardDTO with id, title, position=stageSize | Mock stage with 0 cards initially, newPosition=0 | Happy path |
| **T6.2** | Create card: stage not found | stageId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Stage not found") | Mock stageRepository.findById() returns empty | Not found |
| **T6.3** | Create card: stage marked for deletion | stageId=UUID1, stage.isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Stage not found") | Treat deleted stage as not found | Soft delete |
| **T6.4** | Create card: empty title | title="" | Throw ResponseStatusException(BAD_REQUEST, "Card title is required") | normalizeRequiredText() validation | Validation |
| **T6.5** | Create card: title exceeds 255 chars | title="x" * 256 | Throw ResponseStatusException(BAD_REQUEST, "Card title exceeds maximum length of 255") | Length check | Validation |
| **T6.6** | Create card: null description (optional) | description=null | CardDTO with null description | Optional field handling | Null handling |
| **T6.7** | Create card: invalid priority | priority="URGENT" | Throw ResponseStatusException(BAD_REQUEST, "Priority must be LOW, MEDIUM, HIGH, or CRITICAL") | parsePriority() validation | Enum validation |
| **T6.8** | Create card: assignee not project member | assigneeId=UUID999 | Throw ResponseStatusException(BAD_REQUEST, "Assignee must be a project member") | resolveAssignee() checks membership | Access validation |
| **T6.9** | Create card: assignee is project owner | assigneeId=ownerUUID | CardDTO with assignee set to owner | Special case: owner always valid | Edge case |
| **T6.10** | Create card: null assigneeId (unassigned) | assigneeId=null | CardDTO with assignee=null | resolveAssignee() returns null | Optional assignee |
| **T6.11** | Create card: user not editor | userId=UUID2 without edit permission | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() checks role | Access control |
| **T6.12** | Create card: broadcast card creation | After successful create | broadcastService.broadcastCardCreated(boardId, stageId, CardDTO) called | Mock broadcastService | Event broadcasting |
| **T7.1** | Update card: modify all fields | cardId=UUID1, new title/desc/priority/assignee | CardDTO with updated fields | Mock card lookup successful | Happy path |
| **T7.2** | Update card: null title (keep existing) | New title not provided but normalizeRequiredText requires it | Throw BAD_REQUEST if null passed explicitly | Function requires title param | Validation |
| **T7.3** | Update card: null priority (skip update) | priority=null | Card priority unchanged | Optional priority update | Partial update |
| **T7.4** | Update card: not found | cardId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Card not found") | cardRepository.findById() returns empty | Not found |
| **T7.5** | Update card: card marked deleted | cardId=UUID1, card.isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Card not found") | Soft delete check | Soft delete |
| **T7.6** | Update card: user not editor | userId=UUID2 (viewer) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() validates | Access control |
| **T7.7** | Update card: broadcast update event | After successful update | broadcastService.broadcastCardUpdated(boardId, stageId, CardDTO) called | Mock broadcastService | Event broadcasting |
| **T8.1** | Move card to different stage | cardId=UUID1, targetStageId=UUID2 | CardDTO with new stage, position updated | Source and target stages exist | Happy path |
| **T8.2** | Move card: card not found | cardId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Card not found") | Mock returns empty | Not found |
| **T8.3** | Move card: target stage not found | targetStageId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Target stage not found") | Mock returns empty | Not found |
| **T8.4** | Move card: target stage deleted | targetStageId=UUID2, isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Target stage not found") | Soft delete | Soft delete |
| **T8.5** | Move card: cross-project move attempt | Card in project1, target stage in project2 | Throw ResponseStatusException(BAD_REQUEST, "Cannot move card across projects") | boardId validation fails | Security constraint |
| **T8.6** | Move card: adjust position in old stage | Original stage has 3 cards at positions 0,1,2, moving card at pos 1 | Remaining cards updated to pos 0,1 | Position normalization after removal | Position consistency |
| **T8.7** | Move card: position in new stage | targetStage.getCards().size()=2 | Moved card position set to 2 | New position = target stage size | Position assignment |
| **T8.8** | Move card: user not editor | userId=UUID2 (viewer) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() enforced | Access control |
| **T8.9** | Move card: broadcast movement | After successful move | broadcastService.broadcastCardMoved(boardId, oldStageId, targetStageId, CardDTO, position) called | Mock broadcastService | Event broadcasting |
| **T9.1** | Delete card | cardId=UUID1 | Card.isDeletionMarked set to true | Mock card exists, editable project | Happy path |
| **T9.2** | Delete card: not found | cardId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Card not found") | Mock returns empty | Not found |
| **T9.3** | Delete card: already deleted | cardId=UUID1, card.isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Card not found") | Soft delete check | Idempotency |
| **T9.4** | Delete card: user not editor | userId=UUID2 (viewer) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() check | Access control |
| **T9.5** | Delete card: broadcast deletion | After successful delete | broadcastService.broadcastCardDeleted(boardId, stageId, cardId) called | Mock broadcastService | Event broadcasting |
| **T10.1** | Add stage to board | boardId=UUID1, title="In Progress", color="#FF0000", userId=UUID1 (editor) | StageDTO with id, title, position=boardStageCount | Mock board with 2 existing stages, newPosition=2 | Happy path |
| **T10.2** | Add stage: board not found | boardId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Board not found") | Mock boardRepository.findById() returns empty | Not found |
| **T10.3** | Add stage: board marked deleted | boardId=UUID1, board.isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Board not found") | Soft delete | Soft delete |
| **T10.4** | Add stage: empty title | title="" | Throw ResponseStatusException(BAD_REQUEST, "Stage title is required") | normalizeRequiredText() validation | Validation |
| **T10.5** | Add stage: title exceeds 100 chars | title="x" * 101 | Throw ResponseStatusException(BAD_REQUEST, "Stage title exceeds maximum length of 100") | Length validation | Validation |
| **T10.6** | Add stage: user not editor | userId=UUID2 (viewer) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() check | Access control |
| **T10.7** | Add stage: broadcast creation | After successful add | broadcastService.broadcastStageCreated(boardId, StageDTO) called | Mock broadcastService | Event broadcasting |
| **T11.1** | Delete stage | stageId=UUID1 | Stage.isDeletionMarked set to true | Mock stage exists, user has edit permission | Happy path |
| **T11.2** | Delete stage: not found | stageId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Stage not found") | Mock returns empty | Not found |
| **T11.3** | Delete stage: already deleted | stageId=UUID1, isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Stage not found") | Soft delete check | Soft delete |
| **T11.4** | Delete stage: user not editor | userId=UUID2 (viewer) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() enforced | Access control |
| **T11.5** | Delete stage: broadcast deletion | After successful delete | broadcastService.broadcastStageDeleted(boardId, stageId) called | Mock broadcastService | Event broadcasting |
| **T12.1** | Rename stage | stageId=UUID1, newTitle="In Review" | StageDTO with updated title | Mock stage lookup successful | Happy path |
| **T12.2** | Rename stage: empty title | newTitle="" | Throw ResponseStatusException(BAD_REQUEST, "Stage title is required") | normalizeRequiredText() validation | Validation |
| **T12.3** | Rename stage: title too long | newTitle="x" * 101 | Throw ResponseStatusException(BAD_REQUEST, "Stage title exceeds maximum length of 100") | Length check | Validation |
| **T12.4** | Rename stage: not found | stageId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Stage not found") | Mock returns empty | Not found |
| **T12.5** | Rename stage: marked deleted | stageId=UUID1, isDeletionMarked=true | Throw ResponseStatusException(NOT_FOUND, "Stage not found") | Soft delete | Soft delete |
| **T12.6** | Rename stage: user not editor | userId=UUID2 (viewer) | Throw ResponseStatusException(FORBIDDEN, "Viewer role is read-only") | requireEditableProject() check | Access control |
| **T12.7** | Rename stage: broadcast update | After successful rename | broadcastService.broadcastStageUpdated(boardId, StageDTO) called | Mock broadcastService | Event broadcasting |
| **T13.1** | Get project members | projectId=UUID1, userId=UUID1 (member) | List<TeamMemberDTO> sorted by role (owner first) then name | Mock project with mixed roles (owner, editors, viewers) | Happy path |
| **T13.2** | Get project members: owner access verified | Project members list includes all team participants | Access control implicitly checked via getProjectForAccess() | User must have project access | Access control |
| **T13.3** | Get project members: sorting order | Members list sorted by role (owner), then alphabetically by name | Owner appears first, then other members alphabetically | Comparator chain applied | Sorting |
| **T13.4** | Get project members: project not found | projectId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Project not found") | getProjectForAccess() validation | Not found |
| **T13.5** | Get project members: user not project member | userId=UUID999 | Throw ResponseStatusException(FORBIDDEN, "You do not have access to this project") | Access check in getProjectForAccess() | Access control |
| **T14.1** | Add team member | projectId=UUID1, email="new@example.com", role="editor", userId=UUID1 (owner) | TeamMemberDTO with new member, role="editor" | Lookup user by normalized email, verify not already member | Happy path |
| **T14.2** | Add team member: project not found | projectId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Project not found") | getProjectForAccess() validation | Not found |
| **T14.3** | Add team member: only owner can add | userId=UUID2 (non-owner) | Throw ResponseStatusException(FORBIDDEN, "Only project owner can perform this action") | ensureProjectOwner() enforced | Access control |
| **T14.4** | Add team member: cannot add another owner | role="owner" | Throw ResponseStatusException(BAD_REQUEST, "Cannot add another owner") | Prevent multiple owners | Business rule |
| **T14.5** | Add team member: user not found | email="nonexistent@example.com" | Throw ResponseStatusException(NOT_FOUND, "User not found. Ask them to register first before adding to the project.") | userRepository.findByEmailIgnoreCase() returns empty | Validation |
| **T14.6** | Add team member: user marked deleted | email="deleted@example.com", user.isDeletionMarked=true | Throw ResponseStatusException(BAD_REQUEST, "Cannot add deleted user") | Check user deletion status | Data integrity |
| **T14.7** | Add team member: user already member | email="existing@example.com" | Throw ResponseStatusException(CONFLICT, "User is already a member of this project") | roleMap.containsKey(userId) check | Duplicate prevention |
| **T14.8** | Add team member: user is owner | email owner@example.com" | Throw ResponseStatusException(CONFLICT, "User is already a member of this project") | Owner already member check | Edge case |
| **T14.9** | Add team member: case-insensitive email lookup | email="New@Example.COM" | Email normalized to lowercase for lookup | normalizeEmail() applied | Email normalization |
| **T14.10** | Add team member: broadcast addition | After successful add | broadcastService.broadcastTeamMemberAdded(projectId, TeamMemberDTO) called | Mock broadcastService | Event broadcasting |
| **T14.11** | Add team member: invalid role | role="invalid" | Throw ResponseStatusException(BAD_REQUEST, "Invalid member role") | Ensure role exists in Enum | Validation |
| **T15.1** | Update team member role | projectId=UUID1, targetUserId=UUID2, role="editor", userId=UUID1 (owner) | TeamMemberDTO with new role | Member exists, user not self, not owner, role not "owner" | Happy path |
| **T15.2** | Update team member: cannot update own role | targetUserId=UUID1 (same as userId) | Throw ResponseStatusException(BAD_REQUEST, "You cannot update your own role") | Self-role check | Business rule |
| **T15.3** | Update team member: cannot change owner role | project.getOwner().getId()=UUID1, targetUserId=UUID1 | Throw ResponseStatusException(BAD_REQUEST, "Cannot update project owner role") | Owner protection | Business rule |
| **T15.4** | Update team member: cannot assign owner role | role="owner" | Throw ResponseStatusException(BAD_REQUEST, "Cannot assign owner role") | Prevent new owners | Business rule |
| **T15.5** | Update team member: user not member | targetUserId=UUID999, projectMemberRepository.findMemberRole() returns empty | Throw ResponseStatusException(NOT_FOUND, "User is not a member of this project") | Membership check | Validation |
| **T15.6** | Update team member: target user not found | targetUserId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "User not found") | userRepository.findById() returns empty | Not found |
| **T15.7** | Update team member: only owner can update | userId=UUID2 (editor) | Throw ResponseStatusException(FORBIDDEN, "Only project owner can perform this action") | ensureProjectOwner() enforced | Access control |
| **T15.8** | Update team member: broadcast role change | After successful update | broadcastService.broadcastTeamMemberRoleChanged(projectId, targetUserId, role) called | Mock broadcastService | Event broadcasting |
| **T16.1** | Remove team member | projectId=UUID1, targetUserId=UUID2, userId=UUID1 (owner) | Member removed via projectMemberRepository.deleteMember() | Member exists, not owner, not requester | Happy path |
| **T16.2** | Remove team member: cannot remove self | targetUserId=UUID1 (same as userId) | Throw ResponseStatusException(BAD_REQUEST, "You cannot remove yourself from this project") | Self-remove check | Business rule |
| **T16.3** | Remove team member: cannot remove owner | project.getOwner().getId()=UUID1, targetUserId=UUID1 | Throw ResponseStatusException(BAD_REQUEST, "Cannot remove project owner") | Owner protection | Business rule |
| **T16.4** | Remove team member: user not member | targetUserId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "User is not a member of this project") | Membership verification | Validation |
| **T16.5** | Remove team member: only owner can remove | userId=UUID2 (editor) | Throw ResponseStatusException(FORBIDDEN, "Only project owner can perform this action") | ensureProjectOwner() enforced | Access control |
| **T16.6** | Remove team member: broadcast removal | After successful removal | broadcastService.broadcastTeamMemberRemoved(projectId, targetUserId) called | Mock broadcastService | Event broadcasting |
| **T16.7** | Remove team member: project not found | projectId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Project not found") | getProjectForAccess() validation | Not found |

---

## Priority Enum Validation

| Test ID | Input | Expected Output | Notes |
|---------|-------|-----------------|-------|
| **TPri1** | "low" | Card.Priority.LOW | Case-insensitive |
| **TPri2** | "medium" | Card.Priority.MEDIUM | Case-insensitive |
| **TPri3** | "high" | Card.Priority.HIGH | Case-insensitive |
| **TPri4** | "critical" | Card.Priority.CRITICAL | Case-insensitive |
| **TPri5** | "MeDiUm" | Card.Priority.MEDIUM | Uppercase before parse |
| **TPri6** | "URGENT" | ResponseStatusException(BAD_REQUEST) | Unsupported enum value |
| **TPri7** | null | ResponseStatusException(BAD_REQUEST) | No null priority |

---

## Permission Role Matrix

| Role | canEdit() | canCreateCard | canMoveCard | canDeleteCard | canUpdateProject | canRemoveMember | canAddMember |
|------|-----------|---------------|------------|---------------|-----------------|-----------------|-------------|
| OWNER | true | YES | YES | YES | YES | YES | YES |
| EDITOR | true | YES | YES | YES | NO | NO | NO |
| VIEWER | false | NO | NO | NO | NO | NO | NO |

---

## Text Normalization Test Cases

| Test ID | Input | Max Length | Expected | Behavior |
|---------|-------|-----------|----------|----------|
| **TNorm1** | "  Valid Text  " | 100 | "Valid Text" | Trim whitespace |
| **TNorm2** | "" | 100 | BAD_REQUEST | Empty after trim |
| **TNorm3** | null | 100 | BAD_REQUEST (for required) | Null check |
| **TNorm4** | "x" * 256 | 255 | BAD_REQUEST | Length exceeded |
| **TNorm5** | "valid-text" | 50 | "valid-text" | No changes needed |

---

## Developer Guidelines

### Quick Reference: Best Practices Checklist
- [ ] All UUIDs from defined constants (no `UUID.randomUUID()`)
- [ ] All validation strings use constants (no hardcoded thresholds)
- [ ] All validation limits use `MAX_*` constants
- [ ] Broadcasting operations use `verify(..., times(1))`
- [ ] Tests throwing early don't over-mock repositories
- [ ] Mock setup includes comments explaining purpose
- [ ] Test compiles without warnings
- [ ] Test passes with LENIENT mode

### When Adding New Tests

**1. Use Deterministic UUIDs**
```java
// ✅ DO - Use existing constants
UUID testId = OWNER_ID;

// ❌ DON'T - Random UUIDs
UUID testId = UUID.randomUUID();
```

**2. Use Constants for Validation Values**
```java
// ✅ DO - Single-point update
String description = VALID_AI_PROMPT_DESCRIPTION;

// ❌ DON'T - Hardcoded values
String description = "This is a five word description here";
```

**3. Verify Broadcasting with Explicit Counts**
```java
// ✅ DO - Catches duplicate calls
verify(broadcastService, times(1)).broadcastProjectCreated(any(ProjectDTO.class));

// ❌ DON'T - Silent to duplicates
verify(broadcastService).broadcastProjectCreated(any());
```

**4. Mock Only What's Required**
```java
// ✅ DO - Minimal mocks for early-throw tests
@Test
void createProject_withInvalidName_shouldThrow() {
    assertThrows(ResponseStatusException.class, () -> 
        projectService.createProject(new CreateProjectRequest(""), owner));
}

// ❌ DON'T - Over-mock before validation
when(projectRepository.findById(...)).thenReturn(...); // Never reached
```

### Test Data Reference
| Item | Constant | Update When |
|------|----------|------------|
| UUIDs | `OWNER_ID`, `MEMBER1_ID`, `PROJECT_ID`, `BOARD_ID`, etc. | Adding new entity types |
| AI threshold | `VALID_AI_PROMPT_DESCRIPTION` | Word requirement changes |
| Name max length | `MAX_PROJECT_NAME_LENGTH = 255` | Validation changes |
| Description max | `MAX_PROJECT_DESCRIPTION_LENGTH = 5000` | Validation changes |
| Stage title max | `MAX_STAGE_TITLE_LENGTH = 100` | Validation changes |

---

## Database Isolation

All tests use mocked repositories to ensure:
- No actual database connections during test execution
- Controlled return values via `.thenReturn()` and `.thenThrow()`
- Verification of repository interactions via `.verify()`
- Independent test execution without side effects

---

## Summary

**Path Coverage**: 82-85% (estimated)
- Happy paths: All main scenarios
- Error handling: All exception paths
- Permission checks: All role-based access scenarios
- Data validation: All field constraints
- Broadcasting: All event emissions
- Edge cases: Soft deletes, null values, duplicates, cross-project operations

**Not Covered (15-18%)**
- Internal DTO conversion helpers (simple mapping, low risk)
- Complex board hierarchy rendering with nested filters
- Edge cases in missing role mappings
