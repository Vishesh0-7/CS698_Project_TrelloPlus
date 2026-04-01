package com.flowboard.controller;

import com.flowboard.dto.*;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.ChangeApplicationService;
import com.flowboard.service.ChangeApprovalService;
import com.flowboard.service.ChangePreviewService;
import com.flowboard.service.JWTService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/changes")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "http://localhost:*")
public class ChangeController {
    private final ChangePreviewService changePreviewService;
    private final ChangeApprovalService changeApprovalService;
    private final ChangeApplicationService changeApplicationService;
    private final JWTService jwtService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<ChangeDTO>> listChanges(
        @RequestParam(required = false) UUID meetingId,
        @RequestParam(required = false) UUID projectId,
        @RequestParam(required = false) String status,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return ResponseEntity.ok(changePreviewService.listChanges(meetingId, projectId, status, userId));
    }

    // @GetMapping("/{id}")
    // public ResponseEntity<ChangeDTO> getChange(
    //     @PathVariable UUID id,
    //     @RequestHeader("Authorization") String authHeader
    // ) {
    //     UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
    //     return ResponseEntity.ok(changePreviewService.getChange(id, userId));
    // }

    @GetMapping("/{id}/diff")
    public ResponseEntity<ChangeDiffDTO> getDiff(
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return ResponseEntity.ok(changePreviewService.getDiff(id, userId));
    }

    // @GetMapping("/{id}/impact")
    // public ResponseEntity<ChangeImpactDTO> getImpact(
    //     @PathVariable UUID id,
    //     @RequestHeader("Authorization") String authHeader
    // ) {
    //     UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
    //     return ResponseEntity.ok(changePreviewService.getImpact(id, userId));
    // }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApprovalStatusDTO> approve(
        @PathVariable UUID id,
        @Valid @RequestBody ChangeDecisionRequest request
    ) {
        User actor = getCurrentUser();
        request.setDecision("APPROVE");
        return ResponseEntity.ok(changeApprovalService.decide(id, actor, request));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApprovalStatusDTO> reject(
        @PathVariable UUID id,
        @Valid @RequestBody ChangeDecisionRequest request
    ) {
        User actor = getCurrentUser();
        request.setDecision("REJECT");
        return ResponseEntity.ok(changeApprovalService.decide(id, actor, request));
    }

    @PostMapping("/{id}/decision")
    public ResponseEntity<ApprovalStatusDTO> submitDecision(
        @PathVariable UUID id,
        @Valid @RequestBody ChangeDecisionRequest request
    ) {
        User actor = getCurrentUser();
        return ResponseEntity.ok(changeApprovalService.decide(id, actor, request));
    }

    @GetMapping("/{id}/approval-status")
    public ResponseEntity<ApprovalStatusDTO> getApprovalStatus(@PathVariable UUID id) {
        return ResponseEntity.ok(changeApprovalService.getApprovalStatus(id));
    }

    @PostMapping("/{id}/apply")
    public ResponseEntity<ChangeApplyResultDTO> apply(
        @PathVariable UUID id
    ) {
        User actor = getCurrentUser();
        return ResponseEntity.ok(changeApplicationService.applyChange(id, actor));
    }

    // @GetMapping("/{id}/history")
    // public ResponseEntity<List<ChangeHistoryEntryDTO>> getHistory(
    //     @PathVariable UUID id,
    //     @RequestHeader("Authorization") String authHeader
    // ) {
    //     UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
    //     return ResponseEntity.ok(changePreviewService.getHistory(id, userId));
    // }

    private User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing authentication");
        }

        String email = authentication.getName();
        return userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
