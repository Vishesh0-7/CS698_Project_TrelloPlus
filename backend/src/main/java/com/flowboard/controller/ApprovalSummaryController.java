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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/approvals")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "http://localhost:*")
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
        @RequestHeader(value = "Authorization", required = false) String authHeader,
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
        @RequestHeader(value = "Authorization", required = false) String authHeader
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
        @RequestHeader(value = "Authorization", required = false) String authHeader
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
    public ResponseEntity<ApprovalStatusDTO> getApprovalStatus(@PathVariable UUID meetingId) {
        ApprovalStatusDTO status = approvalService.getApprovalStatus(meetingId);
        return ResponseEntity.ok(status);
    }

    /**
     * Check if meeting is approved
     * GET /api/v1/approvals/summary/{meetingId}/approved
     */
    @GetMapping("/summary/{meetingId}/approved")
    public ResponseEntity<Boolean> isMeetingApproved(@PathVariable UUID meetingId) {
        boolean approved = approvalService.isMeetingApproved(meetingId);
        return ResponseEntity.ok(approved);
    }

    /**
     * Check if all approvals submitted
     * GET /api/v1/approvals/summary/{meetingId}/all-submitted
     */
    @GetMapping("/summary/{meetingId}/all-submitted")
    public ResponseEntity<Boolean> hasAllApprovalsSubmitted(@PathVariable UUID meetingId) {
        boolean submitted = approvalService.hasAllApprovalsSubmitted(meetingId);
        return ResponseEntity.ok(submitted);
    }

    /**
     * Extract current user from security context
     */
    private User getCurrentUser(String authHeader) {
        if (authHeader != null && !authHeader.isBlank()) {
            UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
            return userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof User principalUser) {
            return principalUser;
        }

        if (authentication != null && authentication.getName() != null) {
            return userRepository.findByEmailIgnoreCase(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication");
    }
}
