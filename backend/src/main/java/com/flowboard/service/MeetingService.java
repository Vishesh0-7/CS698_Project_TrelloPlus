package com.flowboard.service;

import com.flowboard.dto.CreateMeetingRequest;
import com.flowboard.dto.MeetingDTO;
import com.flowboard.dto.UpdateMeetingRequest;
import com.flowboard.dto.UserDTO;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class MeetingService {
    private final MeetingRepository meetingRepository;
    private final MeetingMemberRepository meetingMemberRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final UserRepository userRepository;

    /**
     * Creates a new meeting for a project.
      * Initializes meeting_members from selected project members.
     */
    public MeetingDTO createMeeting(CreateMeetingRequest request, User createdBy) {
        // Validate project exists and user is a project member
        Project project = projectRepository.findById(request.getProjectId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        boolean isProjectMember = project.getOwner().getId().equals(createdBy.getId())
            || projectMemberRepository.findMemberRole(project.getId(), createdBy.getId()).isPresent();

        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        LocalTime effectiveMeetingTime = request.getMeetingTime() != null ? request.getMeetingTime() : LocalTime.MIDNIGHT;
        LocalDateTime scheduledAt = request.getMeetingDate().atTime(effectiveMeetingTime);
        if (scheduledAt.isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Meeting cannot be scheduled in the past");
        }

        // Create meeting
        Meeting meeting = Meeting.builder()
            .project(project)
            .title(request.getTitle())
            .description(request.getDescription())
            .meetingDate(request.getMeetingDate())
            .meetingTime(request.getMeetingTime())
            .platform(request.getPlatform())
            .meetingLink(request.getMeetingLink())
            .status(Meeting.MeetingStatus.SCHEDULED)
            .createdBy(createdBy)
            .build();

        meeting = meetingRepository.save(meeting);

        // Collect all valid project participant IDs (owner + project_members entries)
        List<UUID> projectMemberIds = projectMemberRepository.findProjectMemberRoles(project.getId())
            .stream()
            .map(row -> row[0] instanceof UUID ? (UUID) row[0] : UUID.fromString(row[0].toString()))
            .collect(Collectors.toList());

        if (!projectMemberIds.contains(project.getOwner().getId())) {
            projectMemberIds.add(project.getOwner().getId());
        }

        List<UUID> selectedMemberIds = request.getAdditionalMemberIds() != null && !request.getAdditionalMemberIds().isEmpty()
            ? request.getAdditionalMemberIds().stream().filter(Objects::nonNull).distinct().collect(Collectors.toList())
            : projectMemberIds;

        if (selectedMemberIds.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least one meeting member must be selected");
        }

        boolean hasInvalidSelection = selectedMemberIds.stream().anyMatch(memberId -> !projectMemberIds.contains(memberId));
        if (hasInvalidSelection) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selected meeting members must belong to the project");
        }

        List<User> selectedMembers = userRepository.findAllById(selectedMemberIds);
        for (User member : selectedMembers) {
            MeetingMember meetingMember = MeetingMember.builder()
                .meeting(meeting)
                .user(member)
                .build();
            meetingMemberRepository.save(meetingMember);
        }

        return convertToDTO(meeting);
    }

    /**
     * Get a meeting by ID - verifies user is project member
     */
    public MeetingDTO getMeeting(UUID meetingId, UUID userId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        // Verify user is a member of the meeting's project
        UUID projectId = meeting.getProject().getId();
        boolean isProjectMember = meeting.getProject().getOwner().getId().equals(userId)
            || projectMemberRepository.findMemberRole(projectId, userId).isPresent();
        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        return convertToDTO(meeting);
    }

    /**
     * Get all meetings for a project - verifies user is project member
     */
    public List<MeetingDTO> getMeetingsByProject(UUID projectId, UUID userId) {
        // Verify project exists
        Project project = projectRepository.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));

        // Verify user is a member of the project
        boolean isProjectMember = project.getOwner().getId().equals(userId)
            || projectMemberRepository.findMemberRole(projectId, userId).isPresent();
        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        List<Meeting> meetings = meetingRepository.findByProjectId(projectId);
        meetings.sort(
            Comparator.comparing(Meeting::getMeetingDate)
                .thenComparing(meeting -> meeting.getMeetingTime() != null ? meeting.getMeetingTime() : LocalTime.MIDNIGHT)
                .reversed()
        );
        return meetings.stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    /**
     * Update meeting transcript and mark as ended (idempotent)
     * Allows being called multiple times on meetings in any status that can accept transcripts
     * Verifies user is project member
     */
    public MeetingDTO endMeeting(UUID meetingId, String transcript, UUID userId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        // Verify user is a member of the meeting's project
        UUID projectId = meeting.getProject().getId();
        boolean isProjectMember = meeting.getProject().getOwner().getId().equals(userId)
            || projectMemberRepository.findMemberRole(projectId, userId).isPresent();
        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        // Update transcript
        if (transcript != null && !transcript.isEmpty()) {
            meeting.setTranscript(transcript);
        }

        // Only transition to PENDING_APPROVAL if not already in a terminal state
        if (meeting.getStatus() == Meeting.MeetingStatus.SCHEDULED ||
            meeting.getStatus() == Meeting.MeetingStatus.IN_PROGRESS) {
            meeting.setStatus(Meeting.MeetingStatus.PENDING_APPROVAL);
        }
        // If already PENDING_APPROVAL or beyond, just keep current status (idempotent)
        
        meeting = meetingRepository.save(meeting);
        return convertToDTO(meeting);
    }

    /**
     * Update a scheduled meeting details (e.g., reschedule)
     */
    public MeetingDTO updateMeeting(UUID meetingId, UpdateMeetingRequest request, User actor) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        if (meeting.getStatus() != Meeting.MeetingStatus.SCHEDULED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only scheduled meetings can be edited");
        }

        UUID projectId = meeting.getProject().getId();
        boolean isProjectMember = meeting.getProject().getOwner().getId().equals(actor.getId())
            || projectMemberRepository.findMemberRole(projectId, actor.getId()).isPresent();
        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        LocalTime effectiveTime = request.getMeetingTime() != null ? request.getMeetingTime() : LocalTime.MIDNIGHT;
        LocalDateTime scheduledAt = request.getMeetingDate().atTime(effectiveTime);
        if (scheduledAt.isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Meeting cannot be scheduled in the past");
        }

        meeting.setTitle(request.getTitle());
        meeting.setDescription(request.getDescription());
        meeting.setMeetingDate(request.getMeetingDate());
        meeting.setMeetingTime(request.getMeetingTime());
        meeting.setPlatform(request.getPlatform());
        meeting.setMeetingLink(request.getMeetingLink());

        meeting = meetingRepository.save(meeting);
        return convertToDTO(meeting);
    }

    /**
     * Delete a scheduled meeting
     */
    public void deleteMeeting(UUID meetingId, User actor) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        if (meeting.getStatus() != Meeting.MeetingStatus.SCHEDULED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only scheduled meetings can be removed");
        }

        UUID projectId = meeting.getProject().getId();
        boolean isProjectMember = meeting.getProject().getOwner().getId().equals(actor.getId())
            || projectMemberRepository.findMemberRole(projectId, actor.getId()).isPresent();
        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        meetingRepository.delete(meeting);
    }

    /**
     * Add a user to a meeting - verifies actor is project member
     */
    public void addMeetingMember(UUID meetingId, UUID userIdToAdd, UUID actorUserId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        // Verify actor is a member of the meeting's project
        UUID projectId = meeting.getProject().getId();
        boolean isActorProjectMember = meeting.getProject().getOwner().getId().equals(actorUserId)
            || projectMemberRepository.findMemberRole(projectId, actorUserId).isPresent();
        if (!isActorProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        User user = userRepository.findById(userIdToAdd)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Verify user being added is also a project member
        boolean isTargetProjectMember = meeting.getProject().getOwner().getId().equals(userIdToAdd)
            || projectMemberRepository.findMemberRole(projectId, userIdToAdd).isPresent();
        if (!isTargetProjectMember) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot add user who is not a project member");
        }

        if (meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userIdToAdd)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User is already a meeting member");
        }

        MeetingMember meetingMember = MeetingMember.builder()
            .meeting(meeting)
            .user(user)
            .build();
        meetingMemberRepository.save(meetingMember);
    }

    /**
     * Remove a user from a meeting - verifies actor is project member
     */
    public void removeMeetingMember(UUID meetingId, UUID userIdToRemove, UUID actorUserId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        // Verify actor is a member of the meeting's project
        UUID projectId = meeting.getProject().getId();
        boolean isActorProjectMember = meeting.getProject().getOwner().getId().equals(actorUserId)
            || projectMemberRepository.findMemberRole(projectId, actorUserId).isPresent();
        if (!isActorProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        if (!meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userIdToRemove)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting member not found");
        }

        meetingMemberRepository.deleteByMeetingIdAndUserId(meetingId, userIdToRemove);
    }

    /**
     * Get all members of a meeting - verifies user is project member
     */
    public List<User> getMeetingMembers(UUID meetingId, UUID userId) {
        Meeting meeting = meetingRepository.findById(meetingId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Meeting not found"));

        // Verify user is a member of the meeting's project
        UUID projectId = meeting.getProject().getId();
        boolean isProjectMember = meeting.getProject().getOwner().getId().equals(userId)
            || projectMemberRepository.findMemberRole(projectId, userId).isPresent();
        if (!isProjectMember) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "User is not a member of this project");
        }

        return meetingMemberRepository.findByMeetingId(meetingId)
            .stream()
            .map(MeetingMember::getUser)
            .collect(Collectors.toList());
    }

    /**
     * Convert Meeting entity to DTO
     */
    private MeetingDTO convertToDTO(Meeting meeting) {
        List<User> members = meetingMemberRepository.findByMeetingId(meeting.getId())
            .stream()
            .map(MeetingMember::getUser)
            .collect(Collectors.toList());

        return MeetingDTO.builder()
            .id(meeting.getId())
            .projectId(meeting.getProject().getId())
            .projectName(meeting.getProject().getName())
            .title(meeting.getTitle())
            .description(meeting.getDescription())
            .meetingDate(meeting.getMeetingDate())
            .meetingTime(meeting.getMeetingTime())
            .platform(meeting.getPlatform())
            .meetingLink(meeting.getMeetingLink())
            .status(meeting.getStatus().name())
            .createdByName(meeting.getCreatedBy().getUsername())
            .createdAt(meeting.getCreatedAt())
            .members(members.stream()
                .map(u -> UserDTO.builder()
                    .id(u.getId())
                    .username(u.getUsername())
                    .email(u.getEmail())
                    .build())
                .collect(Collectors.toList()))
            .build();
    }
}
