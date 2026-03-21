package com.flowboard.controller;

import com.flowboard.dto.GenerateSummaryRequest;
import com.flowboard.dto.MeetingSummaryDTO;
import com.flowboard.dto.UpsertActionItemRequest;
import com.flowboard.dto.UpsertDecisionRequest;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.JWTService;
import com.flowboard.service.SummaryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

@RestController
@RequestMapping("/summaries")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "http://localhost:*")
public class SummaryController {
    private final SummaryService summaryService;
    private final JWTService jwtService;
    private final UserRepository userRepository;

    /**
     * Generate summary from meeting transcript
     * POST /api/v1/summaries
     */
    @PostMapping
    public ResponseEntity<MeetingSummaryDTO> generateSummary(
        @Valid @RequestBody GenerateSummaryRequest request
    ) {
        MeetingSummaryDTO summary = summaryService.generateSummary(request.getMeetingId());
        return ResponseEntity.status(HttpStatus.CREATED).body(summary);
    }

    /**
     * Get a summary by ID
     * GET /api/v1/summaries/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<MeetingSummaryDTO> getSummary(@PathVariable UUID id) {
        MeetingSummaryDTO summary = summaryService.getSummary(id);
        return ResponseEntity.ok(summary);
    }

    /**
     * Get summary for a meeting
     * GET /api/v1/meetings/{meetingId}/summary
     */
    @GetMapping("/meeting/{meetingId}")
    public ResponseEntity<MeetingSummaryDTO> getSummaryByMeeting(@PathVariable UUID meetingId) {
        MeetingSummaryDTO summary = summaryService.getSummaryByMeeting(meetingId);
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/meeting/{meetingId}/action-items")
    public ResponseEntity<MeetingSummaryDTO> addActionItem(
        @PathVariable UUID meetingId,
        @Valid @RequestBody UpsertActionItemRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingSummaryDTO summary = summaryService.addActionItem(
            meetingId,
            request.getDescription(),
            request.getSourceContext(),
            request.getPriority(),
            currentUser
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(summary);
    }

    @PutMapping("/action-items/{actionItemId}")
    public ResponseEntity<MeetingSummaryDTO> updateActionItem(
        @PathVariable UUID actionItemId,
        @Valid @RequestBody UpsertActionItemRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingSummaryDTO summary = summaryService.updateActionItem(
            actionItemId,
            request.getDescription(),
            request.getSourceContext(),
            request.getPriority(),
            currentUser
        );
        return ResponseEntity.ok(summary);
    }

    @DeleteMapping("/action-items/{actionItemId}")
    public ResponseEntity<MeetingSummaryDTO> deleteActionItem(
        @PathVariable UUID actionItemId,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingSummaryDTO summary = summaryService.deleteActionItem(actionItemId, currentUser);
        return ResponseEntity.ok(summary);
    }

    @PostMapping("/meeting/{meetingId}/decisions")
    public ResponseEntity<MeetingSummaryDTO> addDecision(
        @PathVariable UUID meetingId,
        @Valid @RequestBody UpsertDecisionRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingSummaryDTO summary = summaryService.addDecision(
            meetingId,
            request.getDescription(),
            request.getSourceContext(),
            request.getImpactSummary(),
            currentUser
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(summary);
    }

    @PutMapping("/decisions/{decisionId}")
    public ResponseEntity<MeetingSummaryDTO> updateDecision(
        @PathVariable UUID decisionId,
        @Valid @RequestBody UpsertDecisionRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingSummaryDTO summary = summaryService.updateDecision(
            decisionId,
            request.getDescription(),
            request.getSourceContext(),
            request.getImpactSummary(),
            currentUser
        );
        return ResponseEntity.ok(summary);
    }

    @DeleteMapping("/decisions/{decisionId}")
    public ResponseEntity<MeetingSummaryDTO> deleteDecision(
        @PathVariable UUID decisionId,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingSummaryDTO summary = summaryService.deleteDecision(decisionId, currentUser);
        return ResponseEntity.ok(summary);
    }

    private User getCurrentUser(String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
