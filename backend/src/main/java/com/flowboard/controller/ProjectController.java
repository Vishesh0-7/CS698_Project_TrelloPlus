package com.flowboard.controller;

import com.flowboard.dto.*;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.IdempotencyService;
import com.flowboard.service.JWTService;
import com.flowboard.service.ProjectService;
import com.flowboard.service.RateLimitService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/projects")
@RequiredArgsConstructor
@CrossOrigin(originPatterns = "http://localhost:*")
public class ProjectController {
    private final ProjectService projectService;
    private final JWTService jwtService;
    private final UserRepository userRepository;
    private final RateLimitService rateLimitService;
    private final IdempotencyService idempotencyService;

    @PostMapping
    @Transactional
    public ResponseEntity<ProjectDTO> createProject(
        @Valid @RequestBody CreateProjectRequest request,
        @RequestHeader("Authorization") String authHeader,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        rateLimitService.check(
            "project-create:user:" + userId,
            20,
            Duration.ofMinutes(1),
            "Too many project creation requests. Please try again later."
        );
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            idempotencyService.ensureUnique(
                "project-create:" + userId + ":" + idempotencyKey,
                Duration.ofHours(24),
                "Duplicate project creation request detected"
            );
        }
        
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found"));
        
        return ResponseEntity.status(HttpStatus.CREATED).body(projectService.createProject(request, user));
    }

    @GetMapping
    @Transactional
    public ResponseEntity<List<ProjectDTO>> getUserProjects(
        @RequestHeader("Authorization") String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        
        return ResponseEntity.ok(projectService.getUserProjects(userId));
    }

    @GetMapping("/{projectId}")
    public ResponseEntity<ProjectDTO> getProject(
        @PathVariable UUID projectId,
        @RequestHeader("Authorization") String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);

        return ResponseEntity.ok(projectService.getProject(projectId, userId));
    }

    @PutMapping("/{projectId}")
    @Transactional
    public ResponseEntity<ProjectDTO> updateProject(
        @PathVariable UUID projectId,
        @Valid @RequestBody UpdateProjectRequest request,
        @RequestHeader("Authorization") String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        rateLimitService.check(
            "project-update:user:" + userId,
            60,
            Duration.ofMinutes(1),
            "Too many update requests. Please try again later."
        );

        return ResponseEntity.ok(projectService.updateProject(projectId, userId, request));
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> deleteProject(
        @PathVariable UUID projectId,
        @RequestHeader("Authorization") String authHeader,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        rateLimitService.check(
            "project-delete:user:" + userId,
            10,
            Duration.ofMinutes(1),
            "Too many delete requests. Please try again later."
        );
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            idempotencyService.ensureUnique(
                "project-delete:" + userId + ":" + projectId + ":" + idempotencyKey,
                Duration.ofHours(24),
                "Duplicate project deletion request detected"
            );
        }

        projectService.deleteProject(projectId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{projectId}/members")
    public ResponseEntity<List<TeamMemberDTO>> getProjectMembers(
        @PathVariable UUID projectId,
        @RequestHeader("Authorization") String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);

        return ResponseEntity.ok(projectService.getProjectMembers(projectId, userId));
    }

    @PostMapping("/{projectId}/members")
    public ResponseEntity<TeamMemberDTO> addTeamMember(
        @PathVariable UUID projectId,
        @Valid @RequestBody InviteTeamMemberRequest request,
        @RequestHeader("Authorization") String authHeader,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        rateLimitService.check(
            "project-add-member:user:" + userId,
            30,
            Duration.ofMinutes(1),
            "Too many add-member requests. Please try again later."
        );
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            idempotencyService.ensureUnique(
                "project-add-member:" + userId + ":" + projectId + ":" + idempotencyKey,
                Duration.ofHours(24),
                "Duplicate add-member request detected"
            );
        }

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(projectService.addTeamMember(projectId, request.getEmail(), request.getRole(), userId));
    }

    @PutMapping("/{projectId}/members/{userId}")
    public ResponseEntity<TeamMemberDTO> updateTeamMemberRole(
        @PathVariable UUID projectId,
        @PathVariable UUID userId,
        @Valid @RequestBody UpdateTeamMemberRoleRequest request,
        @RequestHeader("Authorization") String authHeader) {
        UUID requesterId = jwtService.extractUserIdFromAuthHeader(authHeader);

        return ResponseEntity.ok(projectService.updateTeamMemberRole(projectId, userId, request.getRole(), requesterId));
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public ResponseEntity<Void> removeTeamMember(
        @PathVariable UUID projectId,
        @PathVariable UUID userId,
        @RequestHeader("Authorization") String authHeader,
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey) {
        UUID requesterId = jwtService.extractUserIdFromAuthHeader(authHeader);
        rateLimitService.check(
            "project-remove-member:user:" + requesterId,
            30,
            Duration.ofMinutes(1),
            "Too many remove-member requests. Please try again later."
        );
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            idempotencyService.ensureUnique(
                "project-remove-member:" + requesterId + ":" + projectId + ":" + userId + ":" + idempotencyKey,
                Duration.ofHours(24),
                "Duplicate remove-member request detected"
            );
        }

        projectService.removeTeamMember(projectId, userId, requesterId);
        return ResponseEntity.noContent().build();
    }
}
