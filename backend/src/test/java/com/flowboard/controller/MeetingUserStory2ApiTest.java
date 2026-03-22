package com.flowboard.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.*;
import com.flowboard.entity.Project;
import com.flowboard.entity.User;
import com.flowboard.repository.ProjectRepository;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {MeetingController.class, SummaryController.class, ApprovalSummaryController.class})
@AutoConfigureMockMvc(addFilters = false)
class MeetingUserStory2ApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private MeetingService meetingService;

    @MockBean
    private SummaryService summaryService;

    @MockBean
    private ApprovalService approvalService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private ProjectRepository projectRepository;

    @MockBean
    private JWTService jwtService;

    private UUID projectId;
    private UUID meetingId;
    private UUID summaryId;
    private UUID userId;
    private User testUser;
    private MeetingDTO testMeeting;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        meetingId = UUID.randomUUID();
        summaryId = UUID.randomUUID();
        userId = UUID.randomUUID();

        testUser = User.builder()
            .id(userId)
            .username("test_user")
            .email("test@example.com")
            .role(User.UserRole.MEMBER)
            .build();

        testMeeting = MeetingDTO.builder()
            .id(meetingId)
            .projectId(projectId)
            .title("Sprint Planning")
            .description("Q1 Sprint Planning Meeting")
            .meetingDate(LocalDate.now())
            .meetingTime(LocalTime.of(10, 0))
            .platform("Zoom")
            .meetingLink("https://zoom.us/j/123456")
            .status("SCHEDULED")
            .createdByName("test_user")
            .createdAt(LocalDateTime.now())
            .members(Arrays.asList(
                UserDTO.builder()
                    .id(userId)
                    .username("test_user")
                    .email("test@example.com")
                    .build()
            ))
            .build();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private void authenticateAsTestUser() {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(
                testUser,
                null,
                Arrays.asList(new SimpleGrantedAuthority("ROLE_MEMBER"))
            )
        );
    }

    @Test
    void createMeeting_withValidRequest_returnsCreatedMeeting() throws Exception {
        CreateMeetingRequest request = CreateMeetingRequest.builder()
            .title("Sprint Planning")
            .description("Q1 Sprint Planning Meeting")
            .meetingDate(LocalDate.now())
            .meetingTime(LocalTime.of(10, 0))
            .projectId(projectId)
            .platform("Zoom")
            .meetingLink("https://zoom.us/j/123456")
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));
        when(meetingService.createMeeting(any(CreateMeetingRequest.class), any(User.class)))
            .thenReturn(testMeeting);

        MvcResult result = mockMvc.perform(post("/meetings")
            .header("Authorization", "Bearer valid-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.title").value("Sprint Planning"))
            .andExpect(jsonPath("$.status").value("SCHEDULED"))
            .andReturn();

        String responseBody = result.getResponse().getContentAsString();
        assertThat(responseBody).contains("Sprint Planning");
    }

    @Test
    void getMeeting_withValidId_returnsMeeting() throws Exception {
        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(meetingService.getMeeting(meetingId, userId)).thenReturn(testMeeting);

        mockMvc.perform(get("/meetings/{id}", meetingId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(meetingId.toString()))
            .andExpect(jsonPath("$.title").value("Sprint Planning"))
            .andExpect(jsonPath("$.projectId").value(projectId.toString()));
    }

    @Test
    void getMeetingsByProject_withValidProjectId_returnsMeetingList() throws Exception {
        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(meetingService.getMeetingsByProject(projectId, userId))
            .thenReturn(Arrays.asList(testMeeting));

        mockMvc.perform(get("/meetings/project/{projectId}", projectId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(meetingId.toString()))
            .andExpect(jsonPath("$[0].projectId").value(projectId.toString()));
    }

    @Test
    void endMeeting_withTranscript_returnsUpdatedMeeting() throws Exception {
        EndMeetingRequest request = EndMeetingRequest.builder()
            .meetingId(meetingId)
            .transcript("We discussed the Q1 roadmap. Decided to move the API redesign to sprint 2. " +
                        "Action items: complete database migration, update documentation.")
            .build();

        MeetingDTO updatedMeeting = MeetingDTO.builder()
            .id(meetingId)
            .projectId(projectId)
            .title("Sprint Planning")
            .status("PENDING_APPROVAL")
            .createdByName("test_user")
            .createdAt(LocalDateTime.now())
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(meetingService.endMeeting(meetingId, request.getTranscript(), userId))
            .thenReturn(updatedMeeting);

        mockMvc.perform(post("/meetings/{id}/end", meetingId)
            .header("Authorization", "Bearer valid-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING_APPROVAL"));
    }

    @Test
    void addMeetingMember_withValidUserId_succeeds() throws Exception {
        UUID newMemberId = UUID.randomUUID();
        AddMeetingMemberRequest request = AddMeetingMemberRequest.builder()
            .meetingId(meetingId)
            .userId(newMemberId)
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);

        mockMvc.perform(post("/meetings/{id}/members", meetingId)
            .header("Authorization", "Bearer valid-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated());
    }

    @Test
    void removeMeetingMember_withValidUserId_succeeds() throws Exception {
        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);

        mockMvc.perform(delete("/meetings/{id}/members/{userId}", meetingId, userId)
            .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isNoContent());
    }

    @Test
    void generateSummary_withValidMeetingId_returnsSummary() throws Exception {
        GenerateSummaryRequest request = GenerateSummaryRequest.builder()
            .meetingId(meetingId)
            .build();

        MeetingSummaryDTO summary = MeetingSummaryDTO.builder()
            .id(summaryId)
            .meetingId(meetingId)
            .status("PENDING")
            .aiGeneratedContent("## Meeting Summary\n\n### Action Items\n- Complete database migration [HIGH]\n\n### Decisions\n- Move API redesign to sprint 2")
            .generatedAt(LocalDateTime.now())
            .actionItems(Arrays.asList(
                ActionItemDTO.builder()
                    .id(UUID.randomUUID())
                    .meetingId(meetingId)
                    .description("Complete database migration")
                    .priority("HIGH")
                    .status("PENDING")
                    .build()
            ))
            .decisions(Arrays.asList(
                DecisionDTO.builder()
                    .id(UUID.randomUUID())
                    .meetingId(meetingId)
                    .description("Move API redesign to sprint 2")
                    .build()
            ))
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(summaryService.generateSummary(meetingId, userId)).thenReturn(summary);

        mockMvc.perform(post("/summaries")
            .header("Authorization", "Bearer valid-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").value(summaryId.toString()))
            .andExpect(jsonPath("$.status").value("PENDING"))
            .andExpect(jsonPath("$.actionItems[0].description").value("Complete database migration"));
    }

    @Test
    void getSummary_withValidId_returnsSummary() throws Exception {
        MeetingSummaryDTO summary = MeetingSummaryDTO.builder()
            .id(summaryId)
            .meetingId(meetingId)
            .status("PENDING")
            .generatedAt(LocalDateTime.now())
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(summaryService.getSummary(summaryId, userId)).thenReturn(summary);

        mockMvc.perform(get("/summaries/{id}", summaryId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(summaryId.toString()))
            .andExpect(jsonPath("$.meetingId").value(meetingId.toString()));
    }

    @Test
    void submitApproval_withValidResponse_succeeds() throws Exception {
        SubmitApprovalRequest request = SubmitApprovalRequest.builder()
            .meetingId(meetingId)
            .response("APPROVED")
            .comments("Looks good to me")
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(userRepository.findById(userId)).thenReturn(Optional.of(testUser));

        mockMvc.perform(post("/approvals/summary/{meetingId}", meetingId)
            .header("Authorization", "Bearer valid-token")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk());
    }

    @Test
    void getApprovalStatus_withValidMeetingId_returnsApprovalStatus() throws Exception {
        ApprovalStatusDTO status = ApprovalStatusDTO.builder()
            .meetingId(meetingId)
            .requiredApprovals(3)
            .currentApprovedCount(2)
            .currentRejectedCount(0)
            .responses(Arrays.asList(
                ApprovalStatusDTO.ApprovalResponseDTO.builder()
                    .userId(userId)
                    .userName("test_user")
                    .response("APPROVED")
                    .respondedAt(LocalDateTime.now())
                    .build()
            ))
            .build();

        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(approvalService.getApprovalStatus(meetingId, userId)).thenReturn(status);

        mockMvc.perform(get("/approvals/summary/{meetingId}", meetingId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.meetingId").value(meetingId.toString()))
            .andExpect(jsonPath("$.requiredApprovals").value(3))
            .andExpect(jsonPath("$.currentApprovedCount").value(2));
    }

    @Test
    void isMeetingApproved_returnsTrueWhenApproved() throws Exception {
        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(approvalService.isMeetingApproved(meetingId, userId)).thenReturn(true);

        mockMvc.perform(get("/approvals/summary/{meetingId}/approved", meetingId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(content().string("true"));
    }

    @Test
    void hasAllApprovalsSubmitted_returnsTrueWhenAllSubmitted() throws Exception {
        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
        when(approvalService.hasAllApprovalsSubmitted(meetingId, userId)).thenReturn(true);

        mockMvc.perform(get("/approvals/summary/{meetingId}/all-submitted", meetingId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(content().string("true"));
    }
}
