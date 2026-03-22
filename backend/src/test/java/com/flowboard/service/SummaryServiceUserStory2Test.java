package com.flowboard.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.MeetingSummaryDTO;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SummaryServiceUserStory2Test {

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
    private ApprovalRequestSummaryRepository approvalRequestRepository;

    @Mock
    private ApprovalResponseSummaryRepository approvalResponseRepository;

    @Mock
    private AIEngine aiEngine;

    @Mock
    private BoardRepository boardRepository;

    @Mock
    private StageRepository stageRepository;

    @Mock
    private CardRepository cardRepository;

    private SummaryService summaryService;
    private Meeting testMeeting;
    private User testUser;
    private Project testProject;

    @BeforeEach
    void setUp() {
        summaryService = new SummaryService(
            meetingRepository,
            meetingSummaryRepository,
            meetingMemberRepository,
            actionItemRepository,
            decisionRepository,
            changeRepository,
            approvalRequestRepository,
            approvalResponseRepository,
            aiEngine,
            boardRepository,
            stageRepository,
            cardRepository,
            new ObjectMapper()
        );

        UUID userId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID meetingId = UUID.randomUUID();

        testUser = User.builder()
            .id(userId)
            .username("test_user")
            .email("test@example.com")
            .build();

        testProject = Project.builder()
            .id(projectId)
            .name("Test Project")
            .owner(testUser)
            .build();

        testMeeting = Meeting.builder()
            .id(meetingId)
            .title("Sprint Planning")
            .project(testProject)
            .transcript("We discussed the Q1 roadmap. Decided on MVP features.")
            .status(Meeting.MeetingStatus.PENDING_APPROVAL)
            .createdBy(testUser)
            .build();

                lenient().when(boardRepository.findByProjectId(projectId)).thenReturn(Collections.emptyList());
    }

    @Test
    void generateSummary_withValidTranscript_createsActionItemsAndDecisions() {
        UUID meetingId = testMeeting.getId();
        UUID userId = testUser.getId();

        MeetingMember member = MeetingMember.builder()
            .meeting(testMeeting)
            .user(testUser)
            .build();

        AIEngine.MeetingAnalysisResult mockAnalysis = new AIEngine.MeetingAnalysisResult();
        mockAnalysis.addActionItem("Complete backend implementation", "From discussion", "HIGH");
        mockAnalysis.addDecision("Use Spring Boot for backend", "Team consensus");

        when(meetingRepository.findById(meetingId)).thenReturn(Optional.of(testMeeting));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(aiEngine.analyzeMeetingTranscript(testMeeting.getTranscript())).thenReturn(mockAnalysis);
        when(meetingSummaryRepository.save(any(MeetingSummary.class)))
            .thenAnswer(i -> {
                MeetingSummary summary = i.getArgument(0);
                summary.setId(UUID.randomUUID());
                return summary;
            });
        when(actionItemRepository.save(any(ActionItem.class)))
            .thenAnswer(i -> {
                ActionItem item = i.getArgument(0);
                item.setId(UUID.randomUUID());
                return item;
            });
        when(decisionRepository.save(any(Decision.class)))
            .thenAnswer(i -> {
                Decision decision = i.getArgument(0);
                decision.setId(UUID.randomUUID());
                return decision;
            });
        when(meetingMemberRepository.findByMeetingId(meetingId))
            .thenReturn(Collections.singletonList(member));
        when(approvalRequestRepository.save(any(ApprovalRequestSummary.class)))
            .thenAnswer(i -> {
                ApprovalRequestSummary req = i.getArgument(0);
                req.setId(UUID.randomUUID());
                return req;
            });

        MeetingSummaryDTO result = summaryService.generateSummary(meetingId, userId);

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo("PENDING");
        verify(actionItemRepository, atLeastOnce()).save(any(ActionItem.class));
        verify(decisionRepository, atLeastOnce()).save(any(Decision.class));
        verify(approvalRequestRepository).save(any(ApprovalRequestSummary.class));
    }

    @Test
    void getSummary_withValidId_returnsSummary() {
        UUID summaryId = UUID.randomUUID();
        UUID userId = testUser.getId();
        MeetingSummary summary = MeetingSummary.builder()
            .id(summaryId)
            .meeting(testMeeting)
            .aiGeneratedContent("## Meeting Summary")
            .status(MeetingSummary.SummaryStatus.PENDING)
            .build();

        when(meetingSummaryRepository.findById(summaryId)).thenReturn(Optional.of(summary));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(testMeeting.getId(), userId)).thenReturn(true);
        when(actionItemRepository.findByMeetingId(testMeeting.getId())).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(testMeeting.getId())).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(testMeeting.getId())).thenReturn(Collections.emptyList());

        MeetingSummaryDTO result = summaryService.getSummary(summaryId, userId);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(summaryId);
        assertThat(result.getStatus()).isEqualTo("PENDING");
    }

    @Test
    void getSummaryByMeeting_withValidMeetingId_returnsSummary() {
        UUID meetingId = testMeeting.getId();
        UUID userId = testUser.getId();
        MeetingSummary summary = MeetingSummary.builder()
            .id(UUID.randomUUID())
            .meeting(testMeeting)
            .status(MeetingSummary.SummaryStatus.APPROVED)
            .build();

        when(meetingSummaryRepository.findByMeetingId(meetingId)).thenReturn(Optional.of(summary));
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, userId)).thenReturn(true);
        when(actionItemRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(decisionRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());
        when(changeRepository.findByMeetingId(meetingId)).thenReturn(Collections.emptyList());

        MeetingSummaryDTO result = summaryService.getSummaryByMeeting(meetingId, userId);

        assertThat(result).isNotNull();
        assertThat(result.getStatus()).isEqualTo("APPROVED");
    }
}
