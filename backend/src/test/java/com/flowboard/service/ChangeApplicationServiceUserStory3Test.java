package com.flowboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.ChangeApplyResultDTO;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeApplicationServiceUserStory3Test {

    @Mock
    private ChangeRepository changeRepository;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private StageRepository stageRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @Mock
    private ChangeSnapshotRepository changeSnapshotRepository;

    @Mock
    private ChangeAuditEntryRepository changeAuditEntryRepository;

    private ChangeApplicationService service;

    private User owner;
    private Project project;
    private Meeting meeting;
    private Board board;

    @BeforeEach
    void setUp() {
        service = new ChangeApplicationService(
            changeRepository,
            boardRepository,
            stageRepository,
            cardRepository,
            userRepository,
            projectMemberRepository,
            changeSnapshotRepository,
            changeAuditEntryRepository,
            new ObjectMapper()
        );

        owner = User.builder()
            .id(UUID.randomUUID())
            .email("owner@flowboard.com")
            .username("owner")
            .role(User.UserRole.MANAGER)
            .build();

        project = Project.builder()
            .id(UUID.randomUUID())
            .name("U3 Project")
            .owner(owner)
            .build();

        meeting = Meeting.builder()
            .id(UUID.randomUUID())
            .project(project)
            .title("Review changes")
            .createdBy(owner)
            .build();

        board = Board.builder()
            .id(UUID.randomUUID())
            .name("Main board")
            .project(project)
            .build();

        lenient().when(changeRepository.save(any(Change.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(changeSnapshotRepository.save(any(ChangeSnapshot.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(changeAuditEntryRepository.save(any(ChangeAuditEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void applyChange_appliesReadyCreateCardChange() {
        UUID stageId = UUID.randomUUID();
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{\"title\":\"New Task\",\"stageId\":\"" + stageId + "\"}")
            .build();

        Stage stage = Stage.builder()
            .id(stageId)
            .board(board)
            .position(0)
            .title("To Do")
            .cards(Collections.emptyList())
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(stage));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals("APPLIED", result.getStatus());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
        assertEquals(owner, change.getAppliedBy());
    }

    @Test
    void applyChange_throwsWhenBoardMissing() {
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(404, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Board not found"));
    }

    @Test
    void applyChange_throwsWhenMovePayloadMissingRequiredIdentifiers() {
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.MOVE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{}")
            .afterState("{}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("missing required card/stage identifiers"));
    }

    @Test
    void applyChange_rejectsPendingChangeUntilApprovalWorkflowCompletes() {
        UUID stageId = UUID.randomUUID();
        Change pendingChange = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.PENDING)
            .afterState("{\"title\":\"Premature apply\",\"stageId\":\"" + stageId + "\"}")
            .build();

        when(changeRepository.findById(pendingChange.getId())).thenReturn(Optional.of(pendingChange));

        // Regression guard: pending changes must not bypass approval gating.
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(pendingChange.getId(), owner)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("not ready for application"));
    }
}
