package com.flowboard.service;

import com.flowboard.dto.ApprovalStatusDTO;
import com.flowboard.dto.SubmitApprovalRequest;
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
public class ApprovalService {
    private final ApprovalRequestSummaryRepository approvalRequestRepository;
    private final ApprovalResponseSummaryRepository approvalResponseRepository;
    private final MeetingRepository meetingRepository;
    private final MeetingMemberRepository meetingMemberRepository;
    private final ActionItemRepository actionItemRepository;
    private final DecisionRepository decisionRepository;
    private final UserRepository userRepository;

    /**
     * Submit approval response for a meeting summary
     * Only meeting members can approve
     */
    public void submitApproval(UUID meetingId, User respondingUser, SubmitApprovalRequest request) {
        // Verify user is a meeting member
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, respondingUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        ApprovalRequestSummary approvalRequest = approvalRequestRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No approval request for this meeting"));

        // Find or create response entry
        ApprovalResponseSummary response = approvalResponseRepository
            .findByApprovalRequestIdAndUserId(approvalRequest.getId(), respondingUser.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Response entry not found"));

        if (response.getResponse() != ApprovalResponseSummary.ApprovalResponse.PENDING) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already submitted your approval decision");
        }

        // Parse response
        ApprovalResponseSummary.ApprovalResponse approvalResponse;
        try {
            approvalResponse = ApprovalResponseSummary.ApprovalResponse.valueOf(request.getResponse().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid response: " + request.getResponse());
        }

        // Update response
        response.setResponse(approvalResponse);
        response.setComments(request.getComments());
        response.setRespondedAt(LocalDateTime.now());
        approvalResponseRepository.save(response);

        // Check if all members have responded
        checkAndUpdateApprovalStatus(meeting, approvalRequest);
    }

    /**
     * Get approval status for a meeting
     */
    public ApprovalStatusDTO getApprovalStatus(UUID meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        ApprovalRequestSummary approvalRequest = approvalRequestRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No approval request for this meeting"));

        List<ApprovalResponseSummary> responses = approvalResponseRepository
            .findByApprovalRequestId(approvalRequest.getId());

        long approvedCount = responses.stream()
            .filter(r -> r.getResponse() == ApprovalResponseSummary.ApprovalResponse.APPROVED)
            .count();

        long rejectedCount = responses.stream()
            .filter(r -> r.getResponse() == ApprovalResponseSummary.ApprovalResponse.REJECTED)
            .count();

        List<ApprovalStatusDTO.ApprovalResponseDTO> responseList = responses.stream()
            .map(r -> ApprovalStatusDTO.ApprovalResponseDTO.builder()
                .userId(r.getUser().getId())
                .userName(r.getUser().getUsername())
                .response(r.getResponse().name())
                .comments(r.getComments())
                .respondedAt(r.getRespondedAt())
                .build())
            .collect(Collectors.toList());

        return ApprovalStatusDTO.builder()
            .meetingId(meetingId)
            .requiredApprovals(approvalRequest.getRequiredApprovals())
            .currentApprovedCount((int) approvedCount)
            .currentRejectedCount((int) rejectedCount)
            .totalApproversNeeded(approvalRequest.getRequiredApprovals())
            .responses(responseList)
            .build();
    }

    /**
     * Check if all approvals are complete and update meeting status accordingly
     * Uses consensus model (all must approve)
     */
    private void checkAndUpdateApprovalStatus(Meeting meeting, ApprovalRequestSummary approvalRequest) {
        List<ApprovalResponseSummary> responses = approvalResponseRepository
            .findByApprovalRequestId(approvalRequest.getId());

        long approvedCount = responses.stream()
            .filter(r -> r.getResponse() == ApprovalResponseSummary.ApprovalResponse.APPROVED)
            .count();

        long rejectedCount = responses.stream()
            .filter(r -> r.getResponse() == ApprovalResponseSummary.ApprovalResponse.REJECTED)
            .count();

        long totalResponded = approvedCount + rejectedCount;
        long totalRequired = responses.size();

        // If all have responded
        if (totalResponded == totalRequired) {
            if (rejectedCount > 0) {
                // If any rejected, mark as rejected
                meeting.setStatus(Meeting.MeetingStatus.REJECTED);
            } else if (approvedCount == totalRequired) {
                // If all approved, mark as approved
                meeting.setStatus(Meeting.MeetingStatus.APPROVED);
            }
            meetingRepository.save(meeting);
        }
    }

    /**
     * Check if a meeting has been fully approved
     */
    public boolean isMeetingApproved(UUID meetingId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));
        
        return meeting.getStatus() == Meeting.MeetingStatus.APPROVED;
    }

    /**
     * Check if all required approvals have been submitted
     */
    public boolean hasAllApprovalsSubmitted(UUID meetingId) {
        ApprovalRequestSummary approvalRequest = approvalRequestRepository.findByMeetingId(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "No approval request for this meeting"));

        List<ApprovalResponseSummary> responses = approvalResponseRepository
            .findByApprovalRequestId(approvalRequest.getId());

        long respondedCount = responses.stream()
            .filter(r -> r.getResponse() != ApprovalResponseSummary.ApprovalResponse.PENDING)
            .count();

        return respondedCount == responses.size();
    }

    /**
     * Approve a single action item.
     */
    public void approveActionItem(UUID actionItemId, User respondingUser) {
        ActionItem actionItem = actionItemRepository.findById(actionItemId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Action item not found"));

        UUID meetingId = actionItem.getMeeting().getId();
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, respondingUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        if (actionItem.getApprovalStatus() == ActionItem.ApprovalStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Action item is already approved");
        }

        actionItem.setApprovalStatus(ActionItem.ApprovalStatus.APPROVED);
        actionItemRepository.save(actionItem);
    }

    /**
     * Approve a single decision item.
     */
    public void approveDecision(UUID decisionId, User respondingUser) {
        Decision decision = decisionRepository.findById(decisionId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Decision not found"));

        UUID meetingId = decision.getMeeting().getId();
        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, respondingUser.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this meeting");
        }

        if (decision.getApprovalStatus() == Decision.ApprovalStatus.APPROVED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Decision is already approved");
        }

        decision.setApprovalStatus(Decision.ApprovalStatus.APPROVED);
        decisionRepository.save(decision);
    }
}
