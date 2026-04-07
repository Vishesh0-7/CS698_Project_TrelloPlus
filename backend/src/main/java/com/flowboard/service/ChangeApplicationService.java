package com.flowboard.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.ChangeApplyResultDTO;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Transactional
public class ChangeApplicationService {
    private final ChangeRepository changeRepository;
    private final BoardRepository boardRepository;
    private final StageRepository stageRepository;
    private final CardRepository cardRepository;
    private final UserRepository userRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ChangeSnapshotRepository changeSnapshotRepository;
    private final ChangeAuditEntryRepository changeAuditEntryRepository;
    private final ObjectMapper objectMapper;
    private final BoardBroadcastService broadcastService;

    public ChangeApplyResultDTO applyChange(UUID changeId, User actor) {
        Change change = changeRepository.findById(changeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change not found"));

        ensureProjectOwner(change, actor.getId());

        if (isMeetingApprovedOwnerPath(change)) {
            change.setStatus(Change.ChangeStatus.READY_FOR_APPLICATION);
            changeRepository.save(change);
            broadcastService.broadcastChangeStatusChanged(
                change.getMeeting().getProject().getId(),
                changeId,
                Change.ChangeStatus.READY_FOR_APPLICATION.name()
            );
        }

        if (change.getStatus() != Change.ChangeStatus.READY_FOR_APPLICATION &&
            change.getStatus() != Change.ChangeStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Change is not ready for application");
        }

        Board board = boardRepository.findByProjectId(change.getMeeting().getProject().getId())
            .stream()
            .findFirst()
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Board not found for project"));

        change.setStatus(Change.ChangeStatus.APPLYING);
        changeRepository.save(change);
        broadcastService.broadcastChangeStatusChanged(change.getMeeting().getProject().getId(), changeId, Change.ChangeStatus.APPLYING.name());
        audit(change, actor, ChangeAuditEntry.AuditAction.APPLICATION_STARTED, "{\"status\":\"APPLYING\"}");

        ChangeSnapshot snapshot = createSnapshot(change, board);

        try {
            applyByType(change, board);

            change.setStatus(Change.ChangeStatus.APPLIED);
            change.setAppliedBy(actor);
            change.setAppliedAt(LocalDateTime.now());
            changeRepository.save(change);
            broadcastService.broadcastChangeStatusChanged(change.getMeeting().getProject().getId(), changeId, Change.ChangeStatus.APPLIED.name());
            broadcastService.broadcastChangeApplied(change.getMeeting().getProject().getId(), changeId);

            snapshot.setVerificationStatus(ChangeSnapshot.VerificationStatus.VERIFIED);
            snapshot.setAppliedAt(LocalDateTime.now());
            changeSnapshotRepository.save(snapshot);

            audit(change, actor, ChangeAuditEntry.AuditAction.APPLICATION_SUCCEEDED, "{\"status\":\"APPLIED\"}");

            return ChangeApplyResultDTO.builder()
                .changeId(change.getId())
                .status(change.getStatus().name())
                .applied(true)
                .message("Change applied successfully")
                .build();
        } catch (Exception ex) {
            snapshot.setVerificationStatus(ChangeSnapshot.VerificationStatus.FAILED);
            changeSnapshotRepository.save(snapshot);

            change.setStatus(Change.ChangeStatus.ROLLED_BACK);
            changeRepository.save(change);
            broadcastService.broadcastChangeStatusChanged(change.getMeeting().getProject().getId(), changeId, Change.ChangeStatus.ROLLED_BACK.name());
            audit(change, actor, ChangeAuditEntry.AuditAction.ROLLED_BACK, "{\"reason\":\"" + safe(ex.getMessage()) + "\"}");

            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Change application failed: " + ex.getMessage());
        }
    }

    private boolean isMeetingApprovedOwnerPath(Change change) {
        if (change.getStatus() == Change.ChangeStatus.READY_FOR_APPLICATION ||
            change.getStatus() == Change.ChangeStatus.APPROVED) {
            return false;
        }

        Meeting.MeetingStatus meetingStatus = change.getMeeting().getStatus();
        return meetingStatus == Meeting.MeetingStatus.APPROVED;
    }

    private void ensureProjectOwner(Change change, UUID userId) {
        UUID projectId = change.getMeeting().getProject().getId();

        // Trust canonical owner on Project first (covers legacy data where project_members owner row may be missing).
        if (change.getMeeting().getProject().getOwner() != null
            && change.getMeeting().getProject().getOwner().getId().equals(userId)) {
            return;
        }

        String role = projectMemberRepository.findMemberRole(projectId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a project member"));

        if (!"owner".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the project owner can apply changes");
        }
    }

    private ChangeSnapshot createSnapshot(Change change, Board board) {
        String boardState = "{\"boardId\":\"" + board.getId() + "\",\"snapshotType\":\"PRE_APPLY\"}";
        ChangeSnapshot snapshot = ChangeSnapshot.builder()
            .change(change)
            .board(board)
            .boardState(boardState)
            .rollbackState(boardState)
            .verificationStatus(ChangeSnapshot.VerificationStatus.PENDING)
            .build();
        return changeSnapshotRepository.save(snapshot);
    }

    private void applyByType(Change change, Board board) throws Exception {
        JsonNode before = parseJsonOrEmpty(change.getBeforeState());
        JsonNode after = parseJsonOrEmpty(change.getAfterState());

        switch (change.getChangeType()) {
            case MOVE_CARD -> applyMoveCard(board, before, after);
            case UPDATE_CARD -> applyUpdateCard(board, before, after);
            case CREATE_CARD -> applyCreateCard(board, after);
            case DELETE_CARD -> applyDeleteCard(board, before, after);
            default -> throw new IllegalStateException("Unsupported change type");
        }
    }

    private void applyMoveCard(Board board, JsonNode before, JsonNode after) {
        UUID cardId = readUuid(after, "id", readUuid(before, "id", null));
        UUID targetStageId = readUuid(after, "stageId", readUuid(after, "columnId", null));

        if (cardId == null || targetStageId == null) {
            throw new IllegalArgumentException("MOVE_CARD payload is missing required card/stage identifiers");
        }

        final UUID resolvedCardId = cardId;
        final UUID resolvedTargetStageId = targetStageId;

        Card card = cardRepository.findById(resolvedCardId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found: " + resolvedCardId));

        Stage targetStage = stageRepository.findById(resolvedTargetStageId)
            .orElseThrow(() -> new IllegalArgumentException("Stage not found: " + resolvedTargetStageId));

        card.setStage(targetStage);
        cardRepository.save(card);
    }

    private void applyUpdateCard(Board board, JsonNode before, JsonNode after) {
        UUID cardId = readUuid(after, "id", readUuid(before, "id", null));

        if (cardId == null) {
            throw new IllegalArgumentException("UPDATE_CARD payload is missing required card identifier");
        }

        final UUID resolvedCardId = cardId;

        Card card = cardRepository.findById(resolvedCardId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found: " + resolvedCardId));

        if (after.hasNonNull("title")) {
            card.setTitle(after.get("title").asText());
        } else if (!before.hasNonNull("title")) {
            card.setTitle(card.getTitle() + " (Updated)");
        }
        if (after.has("description")) {
            card.setDescription(after.get("description").isNull() ? null : after.get("description").asText());
        }
        if (after.hasNonNull("priority")) {
            card.setPriority(Card.Priority.valueOf(after.get("priority").asText().toUpperCase()));
        }
        UUID stageId = readUuid(after, "stageId", readUuid(after, "columnId", null));
        if (stageId != null) {
            Stage stage = stageRepository.findById(stageId)
                .orElseThrow(() -> new IllegalArgumentException("Stage not found: " + stageId));
            card.setStage(stage);
        }
        UUID assigneeId = readUuid(after, "assigneeId", null);
        if (assigneeId != null) {
            User user = userRepository.findById(assigneeId)
                .orElseThrow(() -> new IllegalArgumentException("Assignee not found: " + assigneeId));
            card.setAssignee(user);
        }

        cardRepository.save(card);
    }

    private void applyCreateCard(Board board, JsonNode after) {
        UUID stageId = readUuid(after, "stageId", readUuid(after, "columnId", null));
        Stage fallbackStage = null;
        if (stageId == null) {
            fallbackStage = findFirstStage(board);
            if (fallbackStage != null) {
                stageId = fallbackStage.getId();
            }
        }

        if (stageId == null) {
            throw new IllegalArgumentException("CREATE_CARD could not resolve stage from mocked data and board state");
        }

        final UUID resolvedStageId = stageId;

        Stage stage = fallbackStage != null && fallbackStage.getId().equals(resolvedStageId)
            ? fallbackStage
            : stageRepository.findById(resolvedStageId)
                .orElseThrow(() -> new IllegalArgumentException("Stage not found: " + resolvedStageId));

        String title = after.hasNonNull("title") ? after.get("title").asText() : null;
        if (title == null || title.isBlank()) {
            title = "Mock generated task";
        }

        Card card = Card.builder()
            .title(title)
            .description(after.has("description") && !after.get("description").isNull() ? after.get("description").asText() : null)
            .priority(after.hasNonNull("priority") ? Card.Priority.valueOf(after.get("priority").asText().toUpperCase()) : Card.Priority.MEDIUM)
            .position(stage.getCards() != null ? stage.getCards().size() : 0)
            .stage(stage)
            .build();

        cardRepository.save(card);
    }

    private void applyDeleteCard(Board board, JsonNode before, JsonNode after) {
        UUID cardId = readUuid(before, "id", readUuid(after, "id", null));

        if (cardId == null) {
            throw new IllegalArgumentException("DELETE_CARD payload is missing required card identifier");
        }

        final UUID resolvedCardId = cardId;

        Card card = cardRepository.findById(resolvedCardId)
            .orElseThrow(() -> new IllegalArgumentException("Card not found: " + resolvedCardId));

        cardRepository.delete(card);
    }

    private Stage findFirstStage(Board board) {
        List<Stage> stages = stageRepository.findByBoardIdOrderByPosition(board.getId());
        return stages.isEmpty() ? null : stages.get(0);
    }

    private Card findAnyCardOnBoard(Board board) {
        List<Stage> stages = stageRepository.findByBoardIdOrderByPosition(board.getId());
        for (Stage stage : stages) {
            List<Card> cards = cardRepository.findByStageIdOrderByPosition(stage.getId());
            if (!cards.isEmpty()) {
                return cards.get(0);
            }
        }
        return null;
    }

    private Stage findMoveTargetStage(Board board, Stage currentStage) {
        List<Stage> stages = stageRepository.findByBoardIdOrderByPosition(board.getId());
        if (stages.isEmpty()) {
            return null;
        }

        if (currentStage == null) {
            return stages.get(0);
        }

        for (Stage stage : stages) {
            if (!stage.getId().equals(currentStage.getId())) {
                return stage;
            }
        }

        return stages.get(0);
    }

    private Card createFallbackCard(Stage stage, String title) {
        int nextPosition = stage.getCards() != null ? stage.getCards().size() : 0;
        Card card = Card.builder()
            .title(title)
            .description("Created automatically to support mocked change application")
            .priority(Card.Priority.MEDIUM)
            .position(nextPosition)
            .stage(stage)
            .build();
        return cardRepository.save(card);
    }

    private JsonNode parseJsonOrEmpty(String value) throws Exception {
        if (value == null || value.isBlank()) {
            return objectMapper.readTree("{}");
        }
        return objectMapper.readTree(value);
    }

    private UUID readUuid(JsonNode node, String field, UUID fallback) {
        if (node == null || !node.hasNonNull(field)) {
            return fallback;
        }
        try {
            return UUID.fromString(node.get(field).asText());
        } catch (Exception ex) {
            return fallback;
        }
    }

    private void audit(Change change, User actor, ChangeAuditEntry.AuditAction action, String details) {
        changeAuditEntryRepository.save(ChangeAuditEntry.builder()
            .change(change)
            .actor(actor)
            .action(action)
            .details(details)
            .build());
    }

    private String safe(String text) {
        if (text == null) {
            return "unknown";
        }
        return text.replace("\"", "'");
    }
}
