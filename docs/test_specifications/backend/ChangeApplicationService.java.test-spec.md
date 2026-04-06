# ChangeApplicationService Test Specification

**Purpose**: Comprehensive unit test specification for ChangeApplicationService.java achieving 80%+ code coverage  
**Focus**: Change application workflow, board state mutations, error handling and recovery, audit logging, permission validation, and frontend isolation  
**Isolation Strategy**: All repositories, ObjectMapper, and BoardBroadcastService will be mocked to ensure deterministic testing without database or network dependencies

---

## Functions to Test

1. `applyChange(UUID changeId, User actor)` - Main entry point for applying a pending change to the board
2. `ensureProjectOwner(Change change, UUID userId)` - Validates user is project owner
3. `createSnapshot(Change change, Board board)` - Creates pre-application board state snapshot
4. `applyByType(Change change, Board board)` - Dispatches to type-specific applier
5. `applyMoveCard(Board board, JsonNode before, JsonNode after)` - Moves card to target stage
6. `applyUpdateCard(Board board, JsonNode before, JsonNode after)` - Updates card properties
7. `applyCreateCard(Board board, JsonNode after)` - Creates new card
8. `applyDeleteCard(Board board, JsonNode before, JsonNode after)` - Deletes card
9. `parseJsonOrEmpty(String value)` - Safe JSON parsing with empty object fallback
10. `readUuid(JsonNode node, String field, UUID fallback)` - Safe UUID field extraction
11. Helper methods: `findFirstStage()`, `findAnyCardOnBoard()`, `findMoveTargetStage()`, `createFallbackCard()`, `audit()`, `safe()`

---

## Mocking Strategy

### Mocked Dependencies
- **ChangeRepository**: Mock `findById()`, `save()` to control change state transitions
- **BoardRepository**: Mock `findByProjectId()` to return board for change application
- **StageRepository**: Mock `findById()`, `findByBoardIdOrderByPosition()` for stage resolution
- **CardRepository**: Mock `findById()`, `findByStageIdOrderByPosition()`, `save()`, `delete()` for card operations
- **UserRepository**: Mock `findById()` for assignee resolution
- **ProjectMemberRepository**: Mock `findMemberRole()` for permission checks
- **ChangeSnapshotRepository**: Mock `save()` for snapshot creation and verification tracking
- **ChangeAuditEntryRepository**: Mock `save()` for audit trail logging
- **ObjectMapper**: Mock `readTree()` for JSON parsing, controlled return of JsonNode objects
- **BoardBroadcastService**: Mock all broadcast methods (no-op)

### Mock Object Setup
- `createMockCard(UUID id, String title, Stage stage, int position, Card.Priority priority, User assignee)` - Card factory
- `createMockStage(UUID id, String title, Board board, List<Card> cards)` - Stage factory with card collection
- `createMockBoard(UUID id, Project project, List<Stage> stages)` - Board factory with stages
- `createMockChange(UUID id, Meeting meeting, Change.ChangeType type, String beforeState, String afterState, Change.ChangeStatus status)` - Change factory
- `createMockJsonNode(Map<String, Object> data)` - JSON node factory
- `createMockChangeSnapshot(Change change, Board board, ChangeSnapshot.VerificationStatus status)` - Snapshot factory

---

## Test Specifications

| Test ID | Test Purpose | Test Inputs | Expected Output | Edge Cases / Mocks | Coverage Path |
|---------|--------------|-------------|-----------------|-------------------|----------------|
| **T1.1** | Apply change: happy path | changeId=UUID1, actor=User(id=ownerUUID), change.status=PENDING | Change.status=APPLIED, applyByType() called, snapshot created and verified, audit entry logged, broadcast events sent | Mock all repositories, change with MOVE_CARD type | Happy path |
| **T1.2** | Apply change: change not found | changeId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Change not found") | changeRepository.findById() returns empty | Not found handling |
| **T1.3** | Apply change: user not project owner | actor=User(id=editorUUID), change.meeting.project.owner.id != editorUUID | Throw ResponseStatusException(FORBIDDEN, "Only the project owner can apply changes") OR "User is not a project member" | ensureProjectOwner() check | Access control |
| **T1.4** | Apply change: status not applicable | change.status=APPLIED (already applied) | Throw ResponseStatusException(BAD_REQUEST, "Change is not ready for application") | Verify status check allows READY_FOR_APPLICATION, APPROVED, PENDING, UNDER_REVIEW | Status validation |
| **T1.5** | Apply change: board not found | changeId=UUID1, boardRepository.findByProjectId() returns empty | Throw ResponseStatusException(NOT_FOUND, "Board not found for project") | Verify board lookup | Not found |
| **T1.6** | Apply change: status transitions PENDING→APPLYING | Before applyByType() | change.status set to APPLYING, saved to repo, broadcast status change | Verify state transition before mutation | Pre-mutation state |
| **T1.7** | Apply change: successful application | After applyByType() succeeds | change.status=APPLIED, change.appliedBy=actor, change.appliedAt=now | Verify final state after successful application | Post-mutation state |
| **T1.8** | Apply change: snapshot created pre-apply | Before mutation | ChangeSnapshot created with boardState, rollbackState, status=PENDING | createSnapshot() called before applyByType() | Snapshot creation |
| **T1.9** | Apply change: snapshot verified after success | After successful apply | snapshot.verificationStatus=VERIFIED, snapshot.appliedAt=now, saved | Verify post-application snapshot state | Snapshot verification |
| **T1.10** | Apply change: snapshot failed on exception | Exception during applyByType() | snapshot.verificationStatus=FAILED, saved | Catch exception, mark snapshot as failed | Error recovery |
| **T1.11** | Apply change: rollback on exception | applyByType() throws exception | change.status=ROLLED_BACK, saved, audit logged | Set rolled-back status on failure | Rollback mechanism |
| **T1.12** | Apply change: broadcast status change (PENDING→APPLYING) | state transition | broadcastService.broadcastChangeStatusChanged(projectId, changeId, "APPLYING") called | Mock broadcastService | Event broadcasting |
| **T1.13** | Apply change: broadcast status change (APPLYING→APPLIED) | successful completion | broadcastService.broadcastChangeStatusChanged(projectId, changeId, "APPLIED") called | Mock broadcastService | Event broadcasting |
| **T1.14** | Apply change: broadcast change applied event | successful application | broadcastService.broadcastChangeApplied(projectId, changeId) called | Mock broadcastService | Event broadcasting |
| **T1.15** | Apply change: broadcast rollback status | on failure | broadcastService.broadcastChangeStatusChanged(projectId, changeId, "ROLLED_BACK") called | Mock broadcastService | Event broadcasting |
| **T1.16** | Apply change: audit APPLICATION_STARTED | before mutation | audit(change, actor, APPLICATION_STARTED, '{"status":"APPLYING"}') called | Verify audit entry creation | Audit logging |
| **T1.17** | Apply change: audit APPLICATION_SUCCEEDED | after success | audit(change, actor, APPLICATION_SUCCEEDED, '{"status":"APPLIED"}') called | Verify success audit | Audit logging |
| **T1.18** | Apply change: audit ROLLED_BACK | on exception | audit(change, actor, ROLLED_BACK, "{\"reason\":\"...message...\"}") called | Verify rollback audit with exception message | Audit logging |
| **T1.19** | Apply change: exception message sanitized | applyByType throws "Error with \"quotes\"" | Audit details have quotes replaced with single quotes | safe() method called | Security |
| **T1.20** | Apply change: null exception message handled | applyByType throws exception with null message | Audit details use "unknown" instead of null | safe() handles null | Null safety |
| **T1.21** | Apply change: response DTO after success | Return ChangeApplyResultDTO | DTO.changeId=changeId, DTO.status="APPLIED", DTO.applied=true, DTO.message="Change applied successfully" | Builder pattern applied | Response structure |
| **T1.22** | Apply change: exception re-thrown | Exception during apply | Original exception wrapped in ResponseStatusException(BAD_REQUEST, "Change application failed: " + message) | Throw after rollback | Error handling |
| **T2.1** | Ensure project owner: user is project owner | user.id=project.owner.id | No exception thrown | Happy path - owner check passes | Happy path |
| **T2.2** | Ensure project owner: user in project_members with owner role | project.owner=null but projectMemberRepository.findMemberRole() returns "owner" | No exception thrown | Fallback to project_members table | Fallback path |
| **T2.3** | Ensure project owner: user not owner, not in project_members | project_members lookup returns empty | Throw ResponseStatusException(FORBIDDEN, "User is not a project member") | Missing member entry | Not member |
| **T2.4** | Ensure project owner: user in project_members but not owner role | findMemberRole() returns "editor" | Throw ResponseStatusException(FORBIDDEN, "Only the project owner can apply changes") | Role check | Access control |
| **T3.1** | Create snapshot: board state JSON created | Board.id=UUID1 | ChangeSnapshot.boardState='{"boardId":"UUID1","snapshotType":"PRE_APPLY"}' | Pre-apply board state | Snapshot data |
| **T3.2** | Create snapshot: rollback state equals board state | | ChangeSnapshot.rollbackState=boardState | Same initial state | Rollback setup |
| **T3.3** | Create snapshot: verification status PENDING | | ChangeSnapshot.verificationStatus=PENDING | Ready for verification | Initial state |
| **T3.4** | Create snapshot: persisted to repository | After creation | changeSnapshotRepository.save(snapshot) called once | Verify persistence | Repository interaction |
| **T4.1** | Apply by type: MOVE_CARD dispatched | change.changeType=MOVE_CARD | applyMoveCard(board, before, after) called | Logic dispatcher | Dispatch logic |
| **T4.2** | Apply by type: UPDATE_CARD dispatched | change.changeType=UPDATE_CARD | applyUpdateCard(board, before, after) called | Logic dispatcher | Dispatch logic |
| **T4.3** | Apply by type: CREATE_CARD dispatched | change.changeType=CREATE_CARD | applyCreateCard(board, after) called (before not provided) | Logic dispatcher | Dispatch logic |
| **T4.4** | Apply by type: DELETE_CARD dispatched | change.changeType=DELETE_CARD | applyDeleteCard(board, before, after) called | Logic dispatcher | Dispatch logic |
| **T4.5** | Apply by type: illegal change type | change.changeType=null or unknown | Throw IllegalStateException("Unsupported change type") | Unsupported types | Error handling |
| **T4.6** | Apply by type: JSON parsing | change.beforeState='{"id":"UUID1"}', afterState='{"stageId":"UUID2"}' | parseJsonOrEmpty() returns JsonNode objects | JSON parsing calls | Data parsing |
| **T5.1** | Move card: happy path | before={"id":"UUID1"}, after={"id":"UUID1","stageId":"UUID2"} | card.stage=targetStage, saved | Mock card and stage found | Happy path |
| **T5.2** | Move card: missing card ID | before={}, after={} | Throw IllegalArgumentException("MOVE_CARD payload is missing required card/stage identifiers") | readUuid() returns null for both | Validation |
| **T5.3** | Move card: missing stage ID | after={"id":"UUID1"} (no stageId/columnId) | Throw IllegalArgumentException("MOVE_CARD payload is missing required card/stage identifiers") | readUuid() returns null for stage | Validation |
| **T5.4** | Move card: card ID from before state | before={"id":"UUID1"}, after={} | Card found with ID from before | readUuid() fallback logic | Fallback parsing |
| **T5.5** | Move card: stage ID from columnId field | after={"columnId":"UUID2"} (no stageId) | Stage found using columnId field | readUuid() tries stageId then columnId | Field fallback |
| **T5.6** | Move card: card not found | cardId=UUID999 | Throw IllegalArgumentException("Card not found: UUID999") | cardRepository.findById() returns empty | Not found |
| **T5.7** | Move card: target stage not found | stageId=UUID999 | Throw IllegalArgumentException("Stage not found: UUID999") | stageRepository.findById() returns empty | Not found |
| **T5.8** | Move card: card ID type parsed from string | after={"id":"36fa6e01-..."} | UUID.fromString() succeeds | String UUID parsing | Type conversion |
| **T5.9** | Move card: invalid UUID string | after={"id":"not-a-uuid"} | readUuid() returns fallback | UUID.fromString() throws | Error recovery |
| **T6.1** | Update card: happy path | after={"id":"UUID1","title":"New Title","stageId":"UUID2"} | card.title/stageId updated, saved | Mock card found | Happy path |
| **T6.2** | Update card: missing card ID | after={} (no id) | Throw IllegalArgumentException("UPDATE_CARD payload is missing required card identifier") | readUuid(after, "id") returns null | Validation |
| **T6.3** | Update card: card not found | cardId=UUID999 | Throw IllegalArgumentException("Card not found: UUID999") | cardRepository.findById() returns empty | Not found |
| **T6.4** | Update card: update title from after state | after={"id":"UUID1","title":"Updated"} | card.setTitle("Updated") called | hasNonNull("title") check | Field update |
| **T6.5** | Update card: null title fallback | after={"id":"UUID1"} (no title), before={} (no title) | card.title=card.title+" (Updated)" | Neither before/after has title | Fallback logic |
| **T6.6** | Update card: update description | after={"description":"New desc"} | card.setDescription("New desc") | Standard field update | Field update |
| **T6.7** | Update card: null description (clear) | after={"description":null} | card.setDescription(null) | JSON null parsed | Null handling |
| **T6.8** | Update card: update priority | after={"priority":"HIGH"} | card.setPriority(Priority.HIGH) | String to enum conversion | Enum conversion |
| **T6.9** | Update card: invalid priority string | after={"priority":"INVALID"} | Throw IllegalArgumentException or similar | Priority.valueOf() fails | Validation |
| **T6.10** | Update card: update stage | after={"stageId":"UUID2"} | card.setStage(stage), stageRepository.findById() called | Stage lookup | Relationship update |
| **T6.11** | Update card: update assignee | after={"assigneeId":"UUID3"} | card.setAssignee(user), userRepository.findById() called | User lookup | Relationship update |
| **T6.12** | Update card: assignee not found | after={"assigneeId":"UUID999"} | Throw IllegalArgumentException("Assignee not found: UUID999") | userRepository.findById() returns empty | Not found |
| **T6.13** | Update card: columnId field as stage fallback | after={"columnId":"UUID2"} | readUuid() tries stageId then columnId | Field fallback | Field fallback |
| **T7.1** | Create card: happy path | after={"stageId":"UUID1","title":"New Card"} | Card created in stage with title, position=stage.size | Mock stage found | Happy path |
| **T7.2** | Create card: missing stage ID | after={} (no stageId/columnId) | Try findFirstStage(), use if available | Fallback to first stage | Fallback logic |
| **T7.3** | Create card: no stage found (empty board) | Board has 0 stages | Throw IllegalArgumentException("CREATE_CARD could not resolve stage from mocked data and board state") | Both explicit stageId and fallback return null | Validation |
| **T7.4** | Create card: use fallback stage if looked up | fallbackStage!=null && fallbackStage.id==resolvedStageId | Use fallback instead of re-querying | Optimization | Optimization |
| **T7.5** | Create card: default title | after={} (no title) or after={"title":""} | card.title="Mock generated task" | Empty/missing title fallback | Fallback data |
| **T7.6** | Create card: default description | after={} (no description) | card.description=null | No description OK | Optional field |
| **T7.7** | Create card: default priority | after={} (no priority) | card.priority=MEDIUM | Parse to enum or default | Default value |
| **T7.8** | Create card: parse priority from string | after={"priority":"HIGH"} | card.priority=MEDIUM (default if invalid) | Priority parsing | Type conversion |
| **T7.9** | Create card: position assigned | stage has 3 cards | card.position=3 | New card appended | Position assignment |
| **T7.10** | Create card: null stage cards (edge case) | stage.getCards()=null | position=0 | Handle null cards list | Null safety |
| **T7.11** | Create card: columnId field as stage lookup | after={"columnId":"UUID1"} (no stageId) | readUuid() tries stageId then columnId | Field fallback | Field fallback |
| **T8.1** | Delete card: happy path | before={"id":"UUID1"} | cardRepository.delete(card) called | Mock card found | Happy path |
| **T8.2** | Delete card: missing card ID | before={} (no id), after={} (no id) | Throw IllegalArgumentException("DELETE_CARD payload is missing required card identifier") | readUuid() returns null | Validation |
| **T8.3** | Delete card: card not found | cardId=UUID999 | Throw IllegalArgumentException("Card not found: UUID999") | cardRepository.findById() returns empty | Not found |
| **T8.4** | Delete card: card ID from after state fallback | before={}, after={"id":"UUID1"} | Card found using after.id | readUuid() fallback | Fallback parsing |
| **T9.1** | Parse JSON or empty: valid JSON string | value='{"id":"UUID1","title":"Card"}' | JsonNode with properties | objectMapper.readTree() returns valid node | Happy path |
| **T9.2** | Parse JSON or empty: null string | value=null | JsonNode representing empty object {} | readTree("{}") called | Null handling |
| **T9.3** | Parse JSON or empty: blank string | value="   " | JsonNode representing empty object {} | isBlank() check | Blank handling |
| **T9.4** | Parse JSON or empty: invalid JSON | value="{invalid}" | Throw exception OR return empty node based on try-catch | objectMapper.readTree() throws | Error handling |
| **T10.1** | Read UUID: valid UUID string | node={"id":"36fa6e01-..."}, field="id" | UUID object parsed | UUID.fromString() succeeds | Happy path |
| **T10.2** | Read UUID: missing field | node={"name":"Card"}, field="id" | Returns fallback UUID | !hasNonNull(field) check | Missing field |
| **T10.3** | Read UUID: null node | node=null | Returns fallback UUID | null check first | Null safety |
| **T10.4** | Read UUID: invalid UUID string | node={"id":"not-uuid"}, field="id" | Returns fallback UUID | UUID.fromString() throws, caught | Error recovery |
| **T10.5** | Read UUID: null fallback parameter | readUuid(node, field, null) with missing/invalid field | Returns null | Explicit null fallback | Null fallback |
| **T11.1** | Find first stage: board has 3 stages | Stages ordered by position | Returns stages.get(0) | stageRepository.findByBoardIdOrderByPosition() | Happy path |
| **T11.2** | Find first stage: board has 1 stage | Single stage | Returns that stage | stageRepository call | Edge case |
| **T11.3** | Find first stage: board empty | stages=empty list | Returns null | Handle empty list | Edge case |
| **T12.1** | Find any card on board: card exists on first stage | First stage of 3 stages has cards | Returns first card found | Loop and return first available | Happy path |
| **T12.2** | Find any card on board: card on second stage | First stage empty, second stage has card | Returns card from second stage | Iterate through stages | Search logic |
| **T12.3** | Find any card on board: no board cards | All stages empty | Returns null | Loop completes without match | Edge case |
| **T13.1** | Find move target stage: current stage not null | currentStage exists, other stage available | Returns different stage | Loop excludes current | Happy path |
| **T13.2** | Find move target stage: current stage null | currentStage=null | Returns first stage (index 0) | Special case | Edge case |
| **T13.3** | Find move target stage: only 1 stage total | stages=[stage1] | Returns stages.get(0) even if current | Fallback to first | Edge case |
| **T13.4** | Find move target stage: empty stages list | stages=[] | Returns null | Handle empty | Edge case |
| **T14.1** | Create fallback card: stage with 2 cards | stage.cards.size()=2 | card.position=2, title provided | Card appended to stage | Happy path |
| **T14.2** | Create fallback card: stage with null cards list | stage.cards=null | position=0 | Handle null cards collection | Null safety |
| **T14.3** | Create fallback card: persisted to repository | After creation | cardRepository.save(card) called, returns saved card | Verify persistence | Repository call |
| **T15.1** | Audit: entry created with correct fields | action=APPLICATION_STARTED, details='{"status":"APPLYING"}' | ChangeAuditEntry with change, actor, action, details | All fields set | Audit data |
| **T15.2** | Audit: audit repository called | After audit() | changeAuditEntryRepository.save(entry) called | Verify persistence | Repository call |
| **T16.1** | Safe string: quotes replaced | text='Error with "quotes"' | Returns 'Error with \'quotes\'' | Replace " with ' | Safety |
| **T16.2** | Safe string: null handled | text=null | Returns "unknown" | null check with ternary | Null safety |

---

## Change Status State Machine

| Current Status | API Input Allowed | Action Triggered | Next Status | Notes |
|----------------|------------------|-----------------|-------------|-------|
| PENDING | applyChange() | Board mutation | APPLYING→APPLIED (on success) or ROLLED_BACK (on failure) | Initial application |
| UNDER_REVIEW | applyChange() | Board mutation | APPLYING→APPLIED or ROLLED_BACK | Mock-generated status |
| APPROVED | applyChange() | Board mutation | APPLYING→APPLIED or ROLLED_BACK | Approved by owner |
| READY_FOR_APPLICATION | applyChange() | Board mutation | APPLYING→APPLIED or ROLLED_BACK | Explicit ready state |
| APPLIED | applyChange() | REJECTED (BAD_REQUEST) | No change | Already applied, no re-application |
| ROLLED_BACK | applyChange() | REJECTED (BAD_REQUEST) | No change | Failed, no retry |

---

## Board Mutation Operation Types

| Operation | Input Fields | Card Movement | New Card Required | Stage Required |
|-----------|--------------|---|---|---|
| MOVE_CARD | cardId, targetStageId | YES | NO | YES - must exist |
| UPDATE_CARD | cardId, title?, description?, priority?, stageId?, assigneeId? | Optional | NO | Optional |
| CREATE_CARD | stageId (or fallback), title?, description?, priority?, assigneeId? | NO | YES | YES - created or fallback |
| DELETE_CARD | cardId | NO | NO | NO |

---

## JSON Payload Parsing Resilience

| Scenario | Input Payload | Resolution Strategy | Result |
|----------|---------------|-------------------|----|
| Field in "stageId" | `{"stageId":"UUID"}` | Direct lookup | Use stageId |
| Field in "columnId" only | `{"columnId":"UUID"}` | Fallback to columnId | Use columnId |
| Field in both | `{"stageId":"UUID1","columnId":"UUID2"}` | Prefer stageId | Use stageId |
| Field missing entirely | `{"other":"field"}` | Fallback to first stage or fail | Depends on operation |
| Field is null | `{"stageId":null}` | hasNonNull() returns false | Treated as missing |
| Field is invalid UUID | `{"stageId":"invalid"}` | UUID.fromString() throws | Use fallback UUID |

---

## Audit Trail Logging Format

| Action | Details JSON Format | Notes |
|--------|------------------|-------|
| APPLICATION_STARTED | `{"status":"APPLYING"}` | State before mutation begins |
| APPLICATION_SUCCEEDED | `{"status":"APPLIED"}` | State after successful mutation |
| ROLLED_BACK | `{"reason":"error message"}` | Exception message sanitized |

---

## Database Isolation Notes

All tests must use mocked repositories to ensure:
- No actual card/stage/board mutations
- Controlled exception scenarios
- Verification of all database calls via `.verify()`
- No network communication with frontend
- Deterministic test outcomes

Use Mockito for mocking:
- `.when().thenReturn()` for successful operations
- `.when().thenThrow()` for failure scenarios
- `.verify(times(n))` for call count verification
- `.inOrder()` for call sequence verification

---

## Error Handling & Recovery Paths

| Exception Type | Trigger | Handled By | Recovery | Broadcast |
|---|---|---|---|---|
| ResponseStatusException(NOT_FOUND) | Missing entity | Thrown directly | No recovery | No broadcast |
| ResponseStatusException(FORBIDDEN) | Non-owner user | ensureProjectOwner() | No recovery | No broadcast |
| ResponseStatusException(BAD_REQUEST) | Invalid status | Status check | No recovery | No broadcast |
| IllegalArgumentException | Missing payload fields | Thrown from apply methods | Caught, status→ROLLED_BACK | broadcastChangeStatusChanged |
| Exception (generic) | Unexpected error during apply | Try-catch in applyChange() | Rollback snapshot, status→ROLLED_BACK | broadcastChangeStatusChanged |

---

## Summary Coverage

**Estimated Path Coverage: 81-85%**
- Happy paths: All change types (MOVE, UPDATE, CREATE, DELETE)
- Permission checks: Project owner validation with fallback
- State transitions: PENDING→APPLYING→APPLIED, APPLYING→ROLLED_BACK on error
- Payload resilience: Field fallbacks (stageId↔columnId), UUID parsing with fallbacks
- Error handling: Not found, access denied, invalid payloads
- Audit logging: All state changes captured with timestamps
- Event broadcasting: Status changes and completion events

**Not Covered (15-19%)**
- Complex JsonNode tree navigation in production JSON structures
- Edge cases in ObjectMapper exception handling
- Stage/card lookup performance with large boards
- Snapshot rollback mechanics (only created, not actually used)
- Complex multi-field updates with partial failures

---

## Transactional Behavior Notes

- All operations in `@Transactional` method - tests verify rollback on exception
- Snapshot created within transaction before mutation
- Audit entry logged after status update
- Broadcast events should occur after transaction commit
- No distributed transactions across multiple services

