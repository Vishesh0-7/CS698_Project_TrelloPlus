package com.flowboard.controller;

import com.flowboard.dto.AddMeetingMemberRequest;
import com.flowboard.dto.CreateMeetingRequest;
import com.flowboard.dto.EndMeetingRequest;
import com.flowboard.dto.MeetingDTO;
import com.flowboard.dto.UpdateMeetingRequest;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.JWTService;
import com.flowboard.service.MeetingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/meetings")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "http://localhost:*")
public class MeetingController {
    private final MeetingService meetingService;
    private final JWTService jwtService;
    private final UserRepository userRepository;

    /**
     * Create a new meeting for a project
     * POST /api/v1/meetings
     */
    @PostMapping
    public ResponseEntity<MeetingDTO> createMeeting(
        @Valid @RequestBody CreateMeetingRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingDTO meeting = meetingService.createMeeting(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(meeting);
    }

    /**
     * Get a meeting by ID
     * GET /api/v1/meetings/{id}
     */
    @GetMapping("/{id}")
    public ResponseEntity<MeetingDTO> getMeeting(
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        MeetingDTO meeting = meetingService.getMeeting(id, userId);
        return ResponseEntity.ok(meeting);
    }

    /**
     * Get all meetings for a project
     * GET /api/v1/projects/{projectId}/meetings
     */
    @GetMapping("/project/{projectId}")
    public ResponseEntity<List<MeetingDTO>> getMeetingsByProject(
        @PathVariable UUID projectId,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        List<MeetingDTO> meetings = meetingService.getMeetingsByProject(projectId, userId);
        return ResponseEntity.ok(meetings);
    }

    /**
     * End a meeting and provide transcript
     * POST /api/v1/meetings/{id}/end
     */
    @PostMapping("/{id}/end")
    public ResponseEntity<MeetingDTO> endMeeting(
        @PathVariable UUID id,
        @Valid @RequestBody EndMeetingRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        MeetingDTO meeting = meetingService.endMeeting(id, request.getTranscript(), userId);
        return ResponseEntity.ok(meeting);
    }

    /**
     * Update a scheduled meeting (reschedule/edit details)
     * PUT /api/v1/meetings/{id}
     */
    @PutMapping("/{id}")
    public ResponseEntity<MeetingDTO> updateMeeting(
        @PathVariable UUID id,
        @Valid @RequestBody UpdateMeetingRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        MeetingDTO meeting = meetingService.updateMeeting(id, request, currentUser);
        return ResponseEntity.ok(meeting);
    }

    /**
     * Delete a scheduled meeting
     * DELETE /api/v1/meetings/{id}
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMeeting(
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        User currentUser = getCurrentUser(authHeader);
        meetingService.deleteMeeting(id, currentUser);
        return ResponseEntity.noContent().build();
    }

    /**
     * Add a member to a meeting
     * POST /api/v1/meetings/{id}/members
     */
    @PostMapping("/{id}/members")
    public ResponseEntity<Void> addMeetingMember(
        @PathVariable UUID id,
        @Valid @RequestBody AddMeetingMemberRequest request,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID actorUserId = jwtService.extractUserIdFromAuthHeader(authHeader);
        meetingService.addMeetingMember(id, request.getUserId(), actorUserId);
        return ResponseEntity.status(HttpStatus.CREATED).build();
    }

    /**
     * Remove a member from a meeting
     * DELETE /api/v1/meetings/{id}/members/{userId}
     */
    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMeetingMember(
        @PathVariable UUID id,
        @PathVariable UUID userId,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID actorUserId = jwtService.extractUserIdFromAuthHeader(authHeader);
        meetingService.removeMeetingMember(id, userId, actorUserId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get all members of a meeting
     * GET /api/v1/meetings/{id}/members
     */
    @GetMapping("/{id}/members")
    public ResponseEntity<List<String>> getMeetingMembers(
        @PathVariable UUID id,
        @RequestHeader("Authorization") String authHeader
    ) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        List<String> memberNames = meetingService.getMeetingMembers(id, userId)
            .stream()
            .map(u -> u.getUsername())
            .collect(Collectors.toList());
        return ResponseEntity.ok(memberNames);
    }

    private User getCurrentUser(String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return userRepository.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
    }
}
