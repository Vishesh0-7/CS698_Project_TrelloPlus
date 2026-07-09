package com.flowboard.controller;

import com.flowboard.dto.ApprovalStatusDTO;
import com.flowboard.dto.SubmitApprovalRequest;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.ApprovalService;
import com.flowboard.service.JWTService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
public class ApprovalSummaryController {
    private final ApprovalService approvalService;
    private final JWTService jwtService;
    private final UserRepository userRepository;

    /**
     * Submit approval response for a meeting summary
     * POST /api/v1/approvals/summary/{meetingId}
     */
    @PostMapping("/summary/{meetingId}")
    public ResponseEntity<Void> submitApproval(
        @PathVariable UUID meetingId,
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody SubmitApprovalRequest request
    ) {
        User currentUser = getCurrentUser(authHeader);
        approvalService.submitApproval(meetingId, currentUser, request);
        return ResponseEntity.status(HttpStatus.OK).build();
    }

    /**
     * Approve a single action item.
     * POST /api/v1/approvals/items/action-items/{itemId}/approve
     */
    @PostMapping("/items/action-items/{itemId}/approve")
    public ResponseEntity<Void> approveActionItem(
        @PathVariable UUID itemId,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        approvalService.approveActionItem(itemId, currentUser);
        return ResponseEntity.ok().build();
    }

    /**
     * Approve a single decision item.
     * POST /api/v1/approvals/items/decisions/{itemId}/approve
     */
    @PostMapping("/items/decisions/{itemId}/approve")
    public ResponseEntity<Void> approveDecision(
        @PathVariable UUID itemId,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        approvalService.approveDecision(itemId, currentUser);
        return ResponseEntity.ok().build();
    }

    /**
     * Get approval status for a meeting
     * GET /api/v1/approvals/summary/{meetingId}
     */
    @GetMapping("/summary/{meetingId}")
    public ResponseEntity<ApprovalStatusDTO> getApprovalStatus(
        @PathVariable UUID meetingId,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        ApprovalStatusDTO status = approvalService.getApprovalStatus(meetingId, userId);
        return ResponseEntity.ok(status);
    }

    /**
     * Check if meeting is approved
     * GET /api/v1/approvals/summary/{meetingId}/approved
     */
    @GetMapping("/summary/{meetingId}/approved")
    public ResponseEntity<Boolean> isMeetingApproved(
        @PathVariable UUID meetingId,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        boolean approved = approvalService.isMeetingApproved(meetingId, userId);
        return ResponseEntity.ok(approved);
    }

    /**
     * Check if all approvals submitted
     * GET /api/v1/approvals/summary/{meetingId}/all-submitted
     */
    @GetMapping("/summary/{meetingId}/all-submitted")
    public ResponseEntity<Boolean> hasAllApprovalsSubmitted(
        @PathVariable UUID meetingId,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        boolean submitted = approvalService.hasAllApprovalsSubmitted(meetingId, userId);
        return ResponseEntity.ok(submitted);
    }

    private User getCurrentUser(String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
