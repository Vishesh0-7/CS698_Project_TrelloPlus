package com.flowboard.service;

import com.flowboard.dto.ApprovalStatusDTO;
import com.flowboard.dto.ChangeDecisionRequest;
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
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ChangeApprovalService {
    private final ChangeRepository changeRepository;
    private final ChangeApprovalRequestRepository changeApprovalRequestRepository;
    private final ChangeApprovalResponseRepository changeApprovalResponseRepository;
    private final MeetingMemberRepository meetingMemberRepository;
    private final ChangeAuditEntryRepository changeAuditEntryRepository;
    private final BoardBroadcastService broadcastService;

    public ApprovalStatusDTO decide(UUID changeId, User actor, ChangeDecisionRequest request) {
        Change change = changeRepository.findById(changeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change not found"));

        ensureMeetingMember(change.getMeeting().getId(), actor.getId());

        ChangeApprovalRequest approvalRequest = ensureApprovalRequest(change);
        ChangeApprovalResponse response = changeApprovalResponseRepository
            .findByApprovalRequestIdAndUserId(approvalRequest.getId(), actor.getId())
            .orElseGet(() -> changeApprovalResponseRepository.save(ChangeApprovalResponse.builder()
                .approvalRequest(approvalRequest)
                .user(actor)
                .decision(ChangeApprovalResponse.ApprovalDecision.PENDING)
                .build()));

        ChangeApprovalResponse.ApprovalDecision decision = parseDecision(request.getDecision());
        response.setDecision(decision);
        response.setFeedback(request.getFeedback());
        response.setDecidedAt(LocalDateTime.now());
        changeApprovalResponseRepository.save(response);

        transitionChangeStatus(change, approvalRequest.getId(), approvalRequest.getRequiredApprovals());
        audit(change, actor, mapAuditAction(decision), "{\"decision\":\"" + decision.name() + "\"}");

        UUID projectId = change.getMeeting().getProject().getId();
        broadcastService.broadcastChangeApprovalChanged(
            projectId,
            changeId,
            decision.name(),
            request.getFeedback()
        );
        broadcastService.broadcastChangeStatusChanged(projectId, changeId, change.getStatus().name());

        return getApprovalStatus(changeId);
    }

    public ApprovalStatusDTO getApprovalStatus(UUID changeId) {
        Change change = changeRepository.findById(changeId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Change not found"));
        ChangeApprovalRequest request = ensureApprovalRequest(change);

        List<ChangeApprovalResponse> responses = changeApprovalResponseRepository.findByApprovalRequestId(request.getId());
        int approvedCount = (int) responses.stream().filter(r -> r.getDecision() == ChangeApprovalResponse.ApprovalDecision.APPROVE).count();
        int rejectedCount = (int) responses.stream().filter(r -> r.getDecision() == ChangeApprovalResponse.ApprovalDecision.REJECT).count();

        return ApprovalStatusDTO.builder()
            .meetingId(change.getMeeting().getId())
            .requiredApprovals(request.getRequiredApprovals())
            .currentApprovedCount(approvedCount)
            .currentRejectedCount(rejectedCount)
            .totalApproversNeeded((int) meetingMemberRepository.countByMeetingId(change.getMeeting().getId()))
            .responses(responses.stream().map(r -> ApprovalStatusDTO.ApprovalResponseDTO.builder()
                .userId(r.getUser().getId())
                .userName(r.getUser().getUsername())
                .response(r.getDecision().name())
                .comments(r.getFeedback())
                .respondedAt(r.getDecidedAt())
                .build()).collect(Collectors.toList()))
            .build();
    }

    private void ensureMeetingMember(UUID meetingId, UUID userId) {
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a meeting member");
        }
    }

    private ChangeApprovalRequest ensureApprovalRequest(Change change) {
        return changeApprovalRequestRepository.findByChangeId(change.getId())
            .orElseGet(() -> {
                int requiredApprovals = Math.max(1, (int) Math.ceil(meetingMemberRepository.countByMeetingId(change.getMeeting().getId()) / 2.0));
                ChangeApprovalRequest created = changeApprovalRequestRepository.save(ChangeApprovalRequest.builder()
                    .change(change)
                    .requiredApprovals(requiredApprovals)
                    .build());
                audit(change, null, ChangeAuditEntry.AuditAction.APPROVAL_REQUEST_CREATED, "{\"requiredApprovals\":" + requiredApprovals + "}");
                return created;
            });
    }

    private void transitionChangeStatus(Change change, UUID approvalRequestId, int requiredApprovals) {
        long approved = changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequestId,
            ChangeApprovalResponse.ApprovalDecision.APPROVE
        );
        long rejected = changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequestId,
            ChangeApprovalResponse.ApprovalDecision.REJECT
        );

        if (rejected > 0) {
            change.setStatus(Change.ChangeStatus.REJECTED);
        } else if (approved >= requiredApprovals) {
            change.setStatus(Change.ChangeStatus.READY_FOR_APPLICATION);
        } else {
            change.setStatus(Change.ChangeStatus.UNDER_REVIEW);
        }
        changeRepository.save(change);
    }

    private ChangeApprovalResponse.ApprovalDecision parseDecision(String decision) {
        try {
            return ChangeApprovalResponse.ApprovalDecision.valueOf(decision.trim().toUpperCase());
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid decision. Use APPROVE, REJECT, or DEFER.");
        }
    }

    private ChangeAuditEntry.AuditAction mapAuditAction(ChangeApprovalResponse.ApprovalDecision decision) {
        return switch (decision) {
            case APPROVE -> ChangeAuditEntry.AuditAction.APPROVED;
            case REJECT -> ChangeAuditEntry.AuditAction.REJECTED;
            case DEFER -> ChangeAuditEntry.AuditAction.DEFERRED;
            case PENDING -> ChangeAuditEntry.AuditAction.VIEWED;
        };
    }

    private void audit(Change change, User actor, ChangeAuditEntry.AuditAction action, String details) {
        changeAuditEntryRepository.save(ChangeAuditEntry.builder()
            .change(change)
            .actor(actor)
            .action(action)
            .details(details)
            .build());
    }
}
