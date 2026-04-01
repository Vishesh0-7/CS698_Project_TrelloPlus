# SummaryService Test Specification

**Purpose**: Comprehensive unit test specification for SummaryService.java achieving 80%+ code coverage  
**Focus**: Meeting summary generation workflow, AI integration, approval process, action items/decisions/changes management, path coverage, and exception handling  
**Isolation Strategy**: All repositories, AIEngine, and BoardBroadcastService will be mocked to enable frontend isolation and deterministic testing

---

## Functions to Test

1. `generateSummary(UUID meetingId, UUID userId)` - Main entry point for AI-driven summary generation
2. `getSummary(UUID summaryId, UUID userId)` - Retrieves existing summary by ID
3. `getSummaryByMeeting(UUID meetingId, UUID userId)` - Fetches summary for specific meeting
4. `addActionItem(UUID meetingId, String description, String sourceContext, String priority, User actor)` - Adds action item to meeting
5. `updateActionItem(UUID actionItemId, String description, String sourceContext, String priority, User actor)` - Updates action item details
6. `deleteActionItem(UUID actionItemId, User actor)` - Removes action item
7. `addDecision(UUID meetingId, String description, String sourceContext, String impactSummary, User actor)` - Adds decision to meeting
8. `updateDecision(UUID decisionId, String description, String sourceContext, String impactSummary, User actor)` - Updates decision
9. `deleteDecision(UUID decisionId, User actor)` - Removes decision
10. `createApprovalRequest(Meeting meeting)` - Creates approval workflow for summary
11. `convertToDTO(MeetingSummary summary)` - Converts entity to DTO with related items
12. Helper methods: `formatAnalysisContent()`, `buildBoardChangeContext()`, `buildMockPayload()`, `cardJson()`, `toJson()`, etc.

---

## Mocking Strategy

### Mocked Dependencies
- **MeetingRepository**: Mock `findById()`, `save()` to control meeting state
- **MeetingSummaryRepository**: Mock `save()`, `findById()`, `findByMeetingId()` for summary persistence
- **MeetingMemberRepository**: Mock `findByMeetingId()`, `existsByMeetingIdAndUserId()` for member verification
- **ActionItemRepository**: Mock CRUD operations, `findByMeetingId()` for item retrieval
- **DecisionRepository**: Mock CRUD operations, `findByMeetingId()` for decision retrieval
- **ChangeRepository**: Mock `save()`, `findByMeetingId()` for change persistence
- **ApprovalRequestSummaryRepository**: Mock `save()`, `findByMeetingId()` for approval workflow
- **ApprovalResponseSummaryRepository**: Mock response creation and counting
- **AIEngine**: Mock `analyzeMeetingTranscript()` to return controlled analysis results with actionItems, decisions, changes
- **BoardRepository**: Mock `findByProjectId()` for board context
- **StageRepository**: Mock `findByBoardIdOrderByPosition()` for stage resolution
- **CardRepository**: Mock `findByStageIdOrderByPosition()` for card resolution
- **BoardBroadcastService**: Mock all broadcast methods (no-op)

### Mock Object Setup
- `createMockMeeting(UUID id, Project project, String transcript, MeetingStatus status)` - Meeting factory
- `createMockMeetingMember(Meeting meeting, User user)` - Meeting participant factory
- `createMockAIAnalysisResult(List<ActionItem>, List<Decision>, List<Change>)` - AI result factory
- `createMockActionItem(UUID id, Meeting meeting, String description, ActionItem.Priority priority, ActionItem.ApprovalStatus status)` - Action item factory
- `createMockDecision(UUID id, Meeting meeting, String description, Decision.ApprovalStatus status)` - Decision factory
- `createMockChange(UUID id, Meeting meeting, Change.ChangeType type, Change.ChangeStatus status)` - Change factory

---

## Test Specifications

| Test ID | Test Purpose | Test Inputs | Expected Output | Edge Cases / Mocks | Coverage Path |
|---------|--------------|-------------|-----------------|-------------------|----------------|
| **T1.1** | Generate summary: happy path with transcript | meetingId=UUID1, userId=UUID1 (meeting member), meeting.transcript="Full meeting transcript..." | MeetingSummaryDTO with status=PENDING, actionItems, decisions, changes created | Mock AIEngine.analyzeMeetingTranscript() returns valid analysis with 3 items, 2 decisions, 2 changes | Happy path |
| **T1.2** | Generate summary: meeting not found | meetingId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Meeting not found") | Mock meetingRepository.findById() returns empty | Not found handling |
| **T1.3** | Generate summary: no transcript | meetingId=UUID1, meeting.transcript=null | Throw ResponseStatusException(BAD_REQUEST, "Meeting has no transcript") | Validate transcript presence before AI call | Validation |
| **T1.4** | Generate summary: empty transcript | meetingId=UUID1, meeting.transcript="" | Throw ResponseStatusException(BAD_REQUEST, "Meeting has no transcript") | Empty string treated as no transcript | Validation |
| **T1.5** | Generate summary: AI analysis creates action items | AI analysis returns 3 ActionItem objects with different priorities | ActionItemRepository.save() called 3 times, items saved with priority (HIGH, MEDIUM, LOW) | Mock analysis with multiple items, verify repository save calls | Action item creation |
| **T1.6** | Generate summary: AI returns invalid priority | ActionItemData.priority="INVALID" | Catch IllegalArgumentException, default to Action Item.Priority.MEDIUM, log warning | Try-catch around Priority.valueOf(), fallback to MEDIUM | Error recovery |
| **T1.7** | Generate summary: AI analysis creates decisions | AI analysis returns 2 Decision objects | 2 decisions saved to decisionRepository | Mock analysis with decisions | Decision creation |
| **T1.8** | Generate summary: AI analysis creates changes | AI analysis returns 2 Changes (MOVE_CARD, UPDATE_CARD) | 2 changes saved to changeRepository with appropriate payloads | Verify buildMockPayload() called for each change type | Change creation |
| **T1.9** | Generate summary: change creation skipped if payload null | BuildMockPayload returns null (missing board context) | Change skipped, warning logged, process continues | Mock buildMockPayload() to return null, verify no save | Error recovery |
| **T1.10** | Generate summary: invalid change type caught | AIEngine returns change with changeType="INVALID_TYPE" | Catch IllegalArgumentException, log warning, skip change, continue | Enum.valueOf() fails, caught and handled | Error recovery |
| **T1.11** | Generate summary: approval request created | After generating summary | createApprovalRequest() called with meeting | Verify all meeting members get approval response entries | Approval workflow initialization |
| **T1.12** | Generate summary: meeting status updated to PENDING_APPROVAL | After summary generation | meeting.setStatus(PENDING_APPROVAL), meetingRepository.save() called | meetingRepository.save() invoked with updated status | State transition |
| **T1.13** | Generate summary: broadcast summary generation event | After successful generation | broadcastService.broadcastSummaryGenerated(projectId, meetingId, MeetingSummaryDTO) called | Mock broadcastService | Event broadcasting |
| **T1.14** | Generate summary: format AI content into markdown | MeetingAnalysisResult with items/decisions/changes | aiGeneratedContent formatted with "## Meeting Summary", "### Action Items", "### Decisions", "### Suggested Changes" sections | Verify content structure in formatAnalysisContent() | Content formatting |
| **T1.15** | Generate summary: logging at key checkpoints | generateSummary execution | Log messages for: AI analysis start, completion with counts, summary save, item creation, approval request, status update | Verify %d log statements throughout | Observability |
| **T2.1** | Get summary by ID | summaryId=UUID1 | MeetingSummaryDTO with all related actionItems, decisions, changes | Mock meetingSummaryRepository.findById() | Happy path |
| **T2.2** | Get summary: not found | summaryId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Summary not found") | Mock findById() returns empty | Not found |
| **T3.1** | Get summary by meeting ID | meetingId=UUID1 | MeetingSummaryDTO for that meeting | Mock findByMeetingId() returns summary | Happy path |
| **T3.2** | Get summary by meeting: not found | meetingId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "No summary found for meeting") | Mock findByMeetingId() returns empty | Not found |
| **T4.1** | Add action item: user is meeting member | meetingId=UUID1, description="Fix bug", priority="HIGH", actor=member | ActionItemDTO created with PENDING status | Mock meeting member verification passes | Happy path |
| **T4.2** | Add action item: user not meeting member | meetingId=UUID1, actor=non-member | Throw ResponseStatusException(FORBIDDEN, "User is not a member of this meeting") | meetingMemberRepository.existsByMeetingIdAndUserId() returns false | Access control |
| **T4.3** | Add action item: meeting not found | meetingId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Meeting not found") | getEditableMeetingForMember() throws NOT_FOUND | Not found |
| **T4.4** | Add action item: meeting finalized (APPROVED) | meetingId=UUID1, meeting.status=APPROVED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Check FINALIZED_MEETING_STATUSES | Finalized check |
| **T4.5** | Add action item: meeting finalized (REJECTED) | meetingId=UUID1, meeting.status=REJECTED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Check FINALIZED_MEETING_STATUSES | Finalized check |
| **T4.6** | Add action item: invalid priority | priority="URGENT" | Throw ResponseStatusException(BAD_REQUEST, "Invalid action item priority") | Priority.valueOf() fails | Validation |
| **T4.7** | Add action item: null priority (default) | priority=null | ActionItemDTO with priority=MEDIUM | Default MEDIUM applied | Default handling |
| **T4.8** | Add action item: blank priority (default) | priority="  " | ActionItemDTO with priority=MEDIUM | Blank treated as null, default applied | Default handling |
| **T4.9** | Add action item: user has approved summary | User has approved summary, then adds new item | approvalStatus=APPROVED for new item | hasUserApprovedSummary() returns true | Auto-approval logic |
| **T4.10** | Add action item: user has not approved summary | User has not approved, summary approval not started | approvalStatus=PENDING for new item | hasUserApprovedSummary() returns false | Pending approval |
| **T4.11** | Add action item: broadcast creation event | After successful add | broadcastService.broadcastActionItemCreated(projectId, meetingId, event) called | Mock broadcastService | Event broadcasting |
| **T4.12** | Add action item: summary fetched and returned | After item added | getSummaryByMeeting() called to return updated MeetingSummaryDTO | MeetingSummaryDTO includes new action item | Result aggregation |
| **T5.1** | Update action item: all fields updated | actionItemId=UUID1, new description/sourceContext/priority | ActionItemDTO with updated fields | Mock item exists, user is project owner | Happy path |
| **T5.2** | Update action item: only description updated | description="New description", sourceContext=null, priority=null | actionItem.setDescription() called, others skipped | Conditional field updates | Partial update |
| **T5.3** | Update action item: item not found | actionItemId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Action item not found") | Mock returns empty | Not found |
| **T5.4** | Update action item: user not project owner | actor not owner of meeting project | Throw ResponseStatusException(FORBIDDEN, "Only the project owner can modify or remove existing summary items") | assertProjectOwner() enforced | Access control |
| **T5.5** | Update action item: meeting not found | Action item's meeting not found | Throw ResponseStatusException(NOT_FOUND, "Meeting not found") | getEditableMeetingForMember() throws | Not found |
| **T5.6** | Update action item: meeting finalized | meeting.status=APPROVED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Finalized check in getEditableMeetingForMember() | Finalized check |
| **T5.7** | Update action item: user not meeting member | actor not meeting member | Throw ResponseStatusException(FORBIDDEN, "User is not a member of this meeting") | meetingMemberRepository check | Access control |
| **T5.8** | Update action item: invalid priority | priority="URGENT" | Throw ResponseStatusException(BAD_REQUEST, "Invalid action item priority") | Priority validation | Validation |
| **T5.9** | Update action item: broadcast update event | After successful update | broadcastService.broadcastActionItemUpdated(projectId, meetingId, event) called | Mock broadcastService | Event broadcasting |
| **T6.1** | Delete action item | actionItemId=UUID1, actor=project owner | ActionItem deleted via actionItemRepository.delete() | Mock item exists | Happy path |
| **T6.2** | Delete action item: item not found | actionItemId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Action item not found") | Mock returns empty | Not found |
| **T6.3** | Delete action item: user not project owner | actor not meeting project owner | Throw ResponseStatusException(FORBIDDEN, "Only the project owner can modify or remove existing summary items") | assertProjectOwner() enforced | Access control |
| **T6.4** | Delete action item: user not meeting member | actor not meeting member | Throw ResponseStatusException(FORBIDDEN, "User is not a member of this meeting") | meetingMemberRepository check | Access control |
| **T6.5** | Delete action item: meeting finalized | meeting.status=APPROVED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Finalized check | Finalized check |
| **T6.6** | Delete action item: broadcast deletion event | After successful delete | broadcastService.broadcastActionItemDeleted(projectId, meetingId, itemId) called | Mock broadcastService | Event broadcasting |
| **T7.1** | Add decision: user is meeting member | meetingId=UUID1, description="Use new framework", sourceContext="...", impactSummary="Improves performance" | DecisionDTO created with PENDING approvalStatus | Mock meeting member verification | Happy path |
| **T7.2** | Add decision: user not meeting member | meetingId=UUID1, actor=non-member | Throw ResponseStatusException(FORBIDDEN, "User is not a member of this meeting") | existsByMeetingIdAndUserId() returns false | Access control |
| **T7.3** | Add decision: meeting not found | meetingId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Meeting not found") | getEditableMeetingForMember() throws | Not found |
| **T7.4** | Add decision: meeting finalized | meeting.status=REJECTED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Finalized check | Finalized check |
| **T7.5** | Add decision: user has approved summary | Summary approval active, user approved | approvalStatus=APPROVED for new decision | hasUserApprovedSummary() returns true | Auto-approval logic |
| **T7.6** | Add decision: user has not approved | Summary pending or user not approved | approvalStatus=PENDING for new decision | hasUserApprovedSummary() returns false | Pending approval |
| **T7.7** | Add decision: broadcast creation event | After successful add | broadcastService.broadcastDecisionCreated(projectId, meetingId, event) called | Mock broadcastService | Event broadcasting |
| **T8.1** | Update decision: all fields updated | decisionId=UUID1, new description/sourceContext/impactSummary | DecisionDTO with updated fields | Mock decision exists, user is project owner | Happy path |
| **T8.2** | Update decision: only sourceContext updated | description=null, sourceContext="New context", impactSummary=null | Only sourceContext field changed | Conditional updates | Partial update |
| **T8.3** | Update decision: decision not found | decisionId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Decision not found") | Mock returns empty | Not found |
| **T8.4** | Update decision: user not project owner | actor not project owner | Throw ResponseStatusException(FORBIDDEN, "Only the project owner can modify or remove existing summary items") | assertProjectOwner() enforced | Access control |
| **T8.5** | Update decision: meeting finalized | meeting.status=APPROVED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Finalized check | Finalized check |
| **T8.6** | Update decision: broadcast update event | After successful update | broadcastService.broadcastDecisionUpdated(projectId, meetingId, event) called | Mock broadcastService | Event broadcasting |
| **T9.1** | Delete decision | decisionId=UUID1, actor=project owner | Decision deleted via decisionRepository.delete() | Mock decision exists | Happy path |
| **T9.2** | Delete decision: not found | decisionId=UUID999 | Throw ResponseStatusException(NOT_FOUND, "Decision not found") | Mock returns empty | Not found |
| **T9.3** | Delete decision: user not project owner | actor not owner | Throw ResponseStatusException(FORBIDDEN, "Only the project owner can modify or remove existing summary items") | assertProjectOwner() enforced | Access control |
| **T9.4** | Delete decision: meeting finalized | meeting.status=REJECTED | Throw ResponseStatusException(CONFLICT, "Meeting summary items cannot be edited after meeting is finalized") | Finalized check | Finalized check |
| **T9.5** | Delete decision: broadcast deletion event | After successful delete | broadcastService.broadcastDecisionDeleted(projectId, meetingId, decisionId) called | Mock broadcastService | Event broadcasting |
| **T10.1** | Create approval request: assign to all members | Meeting has 3 members | ApprovalRequestSummary created with requiredApprovals=3, 3 ApprovalResponseSummary entries with PENDING status | Verify repository save calls | Happy path |
| **T10.2** | Create approval request: no members | meeting.members=empty | ApprovalRequestSummary created with requiredApprovals=0, no response entries | Handle edge case gracefully | Edge case |
| **T10.3** | Create approval request: response entries created for each member | 3 members in meeting | ApprovalResponseSummary.response=PENDING for each, approvalRequest linked | Verify response mapping | Response creation |
| **T11.1** | Convert to DTO: all related items included | MeetingSummary with 2 actionItems, 3 decisions, 1 change | MeetingSummaryDTO contains all items populated | Mock repository calls for findByMeetingId() | Data aggregation |
| **T11.2** | Convert to DTO: action items formatted correctly | ActionItem(id, description, sourceContext, priority=HIGH, status=PENDING, approvalStatus=APPROVED, assignedTo=user) | ActionItemDTO includes all fields, priority as string "HIGH" | Domain/DTO conversion | Mapping |
| **T11.3** | Convert to DTO: decision formatted correctly | Decision(id, description, sourceContext, impactSummary, approvalStatus=PENDING) | DecisionDTO with all fields, status as string | Domain/DTO conversion | Mapping |
| **T11.4** | Convert to DTO: change formatted correctly | Change(id, changeType=MOVE_CARD, beforeState=JSON, afterState=JSON, status=PENDING, createdAt=2025-03-31) | ChangeDTO with string type and timestamps | Domain/DTO conversion | Mapping |
| **T11.5** | Convert to DTO: null assignee handled | ActionItem.assignedTo=null | ActionItemDTO.assignedToName=null, assignedToId=null | Null safety | Null handling |
| **T11.6** | Convert to DTO: null approvalStatus defaulted | ActionItem.approvalStatus=null | ActionItemDTO.approvalStatus="PENDING" | Null coalescing | Null handling |
| **T11.7** | Convert to DTO: timestamps included | Summary.generatedAt=2025-03-30, approvedAt=2025-03-31 | MeetingSummaryDTO includes generatedAt, approvedAt timestamps | DateTime mapping | Lazy initialization |
| **T12.1** | Assert summary not approved: no approved responses | approvalRequestSummary exists, 0 responses are APPROVED | No exception thrown, process continues | countByApprovalRequestIdAndResponse returns 0 | Happy path |
| **T12.2** | Assert summary not approved: at least one approved | approvalRequestSummary with 1+ APPROVED responses | Throw ResponseStatusException(CONFLICT, "Cannot add new items after summary approval has started") | approvalExists=true condition | Approval conflict |
| **T12.3** | Assert summary not approved: no approval request | No ApprovalRequestSummary for meeting | No exception thrown (request doesn't exist yet) | approvalRequestSummaryRepository.findByMeetingId() returns empty | Edge case |
| **T13.1** | Has user approved summary: user approved | ApprovalResponseSummary.response=APPROVED for user | Returns true | Response lookup and comparison | Happy path |
| **T13.2** | Has user approved summary: user pending | ApprovalResponseSummary.response=PENDING for user | Returns false | Response lookup | Not approved |
| **T13.3** | Has user approved summary: no response entry | User not in approvalResponseSummary | Returns false | flatMap returns empty Optional | Not found |
| **T13.4** | Has user approved summary: no approval request | ApprovalRequestSummary doesn't exist | Returns false | findByMeetingId() returns empty | No request |
| **T14.1** | Build board change context: board exists with stages | Board with 3 stages in order | BoardChangeContext(primaryStage=stages.get(0), secondaryStage=stages.get(1), sampleCard=first card found) | Mock board and stage relationships | Happy path |
| **T14.2** | Build board change context: board with 1 stage | Board with single stage | BoardChangeContext(primaryStage=stage, secondaryStage=stage, sampleCard) | Handle single-stage edge case | Edge case |
| **T14.3** | Build board change context: board has no stages | BoardRepository returns board with 0 stages | BoardChangeContext(primaryStage=null, secondaryStage=null, sampleCard=null) | Handle empty board | Edge case |
| **T14.4** | Build board change context: no cards on board | Stages exist but empty | BoardChangeContext(primaryStage, secondaryStage, sampleCard=null) | Iterate all stages | Edge case |
| **T14.5** | Build board change context: no board for project | Board not found for project | BoardChangeContext(null, null, null) | findByProjectId() returns empty | Edge case |
| **T15.1** | Build move payload: sample card exists, stages differ | sampleCard and secondaryStage exist, stages different | MockChangePayload with MOVE_CARD type, before/after states differ | Payload construction | Happy path |
| **T15.2** | Build move payload: missing sample card | ctx.sampleCard()=null | Returns null, change skipped | Return null on missing context | Edge case |
| **T15.3** | Build move payload: same source/target stage | currentStage.id == secondaryStage.id | Use alternate stage (primaryStage) | Avoid same-stage moves | Edge case |
| **T15.4** | Build move payload: no alternate stage available | All available stages same as current | Returns null | Can't find different target | Edge case |
| **T16.1** | Build update payload: sample card exists | Card with title/description/priority | MockChangePayload.afterState with updated title suffix, description from changeData | Payload construction | Happy path |
| **T16.2** | Build update payload: missing sample card | ctx.sampleCard()=null | Returns null | Return null on missing context | Edge case |
| **T17.1** | Build create payload: primary stage exists | ctx.primaryStage() returns stage | MockChangePayload with stageId/columnId in after state | Payload construction | Happy path |
| **T17.2** | Build create payload: missing primary stage | ctx.primaryStage()=null | Returns null | Return null without stage | Edge case |
| **T18.1** | Build delete payload: sample card exists | Card with id/title/description | MockChangePayload.beforeState=full card data, afterState=minimal with id only | Payload construction | Happy path |
| **T18.2** | Build delete payload: missing sample card | ctx.sampleCard()=null | Returns null | Return null on missing context | Edge case |
| **T19.1** | Card JSON conversion: all fields populated | Card(id, title, description, priority=HIGH, stage=(id, title)) | Map with id, title, description, priority, stageId, columnId, stageTitle, columnTitle | JSON mapping | Happy path |
| **T19.2** | Card JSON: null stage | Card with stage=null | Map includes null stageId/columnId/stageTitle/columnTitle | Handle null stage | Edge case |
| **T19.3** | Card JSON: null description | Card.description=null | Map includes null description | Handle null fields | Null handling |

---

## Approval Workflow State Transitions

| From Status | Event | To Status | Broadcast | Notes |
|------------|-------|-----------|-----------|-------|
| PENDING_APPROVAL | All members approve | APPROVED | broadcastMeetingApproved | Meeting finalized |
| PENDING_APPROVAL | Any member rejects | REJECTED | broadcastMeetingRejected | Meeting finalized |
| PENDING_APPROVAL | Item added pre-approval | PENDING_APPROVAL (no change) | broadcastItemAdded | Cannot add after first approval |

---

## Meeting Status Validation

| Status | Can Add Items | Can Update Items | Can Delete Items | Can Approve |  
|--------|---------------|------------------|------------------|------------|
| PENDING_APPROVAL | YES (until first approval) | YES (project owner only) | YES (project owner only) | YES |
| APPROVED | NO | NO | NO | NO |
| REJECTED | NO | NO | NO | NO |

---

## AI Analysis Result Mock Format

```java
AIEngine.MeetingAnalysisResult analysis = new AIEngine.MeetingAnalysisResult(
    List.of(
        new ActionItemData("Fix critical bug", "from line 45", "HIGH"),
        new ActionItemData("Update documentation", "from line 120", "MEDIUM")
    ),
    List.of(
        new DecisionData("Use React 18", "discussed in Q&A section")
    ),
    List.of(
        new ChangeData("CREATE_CARD", "New feature discussion", "Create new card for feature X")
    )
);
```

---

## Database Isolation Notes

All tests must use mocked repositories to ensure:
- No actual database connections
- Controlled AI analysis results
- Verified broadcast method invocations
- Independent test execution with predictable outcomes

Use Mockito for repository and service mocking with:
- `.when().thenReturn()` for controlled responses
- `.verify()` for method invocation assertions
- `.thenThrow()` for error scenarios

---

## Summary Coverage

**Estimated Path Coverage: 83-87%**
- Happy paths: All main CRUD operations
- Error handling: All exception scenarios (not found, access denied, finalized meeting)
- Workflow: Approval request creation and tracking
- Validation: Priority, user membership, project ownership
- Data conversion: Entity-to-DTO mapping with null safety
- Event broadcasting: All summary-related events

**Not Covered (13-17%)**
- Complex JSON serialization edge cases in toJson()
- Meeting update suffix logic variations
- BoardChangeContext card iteration edge cases
- Priority enum fallback mechanisms in detail

---

## Transactional Behavior Notes

- All methods marked with `@Transactional` - tests should verify rollback on exceptions
- Nested transactions for approval request + response creation
- Cascade deletes for action items/decisions when summary deleted
- Repository save order: Summary → Items → Approval Request

