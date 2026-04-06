package com.flowboard.service;

import com.flowboard.dto.ChangeDTO;
import com.flowboard.dto.ChangeDiffDTO;
import com.flowboard.dto.ChangeHistoryEntryDTO;
import com.flowboard.dto.ChangeImpactDTO;
import com.flowboard.entity.Change;
import com.flowboard.entity.ChangeAuditEntry;
import com.flowboard.entity.Meeting;
import com.flowboard.entity.Project;
import com.flowboard.entity.User;
import com.flowboard.repository.ChangeAuditEntryRepository;
import com.flowboard.repository.ChangeRepository;
import com.flowboard.repository.MeetingMemberRepository;
import com.flowboard.repository.ProjectMemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangePreviewServiceUserStory3Test {

    @Mock
    private ChangeRepository changeRepository;

    @Mock
    private ChangeAuditEntryRepository changeAuditEntryRepository;

    @Mock
    private MeetingMemberRepository meetingMemberRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    private ChangePreviewService service;

    private UUID userId;
    private UUID projectId;
    private UUID meetingId;
    private UUID changeId;
    private User owner;
    private Project project;
    private Meeting meeting;
    private Change change;

    @BeforeEach
    void setUp() {
        service = new ChangePreviewService(
            changeRepository,
            changeAuditEntryRepository,
            meetingMemberRepository,
            projectMemberRepository
        );

        userId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        meetingId = UUID.randomUUID();
        changeId = UUID.randomUUID();

        owner = User.builder()
            .id(userId)
            .email("owner@flowboard.com")
            .username("owner")
            .passwordHash("hash")
            .role(User.UserRole.MANAGER)
            .build();

        project = Project.builder()
            .id(projectId)
            .name("U3 Project")
            .owner(owner)
            .build();

        meeting = Meeting.builder()
            .id(meetingId)
            .project(project)
            .title("U3 Review")
            .createdBy(owner)
            .build();

        change = Change.builder()
            .id(changeId)
            .meeting(meeting)
            .changeType(Change.ChangeType.DELETE_CARD)
            .beforeState("{\"id\":\"card-1\",\"title\":\"Old title\"}")
            .afterState("{\"id\":\"card-1\",\"title\":\"Removed title\"}")
            .status(Change.ChangeStatus.PENDING)
            .createdAt(LocalDateTime.parse("2026-04-05T10:00:00"))
            .build();

        lenient().when(changeRepository.findById(changeId)).thenReturn(Optional.of(change));
        lenient().when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        lenient().when(projectMemberRepository.findMemberRole(projectId, userId)).thenReturn(Optional.of("owner"));
    }

    @Test
    void listChanges_returnsMeetingScopedChangesForValidStatus() {
        when(changeRepository.findByMeetingIdAndStatus(meetingId, Change.ChangeStatus.PENDING)).thenReturn(List.of(change));

        List<ChangeDTO> result = service.listChanges(meetingId, null, "pending", userId);

        assertEquals(1, result.size());
        assertEquals(changeId, result.get(0).getId());
        assertEquals(meetingId, result.get(0).getMeetingId());
        assertEquals("DELETE_CARD", result.get(0).getChangeType());
        verify(changeRepository).findByMeetingIdAndStatus(meetingId, Change.ChangeStatus.PENDING);
    }

    @Test
    void listChanges_returnsProjectScopedChangesForValidStatus() {
        when(changeRepository.findByMeetingProjectIdAndStatus(projectId, Change.ChangeStatus.PENDING)).thenReturn(List.of(change));

        List<ChangeDTO> result = service.listChanges(null, projectId, "PENDING", userId);

        assertEquals(1, result.size());
        assertEquals(changeId, result.get(0).getId());
        verify(changeRepository).findByMeetingProjectIdAndStatus(projectId, Change.ChangeStatus.PENDING);
    }

    @Test
    void listChanges_returnsMeetingScopedChangesWithoutStatusFilter() {
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(List.of(change));

        List<ChangeDTO> result = service.listChanges(meetingId, null, "   ", userId);

        assertEquals(1, result.size());
        assertEquals(changeId, result.get(0).getId());
        verify(changeRepository).findByMeetingId(meetingId);
    }

    @Test
    void listChanges_filtersAccessibleProjectChangesWhenFilteringByStatusOnly() {
        Project otherProject = Project.builder()
            .id(UUID.randomUUID())
            .name("Other project")
            .owner(User.builder().id(UUID.randomUUID()).username("other-owner").email("other@example.com").passwordHash("hash").role(User.UserRole.MANAGER).build())
            .build();
        Meeting otherMeeting = Meeting.builder()
            .id(UUID.randomUUID())
            .project(otherProject)
            .title("Other meeting")
            .createdBy(otherProject.getOwner())
            .build();
        Change otherChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(otherMeeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .beforeState("{\"id\":\"card-2\"}")
            .afterState("{\"id\":\"card-2\"}")
            .status(Change.ChangeStatus.PENDING)
            .createdAt(LocalDateTime.parse("2026-04-05T11:00:00"))
            .build();

        when(changeRepository.findByStatus(Change.ChangeStatus.PENDING)).thenReturn(List.of(change, otherChange));
        when(projectMemberRepository.findMemberRole(projectId, userId)).thenReturn(Optional.of("owner"));
        when(projectMemberRepository.findMemberRole(otherProject.getId(), userId)).thenReturn(Optional.empty());

        List<ChangeDTO> result = service.listChanges(null, null, "pending", userId);

        assertEquals(1, result.size());
        assertEquals(changeId, result.get(0).getId());
        verify(changeRepository).findByStatus(Change.ChangeStatus.PENDING);
    }

    @Test
    void listChanges_rejectsInvalidStatus() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.listChanges(meetingId, null, "not-a-real-status", userId)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Invalid status"));
    }

    @Test
    void getChange_throwsWhenChangeMissing() {
        when(changeRepository.findById(changeId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.getChange(changeId, userId)
        );

        assertEquals(404, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Change not found"));
    }

    @Test
    void getChange_forbidsUsersWithoutMeetingAccess() {
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.getChange(changeId, userId)
        );

        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void getDiffAndImpact_mapDeletionSpecificInformation() {
        ChangeDiffDTO diff = service.getDiff(changeId, userId);
        ChangeImpactDTO impact = service.getImpact(changeId, userId);

        assertEquals("{\"id\":\"card-1\",\"title\":\"Old title\"}", diff.getBeforeState());
        assertEquals("{\"id\":\"card-1\",\"title\":\"Removed title\"}", diff.getAfterState());
        assertEquals("Existing card was proposed for deletion", diff.getSummary());

        assertEquals("HIGH", impact.getRiskLevel());
        assertEquals(List.of("card-referenced-in-after-state"), impact.getAffectedCards());
        assertTrue(impact.getPotentialConflicts().isEmpty());
    }

    @Test
    void getDiffAndImpact_coverOtherChangeTypeBranches() {
        Change moveChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.MOVE_CARD)
            .beforeState("{\"id\":\"card-1\"}")
            .afterState("{\"id\":\"card-1\",\"stageId\":\"stage-1\"}")
            .status(Change.ChangeStatus.PENDING)
            .build();
        Change updateChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .beforeState("{\"id\":\"card-1\"}")
            .afterState("{\"id\":\"card-1\"}")
            .status(Change.ChangeStatus.PENDING)
            .build();
        Change createChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .beforeState(null)
            .afterState("{\"id\":\"card-1\"}")
            .status(Change.ChangeStatus.PENDING)
            .build();

        when(changeRepository.findById(moveChange.getId())).thenReturn(Optional.of(moveChange));
        when(changeRepository.findById(updateChange.getId())).thenReturn(Optional.of(updateChange));
        when(changeRepository.findById(createChange.getId())).thenReturn(Optional.of(createChange));

        ChangeDiffDTO moveDiff = service.getDiff(moveChange.getId(), userId);
        ChangeDiffDTO updateDiff = service.getDiff(updateChange.getId(), userId);
        ChangeDiffDTO createDiff = service.getDiff(createChange.getId(), userId);

        ChangeImpactDTO moveImpact = service.getImpact(moveChange.getId(), userId);
        ChangeImpactDTO updateImpact = service.getImpact(updateChange.getId(), userId);
        ChangeImpactDTO createImpact = service.getImpact(createChange.getId(), userId);

        assertEquals("Card moved between workflow columns", moveDiff.getSummary());
        assertEquals("Card fields were updated", updateDiff.getSummary());
        assertEquals("New card was proposed", createDiff.getSummary());
        assertEquals("LOW", moveImpact.getRiskLevel());
        assertEquals("MEDIUM", updateImpact.getRiskLevel());
        assertEquals("LOW", createImpact.getRiskLevel());
    }

    @Test
    void getImpact_returnsUnknownCardWhenNoStateContainsAnId() {
        Change emptyChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .beforeState("{}")
            .afterState("{}")
            .status(Change.ChangeStatus.PENDING)
            .build();

        when(changeRepository.findById(emptyChange.getId())).thenReturn(Optional.of(emptyChange));

        ChangeImpactDTO impact = service.getImpact(emptyChange.getId(), userId);

        assertEquals(List.of("unknown"), impact.getAffectedCards());
    }

    @Test
    void getImpact_usesBeforeStateCardWhenAfterStateHasNoId() {
        Change beforeOnlyChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .beforeState("{\"id\":\"card-42\"}")
            .afterState("{}")
            .status(Change.ChangeStatus.PENDING)
            .build();

        when(changeRepository.findById(beforeOnlyChange.getId())).thenReturn(Optional.of(beforeOnlyChange));

        ChangeImpactDTO impact = service.getImpact(beforeOnlyChange.getId(), userId);

        assertEquals(List.of("card-referenced-in-before-state"), impact.getAffectedCards());
    }

    @Test
    void getHistory_mapsAuditEntriesAndActorDetails() {
        User actor = User.builder()
            .id(UUID.randomUUID())
            .email("reviewer@flowboard.com")
            .username("reviewer")
            .passwordHash("hash")
            .role(User.UserRole.MEMBER)
            .build();

        ChangeAuditEntry entry = ChangeAuditEntry.builder()
            .id(UUID.randomUUID())
            .change(change)
            .action(ChangeAuditEntry.AuditAction.APPROVED)
            .actor(actor)
            .details("{\"decision\":\"APPROVE\"}")
            .createdAt(LocalDateTime.parse("2026-04-05T10:10:00"))
            .build();

        when(changeAuditEntryRepository.findByChangeIdOrderByCreatedAtDesc(changeId)).thenReturn(List.of(entry));

        List<ChangeHistoryEntryDTO> result = service.getHistory(changeId, userId);

        assertEquals(1, result.size());
        assertEquals(entry.getId(), result.get(0).getId());
        assertEquals("APPROVED", result.get(0).getAction());
        assertEquals(actor.getId(), result.get(0).getActorId());
        assertEquals(actor.getUsername(), result.get(0).getActorName());
        assertEquals(entry.getDetails(), result.get(0).getDetails());
        assertEquals(entry.getCreatedAt(), result.get(0).getCreatedAt());
    }

    @Test
    void getHistory_handlesAuditEntriesWithoutActor() {
        ChangeAuditEntry entry = ChangeAuditEntry.builder()
            .id(UUID.randomUUID())
            .change(change)
            .action(ChangeAuditEntry.AuditAction.VIEWED)
            .actor(null)
            .details("{\"event\":\"viewed\"}")
            .createdAt(LocalDateTime.parse("2026-04-05T10:20:00"))
            .build();

        when(changeAuditEntryRepository.findByChangeIdOrderByCreatedAtDesc(changeId)).thenReturn(List.of(entry));

        List<ChangeHistoryEntryDTO> result = service.getHistory(changeId, userId);

        assertEquals(1, result.size());
        assertNull(result.get(0).getActorId());
        assertNull(result.get(0).getActorName());
        assertEquals("VIEWED", result.get(0).getAction());
    }
}