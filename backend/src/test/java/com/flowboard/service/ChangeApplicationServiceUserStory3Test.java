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

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
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

    private Stage buildStage(UUID stageId, String title, Board owningBoard) {
        return Stage.builder()
            .id(stageId)
            .board(owningBoard)
            .position(0)
            .title(title)
            .cards(Collections.emptyList())
            .build();
    }

    private Card buildCard(UUID cardId, Stage stage) {
        return Card.builder()
            .id(cardId)
            .title("Existing Task")
            .description("Existing description")
            .priority(Card.Priority.MEDIUM)
            .position(0)
            .stage(stage)
            .build();
    }

    @SuppressWarnings("unchecked")
    private <T> T invokePrivate(String methodName, Class<?>[] parameterTypes, Object... args) {
        try {
            Method method = ChangeApplicationService.class.getDeclaredMethod(methodName, parameterTypes);
            method.setAccessible(true);
            return (T) method.invoke(service, args);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
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
    void applyChange_appliesApprovedCreateCardChange() {
        UUID stageId = UUID.randomUUID();
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.APPROVED)
            .afterState("{\"title\":\"Approved task\",\"stageId\":\"" + stageId + "\"}")
            .build();

        Stage stage = buildStage(stageId, "Ready", board);

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(stage));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
    }

    @Test
    void applyChange_appliesCreateCardWithoutStageIdUsingFirstBoardStage() {
        Stage fallbackStage = buildStage(UUID.randomUUID(), "To Do", board);
        board.setStages(List.of(fallbackStage));

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{\"title\":\"Fallback task\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of(fallbackStage));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
        assertEquals(owner, change.getAppliedBy());
    }

    @Test
    void applyChange_appliesReadyMoveCardChange() {
        UUID sourceStageId = UUID.randomUUID();
        UUID targetStageId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        Stage sourceStage = buildStage(sourceStageId, "To Do", board);
        Stage targetStage = buildStage(targetStageId, "Doing", board);
        Card card = buildCard(cardId, sourceStage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.MOVE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + cardId + "\"}")
            .afterState("{\"id\":\"" + cardId + "\",\"stageId\":\"" + targetStageId + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(card));
        when(stageRepository.findById(targetStageId)).thenReturn(Optional.of(targetStage));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
        assertEquals(targetStage, card.getStage());
    }

    @Test
    void applyChange_appliesReadyUpdateCardChange() {
        UUID stageId = UUID.randomUUID();
        UUID assigneeId = UUID.randomUUID();
        Stage originalStage = buildStage(UUID.randomUUID(), "Backlog", board);
        Stage targetStage = buildStage(stageId, "In Progress", board);
        User assignee = User.builder()
            .id(assigneeId)
            .email("assignee@flowboard.com")
            .username("assignee")
            .role(User.UserRole.MEMBER)
            .build();
        Card card = buildCard(UUID.randomUUID(), originalStage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + card.getId() + "\",\"title\":\"Old title\"}")
            .afterState("{\"id\":\"" + card.getId() + "\",\"title\":\"New title\",\"description\":null,\"priority\":\"HIGH\",\"stageId\":\"" + stageId + "\",\"assigneeId\":\"" + assigneeId + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(card.getId())).thenReturn(Optional.of(card));
        when(stageRepository.findById(stageId)).thenReturn(Optional.of(targetStage));
        when(userRepository.findById(assigneeId)).thenReturn(Optional.of(assignee));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
        assertEquals("New title", card.getTitle());
        assertNull(card.getDescription());
        assertEquals(Card.Priority.HIGH, card.getPriority());
        assertEquals(targetStage, card.getStage());
        assertEquals(assignee, card.getAssignee());
    }

    @Test
    void applyChange_updateCard_generatesFallbackTitleWhenPayloadOmitsTitle() {
        Stage stage = buildStage(UUID.randomUUID(), "Backlog", board);
        Card card = buildCard(UUID.randomUUID(), stage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + card.getId() + "\"}")
            .afterState("{\"id\":\"" + card.getId() + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(card.getId())).thenReturn(Optional.of(card));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals("Existing Task (Updated)", card.getTitle());
    }

    @Test
    void applyChange_deleteCard_usesAfterStateIdWhenBeforeStateMissingId() {
        Stage stage = buildStage(UUID.randomUUID(), "Done", board);
        Card card = buildCard(UUID.randomUUID(), stage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.DELETE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{}")
            .afterState("{\"id\":\"" + card.getId() + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(card.getId())).thenReturn(Optional.of(card));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        verify(cardRepository).delete(card);
    }

    @Test
    void applyChange_appliesReadyDeleteCardChange() {
        Stage stage = buildStage(UUID.randomUUID(), "Done", board);
        Card card = buildCard(UUID.randomUUID(), stage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.DELETE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + card.getId() + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(card.getId())).thenReturn(Optional.of(card));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
        verify(cardRepository).delete(card);
    }

    @Test
    void applyChange_allowsProjectMemberOwnerWhenCanonicalProjectOwnerIsMissing() {
        Project projectWithoutOwner = Project.builder()
            .id(UUID.randomUUID())
            .name("Fallback owner project")
            .owner(null)
            .build();
        Meeting fallbackMeeting = Meeting.builder()
            .id(UUID.randomUUID())
            .project(projectWithoutOwner)
            .title("Fallback owner meeting")
            .createdBy(owner)
            .build();
        Board fallbackBoard = Board.builder()
            .id(UUID.randomUUID())
            .name("Fallback board")
            .project(projectWithoutOwner)
            .build();
        Stage fallbackStage = buildStage(UUID.randomUUID(), "To Do", fallbackBoard);
        fallbackBoard.setStages(List.of(fallbackStage));

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(fallbackMeeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{\"title\":\"Fallback role task\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(projectWithoutOwner.getId())).thenReturn(List.of(fallbackBoard));
        when(projectMemberRepository.findMemberRole(projectWithoutOwner.getId(), owner.getId())).thenReturn(Optional.of("owner"));
        when(stageRepository.findByBoardIdOrderByPosition(fallbackBoard.getId())).thenReturn(List.of(fallbackStage));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
    }

    @Test
    void applyChange_allowsOwnerRoleWhenCanonicalOwnerIsDifferentUser() {
        User canonicalOwner = User.builder()
            .id(UUID.randomUUID())
            .email("canonical-owner@flowboard.com")
            .username("canonical-owner")
            .role(User.UserRole.MANAGER)
            .build();

        Project projectWithDifferentOwner = Project.builder()
            .id(UUID.randomUUID())
            .name("Different owner project")
            .owner(canonicalOwner)
            .build();
        Meeting meetingWithDifferentOwner = Meeting.builder()
            .id(UUID.randomUUID())
            .project(projectWithDifferentOwner)
            .title("Owner role fallback")
            .createdBy(canonicalOwner)
            .build();
        Board boardForDifferentOwner = Board.builder()
            .id(UUID.randomUUID())
            .name("Owner role board")
            .project(projectWithDifferentOwner)
            .build();
        Stage stage = buildStage(UUID.randomUUID(), "To Do", boardForDifferentOwner);
        boardForDifferentOwner.setStages(List.of(stage));

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meetingWithDifferentOwner)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{\"title\":\"Owner role applies\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(projectWithDifferentOwner.getId())).thenReturn(List.of(boardForDifferentOwner));
        when(projectMemberRepository.findMemberRole(projectWithDifferentOwner.getId(), owner.getId())).thenReturn(Optional.of("owner"));
        when(stageRepository.findByBoardIdOrderByPosition(boardForDifferentOwner.getId())).thenReturn(List.of(stage));
        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangeApplyResultDTO result = service.applyChange(change.getId(), owner);

        assertTrue(result.isApplied());
        assertEquals(Change.ChangeStatus.APPLIED, change.getStatus());
    }

    @Test
    void applyChange_rejectsNonOwnerProjectMember() {
        Project projectWithoutOwner = Project.builder()
            .id(UUID.randomUUID())
            .name("Restricted project")
            .owner(null)
            .build();
        Meeting fallbackMeeting = Meeting.builder()
            .id(UUID.randomUUID())
            .project(projectWithoutOwner)
            .title("Restricted meeting")
            .createdBy(owner)
            .build();
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(fallbackMeeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{\"title\":\"Not allowed\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(projectMemberRepository.findMemberRole(projectWithoutOwner.getId(), owner.getId())).thenReturn(Optional.of("viewer"));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(403, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Only the project owner"));
    }

    @Test
    void applyChange_forbidsUserWhenProjectOwnerMissingAndUserIsNotMember() {
        Project projectWithoutOwner = Project.builder()
            .id(UUID.randomUUID())
            .name("No member project")
            .owner(null)
            .build();
        Meeting fallbackMeeting = Meeting.builder()
            .id(UUID.randomUUID())
            .project(projectWithoutOwner)
            .title("No member meeting")
            .createdBy(owner)
            .build();
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(fallbackMeeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{\"title\":\"Not a member\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(projectMemberRepository.findMemberRole(projectWithoutOwner.getId(), owner.getId())).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(403, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("project member"));
    }

    @Test
    void applyChange_rollsBackWhenApplicationFails() {
        UUID stageId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        Stage originalStage = buildStage(UUID.randomUUID(), "Backlog", board);
        Card card = buildCard(cardId, originalStage);
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + cardId + "\"}")
            .afterState("{\"id\":\"" + cardId + "\",\"stageId\":\"" + stageId + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(card));
        when(stageRepository.findById(stageId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertEquals(Change.ChangeStatus.ROLLED_BACK, change.getStatus());
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
    void applyChange_throwsWhenChangeMissing() {
        UUID missingChangeId = UUID.randomUUID();
        when(changeRepository.findById(missingChangeId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(missingChangeId, owner)
        );

        assertEquals(404, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Change not found"));
    }

    @Test
    void applyChange_throwsWhenCreateCardCannotResolveAnyStage() {
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.CREATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .afterState("{}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("could not resolve stage"));
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
    void applyChange_throwsWhenMoveCardTargetStageMissing() {
        UUID targetStageId = UUID.randomUUID();
        UUID cardId = UUID.randomUUID();
        Stage sourceStage = buildStage(UUID.randomUUID(), "To Do", board);
        Card card = buildCard(cardId, sourceStage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.MOVE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + cardId + "\"}")
            .afterState("{\"id\":\"" + cardId + "\",\"stageId\":\"" + targetStageId + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(cardId)).thenReturn(Optional.of(card));
        when(stageRepository.findById(targetStageId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Stage not found"));
    }

    @Test
    void applyChange_throwsWhenUpdateCardAssigneeMissing() {
        UUID assigneeId = UUID.randomUUID();
        Stage stage = buildStage(UUID.randomUUID(), "Backlog", board);
        Card card = buildCard(UUID.randomUUID(), stage);

        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .status(Change.ChangeStatus.READY_FOR_APPLICATION)
            .beforeState("{\"id\":\"" + card.getId() + "\"}")
            .afterState("{\"id\":\"" + card.getId() + "\",\"assigneeId\":\"" + assigneeId + "\"}")
            .build();

        when(changeRepository.findById(change.getId())).thenReturn(Optional.of(change));
        when(boardRepository.findByProjectId(project.getId())).thenReturn(List.of(board));
        when(cardRepository.findById(card.getId())).thenReturn(Optional.of(card));
        when(userRepository.findById(assigneeId)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.applyChange(change.getId(), owner)
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Assignee not found"));
    }

    @Test
    void applyChange_throwsWhenDeletePayloadMissingRequiredIdentifier() {
        Change change = Change.builder()
            .id(UUID.randomUUID())
            .meeting(meeting)
            .changeType(Change.ChangeType.DELETE_CARD)
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
        assertTrue(ex.getReason().contains("missing required card identifier"));
    }

    @Test
    void helper_findAnyCardOnBoard_returnsFirstCardFromFirstNonEmptyStage() {
        Stage firstStage = buildStage(UUID.randomUUID(), "First", board);
        Stage secondStage = buildStage(UUID.randomUUID(), "Second", board);
        Card firstCard = buildCard(UUID.randomUUID(), secondStage);

        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of(firstStage, secondStage));
        when(cardRepository.findByStageIdOrderByPosition(firstStage.getId())).thenReturn(List.of());
        when(cardRepository.findByStageIdOrderByPosition(secondStage.getId())).thenReturn(List.of(firstCard));

        Card resolved = invokePrivate(
            "findAnyCardOnBoard",
            new Class<?>[]{Board.class},
            board
        );

        assertEquals(firstCard, resolved);
    }

    @Test
    void helper_findAnyCardOnBoard_returnsNullWhenBoardHasNoCards() {
        Stage firstStage = buildStage(UUID.randomUUID(), "First", board);
        Stage secondStage = buildStage(UUID.randomUUID(), "Second", board);

        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of(firstStage, secondStage));
        when(cardRepository.findByStageIdOrderByPosition(firstStage.getId())).thenReturn(List.of());
        when(cardRepository.findByStageIdOrderByPosition(secondStage.getId())).thenReturn(List.of());

        Card resolved = invokePrivate(
            "findAnyCardOnBoard",
            new Class<?>[]{Board.class},
            board
        );

        assertNull(resolved);
    }

    @Test
    void helper_findMoveTargetStage_coversSelectionBranches() {
        Stage stageA = buildStage(UUID.randomUUID(), "A", board);
        Stage stageB = buildStage(UUID.randomUUID(), "B", board);

        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of(stageA, stageB));
        Stage targetForCurrentA = invokePrivate(
            "findMoveTargetStage",
            new Class<?>[]{Board.class, Stage.class},
            board,
            stageA
        );
        Stage targetForNullCurrent = invokePrivate(
            "findMoveTargetStage",
            new Class<?>[]{Board.class, Stage.class},
            board,
            null
        );

        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of(stageA));
        Stage targetWhenOnlyCurrentExists = invokePrivate(
            "findMoveTargetStage",
            new Class<?>[]{Board.class, Stage.class},
            board,
            stageA
        );

        when(stageRepository.findByBoardIdOrderByPosition(board.getId())).thenReturn(List.of());
        Stage targetWhenNoStages = invokePrivate(
            "findMoveTargetStage",
            new Class<?>[]{Board.class, Stage.class},
            board,
            stageA
        );

        assertEquals(stageB, targetForCurrentA);
        assertEquals(stageA, targetForNullCurrent);
        assertEquals(stageA, targetWhenOnlyCurrentExists);
        assertNull(targetWhenNoStages);
    }

    @Test
    void helper_createFallbackCard_setsPositionFromExistingCardsAndNullCards() {
        Stage populatedStage = Stage.builder()
            .id(UUID.randomUUID())
            .board(board)
            .position(0)
            .title("Populated")
            .cards(List.of(
                buildCard(UUID.randomUUID(), null),
                buildCard(UUID.randomUUID(), null)
            ))
            .build();

        Stage emptyStage = Stage.builder()
            .id(UUID.randomUUID())
            .board(board)
            .position(1)
            .title("Empty")
            .cards(null)
            .build();

        when(cardRepository.save(any(Card.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Card createdWithExisting = invokePrivate(
            "createFallbackCard",
            new Class<?>[]{Stage.class, String.class},
            populatedStage,
            "Created title"
        );

        Card createdWithNullCards = invokePrivate(
            "createFallbackCard",
            new Class<?>[]{Stage.class, String.class},
            emptyStage,
            "Created title 2"
        );

        assertEquals(2, createdWithExisting.getPosition());
        assertEquals(populatedStage, createdWithExisting.getStage());
        assertEquals(0, createdWithNullCards.getPosition());
        assertEquals(emptyStage, createdWithNullCards.getStage());
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
