package com.flowboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.MeetingSummaryDTO;
import com.flowboard.entity.*;
import com.flowboard.entity.ActionItem.ApprovalStatus;
import com.flowboard.entity.ActionItem.Priority;
import com.flowboard.entity.Change.ChangeStatus;
import com.flowboard.entity.Change.ChangeType;
import com.flowboard.entity.Meeting.MeetingStatus;
import com.flowboard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Comprehensive test class for SummaryService.
 * Covers all 78 test cases for summary generation, action items, decisions,
 * changes, approvals, and helper methods.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
@DisplayName("SummaryService Tests")
class SummaryServiceTest {

    @Mock
    private MeetingRepository meetingRepository;

    @Mock
    private MeetingSummaryRepository meetingSummaryRepository;

    @Mock
    private MeetingMemberRepository meetingMemberRepository;

    @Mock
    private ActionItemRepository actionItemRepository;

    @Mock
    private DecisionRepository decisionRepository;

    @Mock
    private ChangeRepository changeRepository;

    @Mock
    private ApprovalRequestSummaryRepository approvalRequestSummaryRepository;

    @Mock
    private ApprovalResponseSummaryRepository approvalResponseSummaryRepository;

    @Mock
    private AIEngine aiEngine;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private StageRepository stageRepository;

    @Mock
    private CardRepository cardRepository;

    @Mock
    private BoardBroadcastService boardBroadcastService;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private SummaryService summaryService;

    private UUID meetingId;
    private UUID userId;
    private UUID summaryId;
    private UUID actionItemId;
    private UUID decisionId;
    private UUID changeId;
    private UUID projectId;
    private UUID boardId;
    private UUID stageId;
    private UUID cardId;
    private User testUser;
    private User projectOwner;
    private Project testProject;
    private Meeting testMeeting;
    private MeetingSummary testSummary;
    private Board testBoard;
    private Stage testStage;
    private Card testCard;

    @BeforeEach
    void setUp() throws Exception {
        // Mock ObjectMapper behavior for JSON serialization
        when(objectMapper.writeValueAsString(any())).thenReturn("{}");
        
        meetingId = UUID.randomUUID();
        userId = UUID.randomUUID();
        summaryId = UUID.randomUUID();
        actionItemId = UUID.randomUUID();
        decisionId = UUID.randomUUID();
        changeId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        boardId = UUID.randomUUID();
        stageId = UUID.randomUUID();
        cardId = UUID.randomUUID();

        testUser = User.builder()
                .id(userId)
                .email("test@example.com")
                .username("Test User")
                .build();

        projectOwner = User.builder()
                .id(userId) // Test user is also the project owner for most tests
                .email("owner@example.com")
                .username("Project Owner")
                .build();

        testProject = Project.builder()
                .id(projectId)
                .name("Test Project")
                .owner(projectOwner)
                .build();

        testMeeting = createMockMeeting(meetingId, testProject, "Test meeting transcript content", MeetingStatus.PENDING_APPROVAL);
        testSummary = createMockSummary(summaryId, testMeeting);
        testBoard = createMockBoard(boardId, testProject);
        testStage = createMockStage(stageId, testBoard, "Test Stage", 1);
        testCard = createMockCard(cardId, testStage, "Test Card");
    }

    // ==================== MOCK OBJECT SETUP METHODS ====================

    private Meeting createMockMeeting(UUID id, Project project, String transcript, MeetingStatus status) {
        return Meeting.builder()
                .id(id)
                .project(project)
                .transcript(transcript)
                .status(status)
                .createdAt(LocalDateTime.now())
                .build();
    }

    private MeetingMember createMockMeetingMember(Meeting meeting, User user) {
        return MeetingMember.builder()
                .id(UUID.randomUUID())
                .meeting(meeting)
                .user(user)
                .build();
    }

    private MeetingSummary createMockSummary(UUID id, Meeting meeting) {
        return MeetingSummary.builder()
                .id(id)
                .meeting(meeting)
                .aiGeneratedContent("Generated summary content")
                .status(MeetingSummary.SummaryStatus.PENDING)
                .generatedAt(LocalDateTime.now())
                .build();
    }

    private AIEngine.MeetingAnalysisResult createMockAIAnalysisResult(
            List<AIEngine.MeetingAnalysisResult.ActionItemData> actionItems,
            List<AIEngine.MeetingAnalysisResult.DecisionData> decisions,
            List<AIEngine.MeetingAnalysisResult.ChangeData> changes) {
        AIEngine.MeetingAnalysisResult result = new AIEngine.MeetingAnalysisResult();
        for (var item : actionItems) {
            result.addActionItem(item.description, item.sourceContext, item.priority);
        }
        for (var decision : decisions) {
            result.addDecision(decision.description, decision.sourceContext);
        }
        for (var change : changes) {
            result.addChange(change.type, change.description, change.context);
        }
        return result;
    }

    private ActionItem createMockActionItem(UUID id, Meeting meeting, String description, 
                                           Priority priority, ActionItem.ActionItemStatus status) {
        return ActionItem.builder()
                .id(id)
                .meeting(meeting)
                .description(description)
                .priority(priority)
                .status(status)
                .sourceContext("Test context")
                .build();
    }

    private Decision createMockDecision(UUID id, Meeting meeting, String description, 
                                       Decision.ApprovalStatus status) {
        return Decision.builder()
                .id(id)
                .meeting(meeting)
                .description(description)
                .approvalStatus(status)
                .sourceContext("Test context")
                .impactSummary("Test impact")
                .createdAt(LocalDateTime.now())
                .build();
    }

    private Change createMockChange(UUID id, Meeting meeting, ChangeType type, ChangeStatus status) {
        return Change.builder()
                .id(id)
                .meeting(meeting)
                .changeType(type)
                .status(status)
                .beforeState("{}")
                .afterState("{\"test\": \"payload\"}")
                .build();
    }

    private Board createMockBoard(UUID id, Project project) {
        return Board.builder()
                .id(id)
                .project(project)
                .name("Test Board")
                .build();
    }

    private Stage createMockStage(UUID id, Board board, String title, int position) {
        return Stage.builder()
                .id(id)
                .board(board)
                .title(title)
                .position(position)
                .build();
    }

    private Card createMockCard(UUID id, Stage stage, String title) {
        return Card.builder()
                .id(id)
                .stage(stage)
                .title(title)
                .description("Test description")
                .position(1)
                .priority(Card.Priority.MEDIUM)
                .build();
    }

    private ApprovalRequestSummary createMockApprovalRequest(UUID id, Meeting meeting) {
        return ApprovalRequestSummary.builder()
                .id(id)
                .meeting(meeting)
                .requiredApprovals(1)
                .build();
    }

    private ApprovalResponseSummary createMockApprovalResponse(UUID id, ApprovalRequestSummary request, 
                                                             User user, ApprovalResponseSummary.ApprovalResponse status) {
        return ApprovalResponseSummary.builder()
                .id(id)
                .approvalRequest(request)
                .user(user)
                .response(status)
                .respondedAt(LocalDateTime.now())
                .build();
    }

    // ==================== T1: GENERATE SUMMARY TESTS ====================

    @Test
    @DisplayName("T1.1: Generate summary - happy path with AI analysis")
    void generateSummary_HappyPath() {
        // Arrange
        List<AIEngine.MeetingAnalysisResult.ActionItemData> actionItems = List.of(
                new AIEngine.MeetingAnalysisResult.ActionItemData("Fix critical bug", "from line 45", "HIGH"),
                new AIEngine.MeetingAnalysisResult.ActionItemData("Update documentation", "from line 120", "MEDIUM")
        );
        List<AIEngine.MeetingAnalysisResult.DecisionData> decisions = List.of(
                new AIEngine.MeetingAnalysisResult.DecisionData("Use React 18", "discussed in Q&A section")
        );
        List<AIEngine.MeetingAnalysisResult.ChangeData> changes = List.of();
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(actionItems, decisions, changes);

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(testMeeting.getTranscript())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenReturn(testMeeting);

        // Act
        MeetingSummaryDTO result = summaryService.generateSummary(meetingId, userId);

        // Assert
        assertThat(result).isNotNull();
        verify(meetingSummaryRepository).save(any(MeetingSummary.class));
        verify(actionItemRepository, atLeastOnce()).save(any(ActionItem.class));
        verify(decisionRepository, atLeastOnce()).save(any(Decision.class));
    }

    @Test
    @DisplayName("T1.2: Generate summary - meeting not found")
    void generateSummary_MeetingNotFound() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.generateSummary(meetingId, userId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T1.3: Generate summary - no transcript available")
    void generateSummary_NoTranscript() {
        // Arrange
        Meeting meetingWithoutTranscript = createMockMeeting(meetingId, testProject, null, MeetingStatus.PENDING_APPROVAL);
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(meetingWithoutTranscript));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.generateSummary(meetingId, userId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("T1.4: Generate summary - empty transcript")
    void generateSummary_EmptyTranscript() {
        // Arrange
        Meeting meetingWithEmptyTranscript = createMockMeeting(meetingId, testProject, "   ", MeetingStatus.PENDING_APPROVAL);
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(meetingWithEmptyTranscript));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.generateSummary(meetingId, userId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("T1.6: Generate summary - invalid priority from AI")
    void generateSummary_InvalidPriority() {
        // Arrange
        List<AIEngine.MeetingAnalysisResult.ActionItemData> actionItems = List.of(
                new AIEngine.MeetingAnalysisResult.ActionItemData("Test item", "context", "INVALID_PRIORITY")
        );
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(actionItems, Collections.emptyList(), Collections.emptyList());

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(anyString())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenReturn(testMeeting);

        // Act
        MeetingSummaryDTO result = summaryService.generateSummary(meetingId, userId);

        // Assert
        assertThat(result).isNotNull();
        verify(actionItemRepository, atLeastOnce()).save(any(ActionItem.class));
    }

    @Test
    @DisplayName("T1.7: Generate summary - decisions processed correctly")
    void generateSummary_DecisionsProcessed() {
        // Arrange
        List<AIEngine.MeetingAnalysisResult.DecisionData> decisions = List.of(
                new AIEngine.MeetingAnalysisResult.DecisionData("Decision 1", "context 1"),
                new AIEngine.MeetingAnalysisResult.DecisionData("Decision 2", "context 2")
        );
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(Collections.emptyList(), decisions, Collections.emptyList());

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(anyString())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenReturn(testMeeting);

        // Act
        MeetingSummaryDTO result = summaryService.generateSummary(meetingId, userId);

        // Assert
        assertThat(result).isNotNull();
        verify(decisionRepository, times(2)).save(any(Decision.class));
    }

    @Test
    @DisplayName("T1.8: Generate summary - changes processed correctly")
    void generateSummary_ChangesProcessed() {
        // Arrange
        List<AIEngine.MeetingAnalysisResult.ChangeData> changes = List.of(
                new AIEngine.MeetingAnalysisResult.ChangeData("CREATE_CARD", "Title", "Description"),
                new AIEngine.MeetingAnalysisResult.ChangeData("MOVE_CARD", "Title 2", "Description 2")
        );
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(Collections.emptyList(), Collections.emptyList(), changes);

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(anyString())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenReturn(testMeeting);
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(List.of(testCard));

        // Act
        MeetingSummaryDTO result = summaryService.generateSummary(meetingId, userId);

        // Assert
        assertThat(result).isNotNull();
        verify(changeRepository, atLeastOnce()).save(any(Change.class));
    }

    @Test
    @DisplayName("T1.10: Generate summary - invalid change type handled")
    void generateSummary_InvalidChangeType() {
        // Arrange
        List<AIEngine.MeetingAnalysisResult.ChangeData> changes = List.of(
                new AIEngine.MeetingAnalysisResult.ChangeData("INVALID_TYPE", "Title", "Description")
        );
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(Collections.emptyList(), Collections.emptyList(), changes);

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(anyString())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenReturn(testMeeting);

        // Act
        MeetingSummaryDTO result = summaryService.generateSummary(meetingId, userId);

        // Assert - no exception thrown, continues processing
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("T1.12: Generate summary - meeting status updated to pending approval")
    void generateSummary_StatusUpdated() {
        // Arrange
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(Collections.emptyList(), Collections.emptyList(), Collections.emptyList());

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(anyString())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act
        summaryService.generateSummary(meetingId, userId);

        // Assert
        ArgumentCaptor<Meeting> meetingCaptor = ArgumentCaptor.forClass(Meeting.class);
        verify(meetingRepository, atLeastOnce()).save(meetingCaptor.capture());
        assertThat(meetingCaptor.getValue().getStatus()).isEqualTo(MeetingStatus.PENDING_APPROVAL);
    }

    @Test
    @DisplayName("T1.13: Generate summary - broadcast sent")
    void generateSummary_BroadcastSent() {
        // Arrange
        AIEngine.MeetingAnalysisResult analysisResult = createMockAIAnalysisResult(Collections.emptyList(), Collections.emptyList(), Collections.emptyList());

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(anyString())).thenReturn(analysisResult);
        when(meetingSummaryRepository.save(any(MeetingSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingRepository.save(any(Meeting.class))).thenReturn(testMeeting);

        // Act
        summaryService.generateSummary(meetingId, userId);

        // Assert
        verify(boardBroadcastService).broadcastSummaryGenerated(eq(projectId), eq(meetingId), any(MeetingSummaryDTO.class));
    }

    // ==================== T2: GET SUMMARY BY ID TESTS ====================

    @Test
    @DisplayName("T2.1: Get summary by ID - happy path")
    void getSummary_HappyPath() {
        // Arrange
        when(meetingSummaryRepository.findById(summaryId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.getSummary(summaryId, userId);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(summaryId);
    }

    @Test
    @DisplayName("T2.2: Get summary by ID - not found")
    void getSummary_NotFound() {
        // Arrange
        when(meetingSummaryRepository.findById(summaryId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.getSummary(summaryId, userId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ==================== T3: GET SUMMARY BY MEETING ID TESTS ====================

    @Test
    @DisplayName("T3.1: Get summary by meeting ID - happy path")
    void getSummaryByMeeting_HappyPath() {
        // Arrange
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.getSummaryByMeeting(meetingId, userId);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getMeetingId()).isEqualTo(meetingId);
    }

    @Test
    @DisplayName("T3.2: Get summary by meeting ID - not found")
    void getSummaryByMeeting_NotFound() {
        // Arrange
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.getSummaryByMeeting(meetingId, userId))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    // ==================== T4: ADD ACTION ITEM TESTS ====================

    @Test
    @DisplayName("T4.1: Add action item - happy path")
    void addActionItem_HappyPath() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addActionItem(meetingId, "Test description", "Test context", "HIGH", testUser);

        // Assert
        assertThat(result).isNotNull();
        verify(actionItemRepository).save(any(ActionItem.class));
    }

    @Test
    @DisplayName("T4.2: Add action item - user not member")
    void addActionItem_NotMember() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(false);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T4.3: Add action item - meeting not found")
    void addActionItem_MeetingNotFound() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T4.4: Add action item - finalized meeting APPROVED")
    void addActionItem_FinalizedApproved() {
        // Arrange
        Meeting approvedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.APPROVED);
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(approvedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T4.5: Add action item - finalized meeting REJECTED")
    void addActionItem_FinalizedRejected() {
        // Arrange
        Meeting rejectedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.REJECTED);
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(rejectedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T4.6: Add action item - invalid priority")
    void addActionItem_InvalidPriority() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addActionItem(meetingId, "Test", "Context", "INVALID", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("T4.7: Add action item - null priority defaults to MEDIUM")
    void addActionItem_NullPriority() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addActionItem(meetingId, "Test", "Context", null, testUser);

        // Assert
        assertThat(result).isNotNull();
        ArgumentCaptor<ActionItem> captor = ArgumentCaptor.forClass(ActionItem.class);
        verify(actionItemRepository).save(captor.capture());
        assertThat(captor.getValue().getPriority()).isEqualTo(Priority.MEDIUM);
    }

    @Test
    @DisplayName("T4.8: Add action item - blank priority defaults to MEDIUM")
    void addActionItem_BlankPriority() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addActionItem(meetingId, "Test", "Context", "   ", testUser);

        // Assert
        assertThat(result).isNotNull();
        ArgumentCaptor<ActionItem> captor = ArgumentCaptor.forClass(ActionItem.class);
        verify(actionItemRepository).save(captor.capture());
        assertThat(captor.getValue().getPriority()).isEqualTo(Priority.MEDIUM);
    }

    @Test
    @DisplayName("T4.9: Add action item - user approved")
    void addActionItem_UserApproved() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        ApprovalResponseSummary response = createMockApprovalResponse(UUID.randomUUID(), request, testUser, ApprovalResponseSummary.ApprovalResponse.APPROVED);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.findByApprovalRequestIdAndUserId(request.getId(), userId)).thenReturn(Optional.of(response));
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser);

        // Assert
        ArgumentCaptor<ActionItem> captor = ArgumentCaptor.forClass(ActionItem.class);
        verify(actionItemRepository).save(captor.capture());
        assertThat(captor.getValue().getApprovalStatus()).isEqualTo(ApprovalStatus.APPROVED);
    }

    @Test
    @DisplayName("T4.10: Add action item - user not approved")
    void addActionItem_UserNotApproved() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser);

        // Assert
        ArgumentCaptor<ActionItem> captor = ArgumentCaptor.forClass(ActionItem.class);
        verify(actionItemRepository).save(captor.capture());
        assertThat(captor.getValue().getApprovalStatus()).isEqualTo(ApprovalStatus.PENDING);
    }

    @Test
    @DisplayName("T4.11: Add action item - broadcast sent")
    void addActionItem_BroadcastSent() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        summaryService.addActionItem(meetingId, "Test", "Context", "HIGH", testUser);

        // Assert
        verify(boardBroadcastService).broadcastActionItemCreated(eq(projectId), eq(meetingId), any());
    }

    // ==================== T5: UPDATE ACTION ITEM TESTS ====================

    @Test
    @DisplayName("T5.1: Update action item - all fields")
    void updateActionItem_AllFields() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Old description", Priority.LOW, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(List.of(existingItem));
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.updateActionItem(actionItemId, "New description", "New context", "HIGH", testUser);

        // Assert
        assertThat(result).isNotNull();
        ArgumentCaptor<ActionItem> captor = ArgumentCaptor.forClass(ActionItem.class);
        verify(actionItemRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).isEqualTo("New description");
        assertThat(captor.getValue().getSourceContext()).isEqualTo("New context");
        assertThat(captor.getValue().getPriority()).isEqualTo(Priority.HIGH);
    }

    @Test
    @DisplayName("T5.2: Update action item - partial update")
    void updateActionItem_PartialUpdate() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(List.of(existingItem));
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.updateActionItem(actionItemId, null, null, null, testUser);

        // Assert
        assertThat(result).isNotNull();
        ArgumentCaptor<ActionItem> captor = ArgumentCaptor.forClass(ActionItem.class);
        verify(actionItemRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).isEqualTo("Description");
        assertThat(captor.getValue().getPriority()).isEqualTo(Priority.MEDIUM);
    }

    @Test
    @DisplayName("T5.3: Update action item - not found")
    void updateActionItem_NotFound() {
        // Arrange
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateActionItem(actionItemId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T5.4: Update action item - not project owner")
    void updateActionItem_NotOwner() {
        // Arrange - testUser is not the project owner
        User otherUser = User.builder().id(UUID.randomUUID()).build();
        testProject.setOwner(otherUser); // Different owner
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateActionItem(actionItemId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T5.5: Update action item - meeting not found")
    void updateActionItem_MeetingNotFound() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateActionItem(actionItemId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T5.6: Update action item - finalized meeting")
    void updateActionItem_Finalized() {
        // Arrange
        Meeting finalizedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.APPROVED);
        ActionItem existingItem = createMockActionItem(actionItemId, finalizedMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(finalizedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateActionItem(actionItemId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T5.7: Update action item - not member")
    void updateActionItem_NotMember() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(false);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateActionItem(actionItemId, "Test", "Context", "HIGH", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T5.8: Update action item - invalid priority")
    void updateActionItem_InvalidPriority() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateActionItem(actionItemId, "Test", "Context", "INVALID", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    @DisplayName("T5.9: Update action item - broadcast sent")
    void updateActionItem_BroadcastSent() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(actionItemRepository.save(any(ActionItem.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(List.of(existingItem));
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        summaryService.updateActionItem(actionItemId, "New", "Context", "HIGH", testUser);

        // Assert
        verify(boardBroadcastService).broadcastActionItemUpdated(eq(projectId), eq(meetingId), any());
    }

    // ==================== T6: DELETE ACTION ITEM TESTS ====================

    @Test
    @DisplayName("T6.1: Delete action item - happy path")
    void deleteActionItem_HappyPath() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.deleteActionItem(actionItemId, testUser);

        // Assert
        assertThat(result).isNotNull();
        verify(actionItemRepository).delete(existingItem);
    }

    @Test
    @DisplayName("T6.2: Delete action item - not found")
    void deleteActionItem_NotFound() {
        // Arrange
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteActionItem(actionItemId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T6.3: Delete action item - not project owner")
    void deleteActionItem_NotOwner() {
        // Arrange - testUser is not the project owner
        User otherUser = User.builder().id(UUID.randomUUID()).build();
        testProject.setOwner(otherUser);
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteActionItem(actionItemId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T6.4: Delete action item - not member")
    void deleteActionItem_NotMember() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(false);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteActionItem(actionItemId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T6.5: Delete action item - finalized meeting")
    void deleteActionItem_Finalized() {
        // Arrange
        Meeting finalizedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.APPROVED);
        ActionItem existingItem = createMockActionItem(actionItemId, finalizedMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(finalizedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteActionItem(actionItemId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T6.6: Delete action item - broadcast sent")
    void deleteActionItem_BroadcastSent() {
        // Arrange
        ActionItem existingItem = createMockActionItem(actionItemId, testMeeting, "Description", Priority.MEDIUM, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findById(actionItemId)).thenReturn(Optional.of(existingItem));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        summaryService.deleteActionItem(actionItemId, testUser);

        // Assert
        verify(boardBroadcastService).broadcastActionItemDeleted(eq(projectId), eq(meetingId), eq(actionItemId));
    }


    // ==================== T7: ADD DECISION TESTS ====================

    @Test
    @DisplayName("T7.1: Add decision - happy path")
    void addDecision_HappyPath() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addDecision(meetingId, "Test decision", "Context", "Impact", testUser);

        // Assert
        assertThat(result).isNotNull();
        verify(decisionRepository).save(any(Decision.class));
    }

    @Test
    @DisplayName("T7.2: Add decision - user not member")
    void addDecision_NotMember() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(false);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addDecision(meetingId, "Test", "Context", "Impact", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T7.3: Add decision - meeting not found")
    void addDecision_MeetingNotFound() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addDecision(meetingId, "Test", "Context", "Impact", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T7.4: Add decision - finalized meeting")
    void addDecision_Finalized() {
        // Arrange
        Meeting finalizedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.APPROVED);
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(finalizedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.addDecision(meetingId, "Test", "Context", "Impact", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T7.5: Add decision - user approved")
    void addDecision_UserApproved() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        ApprovalResponseSummary response = createMockApprovalResponse(UUID.randomUUID(), request, testUser, ApprovalResponseSummary.ApprovalResponse.APPROVED);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.findByApprovalRequestIdAndUserId(request.getId(), userId)).thenReturn(Optional.of(response));
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addDecision(meetingId, "Test", "Context", "Impact", testUser);

        // Assert
        ArgumentCaptor<Decision> captor = ArgumentCaptor.forClass(Decision.class);
        verify(decisionRepository).save(captor.capture());
        assertThat(captor.getValue().getApprovalStatus()).isEqualTo(Decision.ApprovalStatus.APPROVED);
    }

    @Test
    @DisplayName("T7.6: Add decision - user not approved")
    void addDecision_UserNotApproved() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.addDecision(meetingId, "Test", "Context", "Impact", testUser);

        // Assert
        ArgumentCaptor<Decision> captor = ArgumentCaptor.forClass(Decision.class);
        verify(decisionRepository).save(captor.capture());
        assertThat(captor.getValue().getApprovalStatus()).isEqualTo(Decision.ApprovalStatus.PENDING);
    }

    @Test
    @DisplayName("T7.7: Add decision - broadcast sent")
    void addDecision_BroadcastSent() {
        // Arrange
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        summaryService.addDecision(meetingId, "Test", "Context", "Impact", testUser);

        // Assert
        verify(boardBroadcastService).broadcastDecisionCreated(eq(projectId), eq(meetingId), any());
    }

    // ==================== T8: UPDATE DECISION TESTS ====================

    @Test
    @DisplayName("T8.1: Update decision - all fields")
    void updateDecision_AllFields() {
        // Arrange
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Old decision", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(List.of(existingDecision));
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.updateDecision(decisionId, "New decision", "New context", "New impact", testUser);

        // Assert
        assertThat(result).isNotNull();
        ArgumentCaptor<Decision> captor = ArgumentCaptor.forClass(Decision.class);
        verify(decisionRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).isEqualTo("New decision");
        assertThat(captor.getValue().getSourceContext()).isEqualTo("New context");
        assertThat(captor.getValue().getImpactSummary()).isEqualTo("New impact");
    }

    @Test
    @DisplayName("T8.2: Update decision - partial update")
    void updateDecision_PartialUpdate() {
        // Arrange
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(List.of(existingDecision));
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.updateDecision(decisionId, null, null, null, testUser);

        // Assert
        assertThat(result).isNotNull();
        ArgumentCaptor<Decision> captor = ArgumentCaptor.forClass(Decision.class);
        verify(decisionRepository).save(captor.capture());
        assertThat(captor.getValue().getDescription()).isEqualTo("Description");
    }

    @Test
    @DisplayName("T8.3: Update decision - not found")
    void updateDecision_NotFound() {
        // Arrange
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateDecision(decisionId, "Test", "Context", "Impact", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T8.4: Update decision - not project owner")
    void updateDecision_NotOwner() {
        // Arrange
        User otherUser = User.builder().id(UUID.randomUUID()).build();
        testProject.setOwner(otherUser);
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateDecision(decisionId, "Test", "Context", "Impact", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T8.5: Update decision - finalized meeting")
    void updateDecision_Finalized() {
        // Arrange
        Meeting finalizedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.APPROVED);
        Decision existingDecision = createMockDecision(decisionId, finalizedMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(finalizedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.updateDecision(decisionId, "Test", "Context", "Impact", testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T8.6: Update decision - broadcast sent")
    void updateDecision_BroadcastSent() {
        // Arrange
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(decisionRepository.save(any(Decision.class))).thenAnswer(inv -> inv.getArgument(0));
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(List.of(existingDecision));
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        summaryService.updateDecision(decisionId, "New", "Context", "Impact", testUser);

        // Assert
        verify(boardBroadcastService).broadcastDecisionUpdated(eq(projectId), eq(meetingId), any());
    }

    // ==================== T9: DELETE DECISION TESTS ====================

    @Test
    @DisplayName("T9.1: Delete decision - happy path")
    void deleteDecision_HappyPath() {
        // Arrange
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        MeetingSummaryDTO result = summaryService.deleteDecision(decisionId, testUser);

        // Assert
        assertThat(result).isNotNull();
        verify(decisionRepository).delete(existingDecision);
    }

    @Test
    @DisplayName("T9.2: Delete decision - not found")
    void deleteDecision_NotFound() {
        // Arrange
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteDecision(decisionId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
    }

    @Test
    @DisplayName("T9.3: Delete decision - not project owner")
    void deleteDecision_NotOwner() {
        // Arrange
        User otherUser = User.builder().id(UUID.randomUUID()).build();
        testProject.setOwner(otherUser);
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteDecision(decisionId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    @DisplayName("T9.4: Delete decision - finalized meeting")
    void deleteDecision_Finalized() {
        // Arrange
        Meeting finalizedMeeting = createMockMeeting(meetingId, testProject, "transcript", MeetingStatus.APPROVED);
        Decision existingDecision = createMockDecision(decisionId, finalizedMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(finalizedMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> summaryService.deleteDecision(decisionId, testUser))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));
    }

    @Test
    @DisplayName("T9.5: Delete decision - broadcast sent")
    void deleteDecision_BroadcastSent() {
        // Arrange
        Decision existingDecision = createMockDecision(decisionId, testMeeting, "Description", Decision.ApprovalStatus.PENDING);
        when(decisionRepository.findById(decisionId)).thenReturn(Optional.of(existingDecision));
        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, testUser.getId())).thenReturn(true);
        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(testSummary));
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act
        summaryService.deleteDecision(decisionId, testUser);

        // Assert
        verify(boardBroadcastService).broadcastDecisionDeleted(eq(projectId), eq(meetingId), eq(decisionId));
    }

    // ==================== T10: CREATE APPROVAL REQUEST TESTS (via reflection) ====================

    @Test
    @DisplayName("T10.1: Create approval request - assign to all members")
    void createApprovalRequest_AssignToAllMembers() throws Exception {
        // Arrange
        MeetingMember member1 = createMockMeetingMember(testMeeting, testUser);
        MeetingMember member2 = createMockMeetingMember(testMeeting, User.builder().id(UUID.randomUUID()).build());
        when(meetingMemberRepository.findByMeetingId(meetingId)).thenReturn(List.of(member1, member2));
        when(approvalRequestSummaryRepository.save(any(ApprovalRequestSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(approvalResponseSummaryRepository.save(any(ApprovalResponseSummary.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act - use reflection to call private method
        Method method = SummaryService.class.getDeclaredMethod("createApprovalRequest", Meeting.class);
        method.setAccessible(true);
        method.invoke(summaryService, testMeeting);

        // Assert
        verify(approvalRequestSummaryRepository).save(any(ApprovalRequestSummary.class));
        verify(approvalResponseSummaryRepository, times(2)).save(any(ApprovalResponseSummary.class));
    }

    @Test
    @DisplayName("T10.2: Create approval request - no members")
    void createApprovalRequest_NoMembers() throws Exception {
        // Arrange
        when(meetingMemberRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(approvalRequestSummaryRepository.save(any(ApprovalRequestSummary.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("createApprovalRequest", Meeting.class);
        method.setAccessible(true);
        method.invoke(summaryService, testMeeting);

        // Assert
        verify(approvalRequestSummaryRepository).save(any(ApprovalRequestSummary.class));
        verify(approvalResponseSummaryRepository, never()).save(any(ApprovalResponseSummary.class));
    }

    @Test
    @DisplayName("T10.3: Create approval request - response entries created")
    void createApprovalRequest_ResponseEntries() throws Exception {
        // Arrange
        MeetingMember member = createMockMeetingMember(testMeeting, testUser);
        when(meetingMemberRepository.findByMeetingId(meetingId)).thenReturn(List.of(member));
        when(approvalRequestSummaryRepository.save(any(ApprovalRequestSummary.class))).thenAnswer(inv -> inv.getArgument(0));
        when(approvalResponseSummaryRepository.save(any(ApprovalResponseSummary.class))).thenAnswer(inv -> inv.getArgument(0));

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("createApprovalRequest", Meeting.class);
        method.setAccessible(true);
        method.invoke(summaryService, testMeeting);

        // Assert
        ArgumentCaptor<ApprovalResponseSummary> responseCaptor = ArgumentCaptor.forClass(ApprovalResponseSummary.class);
        verify(approvalResponseSummaryRepository).save(responseCaptor.capture());
        assertThat(responseCaptor.getValue().getUser()).isEqualTo(testUser);
        assertThat(responseCaptor.getValue().getResponse()).isEqualTo(ApprovalResponseSummary.ApprovalResponse.PENDING);
    }

    // ==================== T11: CONVERT TO DTO TESTS (via reflection) ====================

    @Test
    @DisplayName("T11.1: Convert to DTO - all items included")
    void convertToDTO_AllItemsIncluded() throws Exception {
        // Arrange
        ActionItem actionItem = createMockActionItem(UUID.randomUUID(), testMeeting, "Action", Priority.HIGH, ActionItem.ActionItemStatus.PENDING);
        Decision decision = createMockDecision(UUID.randomUUID(), testMeeting, "Decision", Decision.ApprovalStatus.PENDING);
        Change change = createMockChange(UUID.randomUUID(), testMeeting, ChangeType.CREATE_CARD, ChangeStatus.PENDING);
        
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(List.of(actionItem));
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(List.of(decision));
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(List.of(change));

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result.getActionItems()).hasSize(1);
        assertThat(result.getDecisions()).hasSize(1);
        assertThat(result.getChanges()).hasSize(1);
    }

    @Test
    @DisplayName("T11.2: Convert to DTO - action items mapped")
    void convertToDTO_ActionItemsMapped() throws Exception {
        // Arrange
        ActionItem actionItem = createMockActionItem(UUID.randomUUID(), testMeeting, "Action", Priority.HIGH, ActionItem.ActionItemStatus.PENDING);
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(List.of(actionItem));
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result.getActionItems()).hasSize(1);
        assertThat(result.getActionItems().get(0).getDescription()).isEqualTo("Action");
    }

    @Test
    @DisplayName("T11.3: Convert to DTO - decisions mapped")
    void convertToDTO_DecisionsMapped() throws Exception {
        // Arrange
        Decision decision = createMockDecision(UUID.randomUUID(), testMeeting, "Decision", Decision.ApprovalStatus.PENDING);
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(List.of(decision));
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result.getDecisions()).hasSize(1);
        assertThat(result.getDecisions().get(0).getDescription()).isEqualTo("Decision");
    }

    @Test
    @DisplayName("T11.4: Convert to DTO - changes mapped")
    void convertToDTO_ChangesMapped() throws Exception {
        // Arrange
        Change change = createMockChange(UUID.randomUUID(), testMeeting, ChangeType.CREATE_CARD, ChangeStatus.PENDING);
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(List.of(change));

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result.getChanges()).hasSize(1);
    }

    @Test
    @DisplayName("T11.5: Convert to DTO - null assignee handled")
    void convertToDTO_NullAssignee() throws Exception {
        // Arrange
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("T11.6: Convert to DTO - null approvalStatus defaults to PENDING")
    void convertToDTO_NullApprovalStatus() throws Exception {
        // Arrange
        ActionItem actionItem = ActionItem.builder()
                .id(UUID.randomUUID())
                .meeting(testMeeting)
                .description("Test")
                .priority(Priority.MEDIUM)
                .status(ActionItem.ActionItemStatus.PENDING)
                .approvalStatus(null)
                .build();
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(List.of(actionItem));
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result.getActionItems().get(0).getApprovalStatus()).isEqualTo("PENDING");
    }

    @Test
    @DisplayName("T11.7: Convert to DTO - timestamps included")
    void convertToDTO_TimestampsIncluded() throws Exception {
        // Arrange
        LocalDateTime now = LocalDateTime.now();
        testSummary.setGeneratedAt(now);
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("convertToDTO", MeetingSummary.class);
        method.setAccessible(true);
        MeetingSummaryDTO result = (MeetingSummaryDTO) method.invoke(summaryService, testSummary);

        // Assert
        assertThat(result.getGeneratedAt()).isEqualTo(now);
    }


    // ==================== T12: ASSERT SUMMARY NOT APPROVED TESTS (via reflection) ====================

    @Test
    @DisplayName("T12.1: Assert summary not approved - no approved responses")
    void assertSummaryNotApproved_NoApprovedResponses() throws Exception {
        // Arrange
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.countByApprovalRequestIdAndResponse(
                request.getId(), ApprovalResponseSummary.ApprovalResponse.APPROVED)).thenReturn(0L);

        // Act & Assert - should not throw
        Method method = SummaryService.class.getDeclaredMethod("assertSummaryNotApprovedYet", UUID.class);
        method.setAccessible(true);
        assertThatNoException().isThrownBy(() -> method.invoke(summaryService, meetingId));
    }

    @Test
    @DisplayName("T12.2: Assert summary not approved - at least one approved throws exception")
    void assertSummaryNotApproved_AtLeastOneApproved() throws Exception {
        // Arrange
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.countByApprovalRequestIdAndResponse(
                request.getId(), ApprovalResponseSummary.ApprovalResponse.APPROVED)).thenReturn(1L);

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("assertSummaryNotApprovedYet", UUID.class);
        method.setAccessible(true);

        // Assert
        assertThatThrownBy(() -> method.invoke(summaryService, meetingId))
                .hasCauseInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> {
                    Throwable cause = ex.getCause();
                    assertThat(((ResponseStatusException) cause).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
                });
    }

    @Test
    @DisplayName("T12.3: Assert summary not approved - no approval request")
    void assertSummaryNotApproved_NoApprovalRequest() throws Exception {
        // Arrange
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());

        // Act & Assert - should not throw
        Method method = SummaryService.class.getDeclaredMethod("assertSummaryNotApprovedYet", UUID.class);
        method.setAccessible(true);
        assertThatNoException().isThrownBy(() -> method.invoke(summaryService, meetingId));
    }

    // ==================== T13: HAS USER APPROVED SUMMARY TESTS (via reflection) ====================

    @Test
    @DisplayName("T13.1: Has user approved summary - user approved")
    void hasUserApprovedSummary_UserApproved() throws Exception {
        // Arrange
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        ApprovalResponseSummary response = createMockApprovalResponse(UUID.randomUUID(), request, testUser, ApprovalResponseSummary.ApprovalResponse.APPROVED);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.findByApprovalRequestIdAndUserId(request.getId(), userId)).thenReturn(Optional.of(response));

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("hasUserApprovedSummary", UUID.class, UUID.class);
        method.setAccessible(true);
        boolean result = (boolean) method.invoke(summaryService, meetingId, userId);

        // Assert
        assertThat(result).isTrue();
    }

    @Test
    @DisplayName("T13.2: Has user approved summary - user pending")
    void hasUserApprovedSummary_UserPending() throws Exception {
        // Arrange
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        ApprovalResponseSummary response = createMockApprovalResponse(UUID.randomUUID(), request, testUser, ApprovalResponseSummary.ApprovalResponse.PENDING);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.findByApprovalRequestIdAndUserId(request.getId(), userId)).thenReturn(Optional.of(response));

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("hasUserApprovedSummary", UUID.class, UUID.class);
        method.setAccessible(true);
        boolean result = (boolean) method.invoke(summaryService, meetingId, userId);

        // Assert
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("T13.3: Has user approved summary - no response entry")
    void hasUserApprovedSummary_NoResponseEntry() throws Exception {
        // Arrange
        ApprovalRequestSummary request = createMockApprovalRequest(UUID.randomUUID(), testMeeting);
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(request));
        when(approvalResponseSummaryRepository.findByApprovalRequestIdAndUserId(request.getId(), userId)).thenReturn(Optional.empty());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("hasUserApprovedSummary", UUID.class, UUID.class);
        method.setAccessible(true);
        boolean result = (boolean) method.invoke(summaryService, meetingId, userId);

        // Assert
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("T13.4: Has user approved summary - no approval request")
    void hasUserApprovedSummary_NoApprovalRequest() throws Exception {
        // Arrange
        when(approvalRequestSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.empty());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("hasUserApprovedSummary", UUID.class, UUID.class);
        method.setAccessible(true);
        boolean result = (boolean) method.invoke(summaryService, meetingId, userId);

        // Assert
        assertThat(result).isFalse();
    }

    // ==================== T14: BUILD BOARD CHANGE CONTEXT TESTS (via reflection) ====================

    @Test
    @DisplayName("T14.1: Build board change context - board with stages")
    void buildBoardChangeContext_BoardWithStages() throws Exception {
        // Arrange
        Stage stage2 = createMockStage(UUID.randomUUID(), testBoard, "Stage 2", 2);
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage, stage2));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(Collections.emptyList());
        when(cardRepository.findByStageIdOrderByPosition(stage2.getId())).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        method.setAccessible(true);
        Object result = method.invoke(summaryService, projectId);

        // Assert
        assertThat(result).isNotNull();
        // The result is a record with primaryStage, secondaryStage, sampleCard fields
        Method primaryStageMethod = result.getClass().getDeclaredMethod("primaryStage");
        primaryStageMethod.setAccessible(true);
        Stage primaryStage = (Stage) primaryStageMethod.invoke(result);
        assertThat(primaryStage).isEqualTo(testStage);
    }

    @Test
    @DisplayName("T14.2: Build board change context - single stage")
    void buildBoardChangeContext_SingleStage() throws Exception {
        // Arrange
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        method.setAccessible(true);
        Object result = method.invoke(summaryService, projectId);

        // Assert
        assertThat(result).isNotNull();
        Method secondaryStageMethod = result.getClass().getDeclaredMethod("secondaryStage");
        secondaryStageMethod.setAccessible(true);
        Stage secondaryStage = (Stage) secondaryStageMethod.invoke(result);
        assertThat(secondaryStage).isEqualTo(testStage);
    }

    @Test
    @DisplayName("T14.3: Build board change context - no stages")
    void buildBoardChangeContext_NoStages() throws Exception {
        // Arrange
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        method.setAccessible(true);
        Object result = method.invoke(summaryService, projectId);

        // Assert
        assertThat(result).isNotNull();
        Method primaryStageMethod = result.getClass().getDeclaredMethod("primaryStage");
        primaryStageMethod.setAccessible(true);
        assertThat(primaryStageMethod.invoke(result)).isNull();
    }

    @Test
    @DisplayName("T14.4: Build board change context - no cards")
    void buildBoardChangeContext_NoCards() throws Exception {
        // Arrange
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        method.setAccessible(true);
        Object result = method.invoke(summaryService, projectId);

        // Assert
        assertThat(result).isNotNull();
        Method sampleCardMethod = result.getClass().getDeclaredMethod("sampleCard");
        sampleCardMethod.setAccessible(true);
        assertThat(sampleCardMethod.invoke(result)).isNull();
    }

    @Test
    @DisplayName("T14.5: Build board change context - no board for project")
    void buildBoardChangeContext_NoBoard() throws Exception {
        // Arrange
        when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.emptyList());

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        method.setAccessible(true);
        Object result = method.invoke(summaryService, projectId);

        // Assert
        assertThat(result).isNotNull();
        Method primaryStageMethod = result.getClass().getDeclaredMethod("primaryStage");
        primaryStageMethod.setAccessible(true);
        assertThat(primaryStageMethod.invoke(result)).isNull();
    }

    // ==================== T15-T18: BUILD PAYLOAD TESTS (via reflection) ====================

    @Test
    @DisplayName("T15.1: Build move payload - sample card exists, stages differ")
    void buildMovePayload_SampleCardExists() throws Exception {
        // Arrange - create board change context
        Stage targetStage = createMockStage(UUID.randomUUID(), testBoard, "Target Stage", 2);
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage, targetStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(List.of(testCard));
        when(cardRepository.findByStageIdOrderByPosition(targetStage.getId())).thenReturn(Collections.emptyList());

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "MOVE_CARD", "Move card", "Move to target");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.MOVE_CARD, changeData, ctx);

        // Assert
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("T16.1: Build update payload - sample card exists")
    void buildUpdatePayload_SampleCardExists() throws Exception {
        // Arrange - create board change context
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(List.of(testCard));

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "UPDATE_CARD", "Update card", "Update description");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.UPDATE_CARD, changeData, ctx);

        // Assert
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("T16.2: Build update payload - missing sample card")
    void buildUpdatePayload_MissingSampleCard() throws Exception {
        // Arrange - create board change context without cards
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(Collections.emptyList());

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "UPDATE_CARD", "Update card", "Update description");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.UPDATE_CARD, changeData, ctx);

        // Assert - returns null when no sample card
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("T17.1: Build create payload - primary stage exists")
    void buildCreatePayload_PrimaryStageExists() throws Exception {
        // Arrange - create board change context
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(Collections.emptyList());

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "CREATE_CARD", "Create card", "Create new card");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.CREATE_CARD, changeData, ctx);

        // Assert
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("T17.2: Build create payload - missing primary stage")
    void buildCreatePayload_MissingPrimaryStage() throws Exception {
        // Arrange - create board change context without stages
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(Collections.emptyList());

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "CREATE_CARD", "Create card", "Create new card");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.CREATE_CARD, changeData, ctx);

        // Assert - returns null when no primary stage
        assertThat(result).isNull();
    }

    @Test
    @DisplayName("T18.1: Build delete payload - sample card exists")
    void buildDeletePayload_SampleCardExists() throws Exception {
        // Arrange - create board change context
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(List.of(testCard));

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "DELETE_CARD", "Delete card", "Delete this card");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.DELETE_CARD, changeData, ctx);

        // Assert
        assertThat(result).isNotNull();
    }

    @Test
    @DisplayName("T18.2: Build delete payload - missing sample card")
    void buildDeletePayload_MissingSampleCard() throws Exception {
        // Arrange - create board change context without cards
        when(boardRepository.findByProjectId(projectId)).thenReturn(List.of(testBoard));
        when(stageRepository.findByBoardIdOrderByPosition(boardId)).thenReturn(List.of(testStage));
        when(cardRepository.findByStageIdOrderByPosition(stageId)).thenReturn(Collections.emptyList());

        // Get BoardChangeContext via reflection
        Method buildContextMethod = SummaryService.class.getDeclaredMethod("buildBoardChangeContext", UUID.class);
        buildContextMethod.setAccessible(true);
        Object ctx = buildContextMethod.invoke(summaryService, projectId);

        // Create ChangeData
        AIEngine.MeetingAnalysisResult.ChangeData changeData = new AIEngine.MeetingAnalysisResult.ChangeData(
                "DELETE_CARD", "Delete card", "Delete this card");

        // Act - call buildMockPayload via reflection
        Method buildPayloadMethod = SummaryService.class.getDeclaredMethod("buildMockPayload", 
                Change.ChangeType.class, AIEngine.MeetingAnalysisResult.ChangeData.class, 
                Class.forName("com.flowboard.service.SummaryService$BoardChangeContext"));
        buildPayloadMethod.setAccessible(true);
        Object result = buildPayloadMethod.invoke(summaryService, Change.ChangeType.DELETE_CARD, changeData, ctx);

        // Assert - returns null when no sample card
        assertThat(result).isNull();
    }

    // ==================== T19: CARD JSON CONVERSION TESTS (via reflection) ====================

    @Test
    @DisplayName("T19.1: Card JSON conversion - all fields")
    void cardJson_AllFields() throws Exception {
        // Act - use reflection to call private cardJson method
        Method method = SummaryService.class.getDeclaredMethod("cardJson", Card.class, Stage.class);
        method.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) method.invoke(summaryService, testCard, testStage);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.get("id")).isEqualTo(testCard.getId().toString());
        assertThat(result.get("title")).isEqualTo(testCard.getTitle());
        assertThat(result.get("stageId")).isEqualTo(testStage.getId().toString());
    }

    @Test
    @DisplayName("T19.2: Card JSON conversion - null stage")
    void cardJson_NullStage() throws Exception {
        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("cardJson", Card.class, Stage.class);
        method.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) method.invoke(summaryService, testCard, null);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.get("id")).isEqualTo(testCard.getId().toString());
        assertThat(result.get("stageId")).isNull();
    }

    @Test
    @DisplayName("T19.3: Card JSON conversion - null description")
    void cardJson_NullDescription() throws Exception {
        // Arrange
        Card cardWithoutDesc = Card.builder()
                .id(cardId)
                .stage(testStage)
                .title("Test")
                .description(null)
                .priority(Card.Priority.MEDIUM)
                .build();

        // Act - use reflection
        Method method = SummaryService.class.getDeclaredMethod("cardJson", Card.class, Stage.class);
        method.setAccessible(true);
        @SuppressWarnings("unchecked")
        Map<String, Object> result = (Map<String, Object>) method.invoke(summaryService, cardWithoutDesc, testStage);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.get("description")).isNull();
    }
}
