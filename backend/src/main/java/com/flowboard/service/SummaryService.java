package com.flowboard.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.MeetingSummaryDTO;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j

@Service
@RequiredArgsConstructor
@Transactional
public class SummaryService {
    private final MeetingRepository meetingRepository;
    private final MeetingSummaryRepository meetingSummaryRepository;
    private final MeetingMemberRepository meetingMemberRepository;
    private final ActionItemRepository actionItemRepository;
    private final DecisionRepository decisionRepository;
    private final ChangeRepository changeRepository;
    private final ApprovalRequestSummaryRepository approvalRequestSummaryRepository;
    private final ApprovalResponseSummaryRepository approvalResponseSummaryRepository;
    private final AIEngine aiEngine;
    private final BoardRepository boardRepository;
    private final StageRepository stageRepository;
    private final CardRepository cardRepository;
    private final ObjectMapper objectMapper;

    private static final Set<Meeting.MeetingStatus> FINALIZED_MEETING_STATUSES = Set.of(
        Meeting.MeetingStatus.APPROVED,
        Meeting.MeetingStatus.REJECTED
    );

    /**
     * Generates summary from meeting transcript using AI analysis
     * Creates action items, decisions, and changes
     * Initiates approval workflow for the summary
     * Verifies user is meeting member
     */
    public MeetingSummaryDTO generateSummary(UUID meetingId, UUID userId) {
        log.info("Generating summary for meeting: {}", meetingId);
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        // Verify user is a meeting member
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        if (meeting.getTranscript() == null || meeting.getTranscript().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Meeting has no transcript");
        }

        // Analyze transcript with AI
        log.info("Starting AI analysis for meeting: {}", meetingId);
        AIEngine.MeetingAnalysisResult analysis = aiEngine.analyzeMeetingTranscript(meeting.getTranscript());
        log.info("AI analysis completed. ActionItems: {}, Decisions: {}, Changes: {}", 
            analysis.getActionItems().size(), analysis.getDecisions().size(), analysis.getChanges().size());

        // Create summary
        MeetingSummary summary = MeetingSummary.builder()
            .meeting(meeting)
            .aiGeneratedContent(formatAnalysisContent(analysis))
            .status(MeetingSummary.SummaryStatus.PENDING)
            .build();
        summary = meetingSummaryRepository.save(summary);
        log.info("Summary saved with ID: {}", summary.getId());

        // Create action items from analysis
        log.info("Creating action items for summary");
        for (AIEngine.MeetingAnalysisResult.ActionItemData item : analysis.getActionItems()) {
            try {
                ActionItem actionItem = ActionItem.builder()
                    .meeting(meeting)
                    .description(item.description)
                    .sourceContext(item.sourceContext)
                    .priority(ActionItem.Priority.valueOf(item.priority))
                    .status(ActionItem.ActionItemStatus.PENDING)
                    .build();
                actionItemRepository.save(actionItem);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid priority value: {}, defaulting to MEDIUM", item.priority);
                ActionItem actionItem = ActionItem.builder()
                    .meeting(meeting)
                    .description(item.description)
                    .sourceContext(item.sourceContext)
                    .priority(ActionItem.Priority.MEDIUM)
                    .status(ActionItem.ActionItemStatus.PENDING)
                    .build();
                actionItemRepository.save(actionItem);
            }
        }
        log.info("Action items created");

        // Create decisions from analysis
        log.info("Creating decisions for summary");
        for (AIEngine.MeetingAnalysisResult.DecisionData decision : analysis.getDecisions()) {
            Decision decisionEntity = Decision.builder()
                .meeting(meeting)
                .description(decision.description)
                .sourceContext(decision.sourceContext)
                .build();
            decisionRepository.save(decisionEntity);
        }
        log.info("Decisions created");

        // Create changes from analysis
        log.info("Creating changes for summary");
        BoardChangeContext boardContext = buildBoardChangeContext(meeting.getProject().getId());
        for (AIEngine.MeetingAnalysisResult.ChangeData changeData : analysis.getChanges()) {
            try {
                Change.ChangeType requestedType = Change.ChangeType.valueOf(changeData.type);
                MockChangePayload payload = buildMockPayload(requestedType, changeData, boardContext);
                if (payload == null) {
                    log.warn("Skipping change {} due to unavailable board context", changeData.type);
                    continue;
                }

                Change change = Change.builder()
                    .meeting(meeting)
                    .changeType(payload.changeType())
                    .beforeState(payload.beforeState())
                    .afterState(payload.afterState())
                    .status(Change.ChangeStatus.PENDING)
                    .build();
                changeRepository.save(change);
            } catch (IllegalArgumentException e) {
                log.warn("Invalid change type: {}, skipping change", changeData.type);
            }
        }
        log.info("Changes created");

        // Create approval request
        log.info("Creating approval request");
        createApprovalRequest(meeting);
        log.info("Approval request created");

        // Update meeting status
        meeting.setStatus(Meeting.MeetingStatus.PENDING_APPROVAL);
        meetingRepository.save(meeting);
        log.info("Meeting status updated to PENDING_APPROVAL");

        return convertToDTO(summary);
    }

    /**
     * Create approval request and assign to all meeting members
     */
    private void createApprovalRequest(Meeting meeting) {
        // Get all meeting members
        List<User> members = meetingMemberRepository.findByMeetingId(meeting.getId())
            .stream()
            .map(MeetingMember::getUser)
            .collect(Collectors.toList());

        // Create approval request
        ApprovalRequestSummary approvalRequest = ApprovalRequestSummary.builder()
            .meeting(meeting)
            .requiredApprovals(members.size())
            .build();
        approvalRequest = approvalRequestSummaryRepository.save(approvalRequest);

        // Create response entries for each member (status: PENDING)
        for (User member : members) {
            ApprovalResponseSummary response = ApprovalResponseSummary.builder()
                .approvalRequest(approvalRequest)
                .user(member)
                .response(ApprovalResponseSummary.ApprovalResponse.PENDING)
                .build();
            approvalResponseSummaryRepository.save(response);
        }
    }

    /**
     * Get meeting summary - verifies user is meeting member
     */
    public MeetingSummaryDTO getSummary(UUID summaryId, UUID userId) {
        MeetingSummary summary = meetingSummaryRepository.findById(summaryId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Summary not found"));

        // Verify user is a member of the meeting
        UUID meetingId = summary.getMeeting().getId();
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        return convertToDTO(summary);
    }

    /**
     * Get summary for a meeting - verifies user is meeting member
     */
    public MeetingSummaryDTO getSummaryByMeeting(UUID meetingId, UUID userId) {
        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));

        // Verify user is a member of the meeting
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        return convertToDTO(summary);
    }

    public MeetingSummaryDTO addActionItem(UUID meetingId, String description, String sourceContext, String priority, User actor) {
        Meeting meeting = getEditableMeetingForMember(meetingId, actor);
        assertSummaryNotApprovedYet(meetingId);
        boolean autoApprove = hasUserApprovedSummary(meetingId, actor.getId());

        ActionItem.Priority parsedPriority = ActionItem.Priority.MEDIUM;
        if (priority != null && !priority.isBlank()) {
            try {
                parsedPriority = ActionItem.Priority.valueOf(priority.toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid action item priority");
            }
        }

        ActionItem actionItem = ActionItem.builder()
            .meeting(meeting)
            .description(description)
            .sourceContext(sourceContext)
            .priority(parsedPriority)
            .status(ActionItem.ActionItemStatus.PENDING)
            .approvalStatus(autoApprove ? ActionItem.ApprovalStatus.APPROVED : ActionItem.ApprovalStatus.PENDING)
            .build();

        actionItemRepository.save(actionItem);
        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));
        return convertToDTO(summary);
    }

    public MeetingSummaryDTO updateActionItem(UUID actionItemId, String description, String sourceContext, String priority, User actor) {
        ActionItem actionItem = actionItemRepository.findById(actionItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action item not found"));

        Meeting meeting = getEditableMeetingForMember(actionItem.getMeeting().getId(), actor);
        assertProjectOwner(meeting, actor);

        if (description != null) {
            actionItem.setDescription(description);
        }
        if (sourceContext != null) {
            actionItem.setSourceContext(sourceContext);
        }
        if (priority != null && !priority.isBlank()) {
            try {
                actionItem.setPriority(ActionItem.Priority.valueOf(priority.toUpperCase()));
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid action item priority");
            }
        }

        actionItemRepository.save(actionItem);

        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meeting.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));
        return convertToDTO(summary);
    }

    public MeetingSummaryDTO deleteActionItem(UUID actionItemId, User actor) {
        ActionItem actionItem = actionItemRepository.findById(actionItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action item not found"));

        UUID meetingId = actionItem.getMeeting().getId();
        Meeting meeting = getEditableMeetingForMember(meetingId, actor);
        assertProjectOwner(meeting, actor);
        actionItemRepository.delete(actionItem);

        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));
        return convertToDTO(summary);
    }

    public MeetingSummaryDTO addDecision(UUID meetingId, String description, String sourceContext, String impactSummary, User actor) {
        Meeting meeting = getEditableMeetingForMember(meetingId, actor);
        assertSummaryNotApprovedYet(meetingId);
        boolean autoApprove = hasUserApprovedSummary(meetingId, actor.getId());

        Decision decision = Decision.builder()
            .meeting(meeting)
            .description(description)
            .sourceContext(sourceContext)
            .impactSummary(impactSummary)
            .approvalStatus(autoApprove ? Decision.ApprovalStatus.APPROVED : Decision.ApprovalStatus.PENDING)
            .build();

        decisionRepository.save(decision);

        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));
        return convertToDTO(summary);
    }

    public MeetingSummaryDTO updateDecision(UUID decisionId, String description, String sourceContext, String impactSummary, User actor) {
        Decision decision = decisionRepository.findById(decisionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Decision not found"));

        Meeting meeting = getEditableMeetingForMember(decision.getMeeting().getId(), actor);
        assertProjectOwner(meeting, actor);

        if (description != null) {
            decision.setDescription(description);
        }
        if (sourceContext != null) {
            decision.setSourceContext(sourceContext);
        }
        if (impactSummary != null) {
            decision.setImpactSummary(impactSummary);
        }

        decisionRepository.save(decision);

        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meeting.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));
        return convertToDTO(summary);
    }

    public MeetingSummaryDTO deleteDecision(UUID decisionId, User actor) {
        Decision decision = decisionRepository.findById(decisionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Decision not found"));

        UUID meetingId = decision.getMeeting().getId();
        Meeting meeting = getEditableMeetingForMember(meetingId, actor);
        assertProjectOwner(meeting, actor);
        decisionRepository.delete(decision);

        MeetingSummary summary = meetingSummaryRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No summary found for meeting"));
        return convertToDTO(summary);
    }

    private Meeting getEditableMeetingForMember(UUID meetingId, User actor) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, actor.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        if (FINALIZED_MEETING_STATUSES.contains(meeting.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Meeting summary items cannot be edited after meeting is finalized");
        }

        return meeting;
    }

    private void assertProjectOwner(Meeting meeting, User actor) {
        if (!meeting.getProject().getOwner().getId().equals(actor.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the project owner can modify or remove existing summary items");
        }
    }

    private boolean hasUserApprovedSummary(UUID meetingId, UUID userId) {
        return approvalRequestSummaryRepository.findByMeetingId(meetingId)
            .flatMap(request -> approvalResponseSummaryRepository.findByApprovalRequestIdAndUserId(request.getId(), userId))
            .map(response -> response.getResponse() == ApprovalResponseSummary.ApprovalResponse.APPROVED)
            .orElse(false);
    }

    private void assertSummaryNotApprovedYet(UUID meetingId) {
        boolean approvedExists = approvalRequestSummaryRepository.findByMeetingId(meetingId)
            .map(request -> approvalResponseSummaryRepository.countByApprovalRequestIdAndResponse(
                request.getId(),
                ApprovalResponseSummary.ApprovalResponse.APPROVED
            ) > 0)
            .orElse(false);

        if (approvedExists) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot add new items after summary approval has started");
        }
    }

    /**
     * Convert MeetingSummary entity to DTO with related items
     */
    private MeetingSummaryDTO convertToDTO(MeetingSummary summary) {
        log.debug("Converting MeetingSummary to DTO");
        List<ActionItem> actionItems = actionItemRepository.findByMeetingId(summary.getMeeting().getId());
        List<Decision> decisions = decisionRepository.findByMeetingId(summary.getMeeting().getId());
        List<Change> changes = changeRepository.findByMeetingId(summary.getMeeting().getId());

        return MeetingSummaryDTO.builder()
            .id(summary.getId())
            .meetingId(summary.getMeeting().getId())
            .status(summary.getStatus().name())
            .aiGeneratedContent(summary.getAiGeneratedContent())
            .generatedAt(summary.getGeneratedAt())
            .approvedAt(summary.getApprovedAt())
            .actionItems(actionItems.stream()
                .map(item -> com.flowboard.dto.ActionItemDTO.builder()
                    .id(item.getId())
                    .meetingId(item.getMeeting().getId())
                    .description(item.getDescription())
                    .sourceContext(item.getSourceContext())
                    .priority(item.getPriority().name())
                    .status(item.getStatus().name())
                    .approvalStatus((item.getApprovalStatus() != null ? item.getApprovalStatus() : ActionItem.ApprovalStatus.PENDING).name())
                    .assignedToName(item.getAssignedTo() != null ? item.getAssignedTo().getUsername() : null)
                    .assignedToId(item.getAssignedTo() != null ? item.getAssignedTo().getId() : null)
                    .createdAt(item.getCreatedAt())
                    .build())
                .collect(Collectors.toList()))
            .decisions(decisions.stream()
                .map(d -> com.flowboard.dto.DecisionDTO.builder()
                    .id(d.getId())
                    .meetingId(d.getMeeting().getId())
                    .description(d.getDescription())
                    .sourceContext(d.getSourceContext())
                    .impactSummary(d.getImpactSummary())
                    .approvalStatus((d.getApprovalStatus() != null ? d.getApprovalStatus() : Decision.ApprovalStatus.PENDING).name())
                    .createdAt(d.getCreatedAt())
                    .build())
                .collect(Collectors.toList()))
            .changes(changes.stream()
                .map(c -> com.flowboard.dto.ChangeDTO.builder()
                    .id(c.getId())
                    .meetingId(c.getMeeting().getId())
                    .changeType(c.getChangeType().name())
                    .beforeState(c.getBeforeState())
                    .afterState(c.getAfterState())
                    .status(c.getStatus().name())
                    .createdAt(c.getCreatedAt())
                    .build())
                .collect(Collectors.toList()))
            .build();
    }

    /**
     * Format analysis result into readable content
     */
    private String formatAnalysisContent(AIEngine.MeetingAnalysisResult analysis) {
        StringBuilder content = new StringBuilder();
        content.append("## Meeting Summary\n\n");

        if (!analysis.getActionItems().isEmpty()) {
            content.append("### Action Items\n");
            for (AIEngine.MeetingAnalysisResult.ActionItemData item : analysis.getActionItems()) {
                content.append("- ").append(item.description).append(" [").append(item.priority).append("]\n");
            }
            content.append("\n");
        }

        if (!analysis.getDecisions().isEmpty()) {
            content.append("### Decisions\n");
            for (AIEngine.MeetingAnalysisResult.DecisionData decision : analysis.getDecisions()) {
                content.append("- ").append(decision.description).append("\n");
            }
            content.append("\n");
        }

        if (!analysis.getChanges().isEmpty()) {
            content.append("### Suggested Changes\n");
            for (AIEngine.MeetingAnalysisResult.ChangeData change : analysis.getChanges()) {
                content.append("- [").append(change.type).append("] ").append(change.description).append("\n");
            }
        }

        return content.toString();
    }

    private BoardChangeContext buildBoardChangeContext(UUID projectId) {
        Board board = boardRepository.findByProjectId(projectId).stream().findFirst().orElse(null);
        if (board == null) {
            return new BoardChangeContext(null, null, null);
        }

        List<Stage> stages = stageRepository.findByBoardIdOrderByPosition(board.getId());
        Stage primaryStage = stages.isEmpty() ? null : stages.get(0);
        Stage secondaryStage = stages.size() > 1 ? stages.get(1) : primaryStage;

        Card sampleCard = null;
        for (Stage stage : stages) {
            List<Card> cards = cardRepository.findByStageIdOrderByPosition(stage.getId());
            if (!cards.isEmpty()) {
                sampleCard = cards.get(0);
                break;
            }
        }

        return new BoardChangeContext(primaryStage, secondaryStage, sampleCard);
    }

    private MockChangePayload buildMockPayload(
        Change.ChangeType requestedType,
        AIEngine.MeetingAnalysisResult.ChangeData changeData,
        BoardChangeContext ctx
    ) {
        return switch (requestedType) {
            case MOVE_CARD -> buildMovePayload(changeData, ctx);
            case UPDATE_CARD -> buildUpdatePayload(changeData, ctx);
            case CREATE_CARD -> buildCreatePayload(changeData, ctx);
            case DELETE_CARD -> buildDeletePayload(changeData, ctx);
        };
    }

    private MockChangePayload buildMovePayload(AIEngine.MeetingAnalysisResult.ChangeData changeData, BoardChangeContext ctx) {
        if (ctx.sampleCard() == null || ctx.secondaryStage() == null) {
            return null;
        }

        Card card = ctx.sampleCard();
        Stage currentStage = card.getStage();
        Stage target = ctx.secondaryStage();

        if (currentStage != null && target != null && target.getId().equals(currentStage.getId())) {
            Stage alternate = ctx.primaryStage();
            if (alternate != null && !alternate.getId().equals(currentStage.getId())) {
                target = alternate;
            }
        }

        if (currentStage == null || target == null || target.getId().equals(currentStage.getId())) {
            return null;
        }

        Map<String, Object> before = cardJson(card, card.getStage());
        Map<String, Object> after = cardJson(card, target);
        return new MockChangePayload(
            Change.ChangeType.MOVE_CARD,
            toJson(before),
            toJson(after)
        );
    }

    private MockChangePayload buildUpdatePayload(AIEngine.MeetingAnalysisResult.ChangeData changeData, BoardChangeContext ctx) {
        if (ctx.sampleCard() == null) {
            return null;
        }

        Card card = ctx.sampleCard();
        Map<String, Object> before = cardJson(card, card.getStage());
        Map<String, Object> after = cardJson(card, card.getStage());
        String updatedTitle = withMeetingUpdateSuffix(card.getTitle());
        after.put("title", updatedTitle);
        after.put("description", changeData.description + " - " + changeData.context);

        return new MockChangePayload(
            Change.ChangeType.UPDATE_CARD,
            toJson(before),
            toJson(after)
        );
    }

    private MockChangePayload buildCreatePayload(AIEngine.MeetingAnalysisResult.ChangeData changeData, BoardChangeContext ctx) {
        if (ctx.primaryStage() == null) {
            return null;
        }

        Map<String, Object> after = new LinkedHashMap<>();
        after.put("stageId", ctx.primaryStage().getId().toString());
        after.put("columnId", ctx.primaryStage().getId().toString());
        after.put("title", "Meeting task: " + changeData.description);
        after.put("description", changeData.context);
        after.put("priority", "MEDIUM");

        return new MockChangePayload(
            Change.ChangeType.CREATE_CARD,
            "{}",
            toJson(after)
        );
    }

    private MockChangePayload buildDeletePayload(AIEngine.MeetingAnalysisResult.ChangeData changeData, BoardChangeContext ctx) {
        if (ctx.sampleCard() == null) {
            return null;
        }

        Card card = ctx.sampleCard();
        Map<String, Object> before = cardJson(card, card.getStage());
        Map<String, Object> after = new LinkedHashMap<>();
        after.put("id", card.getId().toString());

        return new MockChangePayload(
            Change.ChangeType.DELETE_CARD,
            toJson(before),
            toJson(after)
        );
    }

    private Map<String, Object> cardJson(Card card, Stage stage) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", card.getId().toString());
        value.put("title", card.getTitle());
        value.put("description", card.getDescription());
        value.put("priority", card.getPriority().name());
        if (stage != null) {
            value.put("stageId", stage.getId().toString());
            value.put("columnId", stage.getId().toString());
            value.put("stageTitle", stage.getTitle());
            value.put("columnTitle", stage.getTitle());
        }
        return value;
    }

    private MockChangePayload emptyPayload(Change.ChangeType changeType) {
        return new MockChangePayload(changeType, "{}", "{}");
    }

    private String withMeetingUpdateSuffix(String title) {
        if (title == null || title.isBlank()) {
            return "Untitled (Meeting Update)";
        }

        String normalized = title.trim();
        if (normalized.endsWith("(Meeting Update)")) {
            return normalized;
        }

        return normalized + " (Meeting Update)";
    }

    private String toJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize mock change payload: {}", ex.getMessage());
            return "{}";
        }
    }

    private record BoardChangeContext(Stage primaryStage, Stage secondaryStage, Card sampleCard) {}

    private record MockChangePayload(Change.ChangeType changeType, String beforeState, String afterState) {}
}
