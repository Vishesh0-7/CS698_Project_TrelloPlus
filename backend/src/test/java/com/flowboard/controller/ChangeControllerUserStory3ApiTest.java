package com.flowboard.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.*;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import com.flowboard.service.ChangeApplicationService;
import com.flowboard.service.ChangeApprovalService;
import com.flowboard.service.ChangePreviewService;
import com.flowboard.service.JWTService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = ChangeController.class)
@AutoConfigureMockMvc(addFilters = false)
class ChangeControllerUserStory3ApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private ChangePreviewService changePreviewService;

    @MockBean
    private ChangeApprovalService changeApprovalService;

    @MockBean
    private ChangeApplicationService changeApplicationService;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private JWTService jwtService;

    private UUID changeId;
    private UUID meetingId;
    private UUID userId;

    @BeforeEach
    void setUp() {
        changeId = UUID.randomUUID();
        meetingId = UUID.randomUUID();
        userId = UUID.randomUUID();

        User user = User.builder()
            .id(userId)
            .email("reviewer@example.com")
            .username("reviewer")
            .role(User.UserRole.MEMBER)
            .build();

        when(userRepository.findByEmailIgnoreCase("reviewer@example.com")).thenReturn(Optional.of(user));
        when(jwtService.extractUserIdFromAuthHeader(any())).thenReturn(userId);
    }

    @Test
    void listChanges_returnsOk() throws Exception {
        when(changePreviewService.listChanges(eq(null), eq(null), eq(null), eq(userId)))
            .thenReturn(Collections.singletonList(ChangeDTO.builder()
                .id(changeId)
                .meetingId(meetingId)
                .changeType("UPDATE_CARD")
                .status("PENDING")
                .createdAt(LocalDateTime.now())
                .build()));

        mockMvc.perform(get("/changes")
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(changeId.toString()));
    }

    @Test
    void getChange_returnsOk() throws Exception {
        when(changePreviewService.getChange(changeId, userId)).thenReturn(ChangeDTO.builder()
            .id(changeId)
            .meetingId(meetingId)
            .changeType("MOVE_CARD")
            .status("UNDER_REVIEW")
            .createdAt(LocalDateTime.now())
            .build());

        mockMvc.perform(get("/changes/{id}", changeId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(changeId.toString()));
    }

    @Test
    void getDiff_returnsOk() throws Exception {
        when(changePreviewService.getDiff(changeId, userId)).thenReturn(ChangeDiffDTO.builder()
            .beforeState("{}")
            .afterState("{}")
            .summary("Card fields were updated")
            .build());

        mockMvc.perform(get("/changes/{id}/diff", changeId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.summary").exists());
    }

    @Test
    void getImpact_returnsOk() throws Exception {
        when(changePreviewService.getImpact(changeId, userId)).thenReturn(ChangeImpactDTO.builder()
            .affectedCards(List.of("card-1"))
            .affectedStages(List.of())
            .riskLevel("LOW")
            .potentialConflicts(List.of())
            .build());

        mockMvc.perform(get("/changes/{id}/impact", changeId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.riskLevel").value("LOW"));
    }

    @Test
    void getHistory_returnsOk() throws Exception {
        when(changePreviewService.getHistory(changeId, userId)).thenReturn(List.of(
            ChangeHistoryEntryDTO.builder()
                .id(UUID.randomUUID())
                .action("APPROVED")
                .actorId(userId)
                .actorName("reviewer")
                .details("{\"decision\":\"APPROVE\"}")
                .createdAt(LocalDateTime.now())
                .build()
        ));

        mockMvc.perform(get("/changes/{id}/history", changeId)
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].action").value("APPROVED"));
    }

    @Test
    @WithMockUser(username = "reviewer@example.com")
    void approve_returnsApprovalStatus() throws Exception {
        ChangeDecisionRequest request = ChangeDecisionRequest.builder()
            .decision("APPROVE")
            .feedback("Looks good")
            .build();

        when(changeApprovalService.decide(eq(changeId), any(User.class), any(ChangeDecisionRequest.class)))
            .thenReturn(ApprovalStatusDTO.builder()
                .meetingId(meetingId)
                .requiredApprovals(2)
                .currentApprovedCount(1)
                .currentRejectedCount(0)
                .totalApproversNeeded(3)
                .responses(Collections.emptyList())
                .build());

        mockMvc.perform(post("/changes/{id}/approve", changeId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.requiredApprovals").value(2));
    }

    @Test
    @WithMockUser(username = "reviewer@example.com")
    void apply_returnsResult() throws Exception {
        when(changeApplicationService.applyChange(eq(changeId), any(User.class)))
            .thenReturn(ChangeApplyResultDTO.builder()
                .changeId(changeId)
                .status("APPLIED")
                .applied(true)
                .message("Change applied successfully")
                .build());

        mockMvc.perform(post("/changes/{id}/apply", changeId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPLIED"));
    }

    @Test
    @WithMockUser(username = "reviewer@example.com")
    void reject_returnsApprovalStatus() throws Exception {
        ChangeDecisionRequest request = ChangeDecisionRequest.builder()
            .decision("REJECT")
            .feedback("Needs correction")
            .build();

        when(changeApprovalService.decide(eq(changeId), any(User.class), any(ChangeDecisionRequest.class)))
            .thenReturn(ApprovalStatusDTO.builder()
                .meetingId(meetingId)
                .requiredApprovals(2)
                .currentApprovedCount(0)
                .currentRejectedCount(1)
                .totalApproversNeeded(3)
                .responses(Collections.emptyList())
                .build());

        mockMvc.perform(post("/changes/{id}/reject", changeId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currentRejectedCount").value(1));
    }

    @Test
    void getApprovalStatus_returnsOk() throws Exception {
        doReturn(ApprovalStatusDTO.builder()
            .meetingId(meetingId)
            .requiredApprovals(2)
            .currentApprovedCount(1)
            .currentRejectedCount(0)
            .totalApproversNeeded(3)
            .responses(Collections.emptyList())
            .build()).when(changeApprovalService).getApprovalStatus(changeId);

        mockMvc.perform(get("/changes/{id}/approval-status", changeId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.requiredApprovals").value(2));
    }

    @Test
    void approve_withoutAuthentication_returnsUnauthorized() throws Exception {
        ChangeDecisionRequest request = ChangeDecisionRequest.builder()
            .decision("APPROVE")
            .build();

        mockMvc.perform(post("/changes/{id}/approve", changeId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void apply_withoutAuthentication_returnsUnauthorized() throws Exception {
        mockMvc.perform(post("/changes/{id}/apply", changeId))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "missing@example.com")
    void apply_withAuthenticatedUnknownUser_returnsUnauthorized() throws Exception {
        when(userRepository.findByEmailIgnoreCase("missing@example.com")).thenReturn(Optional.empty());

        mockMvc.perform(post("/changes/{id}/apply", changeId))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "reviewer@example.com")
    void submitDecision_withInvalidDecision_returnsBadRequest() throws Exception {
        ChangeDecisionRequest request = ChangeDecisionRequest.builder()
            .decision("NOT_A_VALID_DECISION")
            .build();

        doThrow(new org.springframework.web.server.ResponseStatusException(
            org.springframework.http.HttpStatus.BAD_REQUEST,
            "Invalid decision"
        )).when(changeApprovalService).decide(eq(changeId), any(User.class), any(ChangeDecisionRequest.class));

        mockMvc.perform(post("/changes/{id}/decision", changeId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isBadRequest());
    }
}
