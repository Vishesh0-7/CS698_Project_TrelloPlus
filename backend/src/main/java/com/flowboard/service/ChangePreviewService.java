package com.flowboard.service;

import com.flowboard.dto.*;
import com.flowboard.entity.Change;
import com.flowboard.entity.ChangeAuditEntry;
import com.flowboard.entity.Meeting;
import com.flowboard.repository.ChangeAuditEntryRepository;
import com.flowboard.repository.ChangeRepository;
import com.flowboard.repository.MeetingMemberRepository;
import com.flowboard.repository.ProjectMemberRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ChangePreviewService {
    private final ChangeRepository changeRepository;
    private final ChangeAuditEntryRepository changeAuditEntryRepository;
    private final MeetingMemberRepository meetingMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public List<ChangeDTO> listChanges(UUID meetingId, UUID projectId, String status, UUID userId) {
        List<Change> changes;
        if (meetingId != null && status != null && !status.isBlank()) {
            verifyMeetingAccess(meetingId, userId);
            changes = changeRepository.findByMeetingIdAndStatus(meetingId, parseStatus(status));
        } else if (meetingId != null) {
            verifyMeetingAccess(meetingId, userId);
            changes = changeRepository.findByMeetingId(meetingId);
        } else if (projectId != null && status != null && !status.isBlank()) {
            verifyProjectAccess(projectId, userId);
            changes = changeRepository.findByMeetingProjectIdAndStatus(projectId, parseStatus(status));
        } else if (projectId != null) {
            verifyProjectAccess(projectId, userId);
            changes = changeRepository.findByMeetingProjectId(projectId);
        } else if (status != null && !status.isBlank()) {
            // When filtering by status only, return changes for projects user has access to
            changes = changeRepository.findByStatus(parseStatus(status)).stream()
                .filter(c -> hasProjectAccess(c.getMeeting().getProject().getId(), userId))
                .collect(Collectors.toList());
        } else {
            // Return changes for projects user has access to
            changes = changeRepository.findAll().stream()
                .filter(c -> hasProjectAccess(c.getMeeting().getProject().getId(), userId))
                .collect(Collectors.toList());
        }

        return changes.stream().map(this::toDTO).collect(Collectors.toList());
    }

    public ChangeDTO getChange(UUID changeId, UUID userId) {
        Change change = getChangeEntity(changeId);
        verifyMeetingAccess(change.getMeeting().getId(), userId);
        return toDTO(change);
    }

    public ChangeDiffDTO getDiff(UUID changeId, UUID userId) {
        Change change = getChangeEntity(changeId);
        verifyMeetingAccess(change.getMeeting().getId(), userId);
        String summary = switch (change.getChangeType()) {
            case MOVE_CARD -> "Card moved between workflow columns";
            case UPDATE_CARD -> "Card fields were updated";
            case CREATE_CARD -> "New card was proposed";
            case DELETE_CARD -> "Existing card was proposed for deletion";
        };

        return ChangeDiffDTO.builder()
            .beforeState(change.getBeforeState())
            .afterState(change.getAfterState())
            .summary(summary)
            .build();
    }

    public ChangeImpactDTO getImpact(UUID changeId, UUID userId) {
        Change change = getChangeEntity(changeId);
        verifyMeetingAccess(change.getMeeting().getId(), userId);

        String riskLevel = switch (change.getChangeType()) {
            case DELETE_CARD -> "HIGH";
            case UPDATE_CARD -> "MEDIUM";
            case MOVE_CARD -> "LOW";
            case CREATE_CARD -> "LOW";
        };

        return ChangeImpactDTO.builder()
            .affectedCards(Collections.singletonList(extractLikelyCardId(change)))
            .affectedStages(Collections.emptyList())
            .riskLevel(riskLevel)
            .potentialConflicts(Collections.emptyList())
            .build();
    }

    public List<ChangeHistoryEntryDTO> getHistory(UUID changeId, UUID userId) {
        Change change = getChangeEntity(changeId);
        verifyMeetingAccess(change.getMeeting().getId(), userId);
        return changeAuditEntryRepository.findByChangeIdOrderByCreatedAtDesc(changeId)
            .stream()
            .map(this::toHistoryDTO)
            .collect(Collectors.toList());
    }

    private void verifyMeetingAccess(UUID meetingId, UUID userId) {
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }
    }

    private void verifyProjectAccess(UUID projectId, UUID userId) {
        if (!hasProjectAccess(projectId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }
    }

    private boolean hasProjectAccess(UUID projectId, UUID userId) {
        // Check if user has a role in the project (owner also has entry in project_members)
        return projectMemberRepository.findMemberRole(projectId, userId).isPresent();
    }

    private Change getChangeEntity(UUID changeId) {
        return changeRepository.findById(changeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change not found"));
    }

    private Change.ChangeStatus parseStatus(String status) {
        try {
            return Change.ChangeStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
    }

    private ChangeDTO toDTO(Change change) {
        return ChangeDTO.builder()
            .id(change.getId())
            .meetingId(change.getMeeting().getId())
            .changeType(change.getChangeType().name())
            .beforeState(change.getBeforeState())
            .afterState(change.getAfterState())
            .status(change.getStatus().name())
            .createdAt(change.getCreatedAt())
            .build();
    }

    private ChangeHistoryEntryDTO toHistoryDTO(ChangeAuditEntry entry) {
        return ChangeHistoryEntryDTO.builder()
            .id(entry.getId())
            .action(entry.getAction().name())
            .actorId(entry.getActor() != null ? entry.getActor().getId() : null)
            .actorName(entry.getActor() != null ? entry.getActor().getUsername() : null)
            .details(entry.getDetails())
            .createdAt(entry.getCreatedAt())
            .build();
    }

    private String extractLikelyCardId(Change change) {
        if (change.getAfterState() != null && change.getAfterState().contains("id")) {
            return "card-referenced-in-after-state";
        }
        if (change.getBeforeState() != null && change.getBeforeState().contains("id")) {
            return "card-referenced-in-before-state";
        }
        return "unknown";
    }
}
