package com.flowboard.service;

import com.flowboard.dto.ApprovalStatusDTO;
import com.flowboard.dto.ChangeDecisionRequest;
import com.flowboard.entity.*;
import com.flowboard.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChangeApprovalServiceUserStory3Test {

    @Mock
    private ChangeRepository changeRepository;

    @Mock
    private ChangeApprovalRequestRepository changeApprovalRequestRepository;

    @Mock
    private ChangeApprovalResponseRepository changeApprovalResponseRepository;

    @Mock
    private MeetingMemberRepository meetingMemberRepository;

    @Mock
    private ChangeAuditEntryRepository changeAuditEntryRepository;

    private ChangeApprovalService service;

    private UUID changeId;
    private UUID meetingId;
    private UUID actorId;
    private Change change;
    private ChangeApprovalRequest approvalRequest;
    private ChangeApprovalResponse actorResponse;
    private User actor;

    @BeforeEach
    void setUp() {
        service = new ChangeApprovalService(
            changeRepository,
            changeApprovalRequestRepository,
            changeApprovalResponseRepository,
            meetingMemberRepository,
            changeAuditEntryRepository
        );

        changeId = UUID.randomUUID();
        meetingId = UUID.randomUUID();
        actorId = UUID.randomUUID();

        actor = User.builder()
            .id(actorId)
            .email("reviewer@flowboard.com")
            .username("reviewer")
            .role(User.UserRole.MEMBER)
            .build();

        Project project = Project.builder().id(UUID.randomUUID()).owner(actor).build();
        Meeting meeting = Meeting.builder().id(meetingId).project(project).createdBy(actor).build();
        change = Change.builder()
            .id(changeId)
            .meeting(meeting)
            .changeType(Change.ChangeType.UPDATE_CARD)
            .status(Change.ChangeStatus.PENDING)
            .build();

        approvalRequest = ChangeApprovalRequest.builder()
            .id(UUID.randomUUID())
            .change(change)
            .requiredApprovals(2)
            .responses(Set.of())
            .build();

        actorResponse = ChangeApprovalResponse.builder()
            .id(UUID.randomUUID())
            .approvalRequest(approvalRequest)
            .user(actor)
            .decision(ChangeApprovalResponse.ApprovalDecision.PENDING)
            .build();

        lenient().when(changeRepository.findById(changeId)).thenReturn(Optional.of(change));
        lenient().when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, actorId)).thenReturn(true);
        lenient().when(changeApprovalRequestRepository.findByChangeId(changeId)).thenReturn(Optional.of(approvalRequest));
        lenient().when(changeApprovalResponseRepository.findByApprovalRequestIdAndUserId(approvalRequest.getId(), actorId))
            .thenReturn(Optional.of(actorResponse));
        lenient().when(changeApprovalResponseRepository.save(any(ChangeApprovalResponse.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(changeRepository.save(any(Change.class))).thenAnswer(invocation -> invocation.getArgument(0));
        lenient().when(changeAuditEntryRepository.save(any(ChangeAuditEntry.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void decide_approve_movesChangeToReadyForApplication_whenQuorumReached() {
        when(changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequest.getId(),
            ChangeApprovalResponse.ApprovalDecision.APPROVE
        )).thenReturn(2L);
        when(changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequest.getId(),
            ChangeApprovalResponse.ApprovalDecision.REJECT
        )).thenReturn(0L);
        when(changeApprovalResponseRepository.findByApprovalRequestId(approvalRequest.getId())).thenReturn(List.of(
            actorResponse,
            ChangeApprovalResponse.builder()
                .id(UUID.randomUUID())
                .approvalRequest(approvalRequest)
                .user(User.builder().id(UUID.randomUUID()).username("peer").email("peer@flowboard.com").role(User.UserRole.MEMBER).build())
                .decision(ChangeApprovalResponse.ApprovalDecision.APPROVE)
                .build()
        ));
        when(meetingMemberRepository.countByMeetingId(meetingId)).thenReturn(3L);

        ApprovalStatusDTO status = service.decide(
            changeId,
            actor,
            ChangeDecisionRequest.builder().decision("APPROVE").feedback("Looks good").build()
        );

        assertEquals(Change.ChangeStatus.READY_FOR_APPLICATION, change.getStatus());
        assertEquals(2, status.getCurrentApprovedCount());
        assertEquals(0, status.getCurrentRejectedCount());
        assertEquals(2, status.getRequiredApprovals());
    }

    @Test
    void decide_reject_movesChangeToRejected() {
        when(changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequest.getId(),
            ChangeApprovalResponse.ApprovalDecision.APPROVE
        )).thenReturn(0L);
        when(changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequest.getId(),
            ChangeApprovalResponse.ApprovalDecision.REJECT
        )).thenReturn(1L);
        when(changeApprovalResponseRepository.findByApprovalRequestId(approvalRequest.getId())).thenReturn(List.of(actorResponse));
        when(meetingMemberRepository.countByMeetingId(meetingId)).thenReturn(2L);

        service.decide(
            changeId,
            actor,
            ChangeDecisionRequest.builder().decision("REJECT").feedback("Data mismatch").build()
        );

        assertEquals(Change.ChangeStatus.REJECTED, change.getStatus());
    }

    @Test
    void decide_rejectsInvalidDecisionInput() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.decide(changeId, actor, ChangeDecisionRequest.builder().decision("INVALID").build())
        );

        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("Invalid decision"));
    }

    @Test
    void decide_forbidsNonMeetingMember() {
        when(meetingMemberRepository.existsByMeetingIdAndUserId(meetingId, actorId)).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
            service.decide(changeId, actor, ChangeDecisionRequest.builder().decision("APPROVE").build())
        );

        assertEquals(403, ex.getStatusCode().value());
    }

    @Test
    void decide_createsAuditEntryForDecision() {
        when(changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequest.getId(),
            ChangeApprovalResponse.ApprovalDecision.APPROVE
        )).thenReturn(1L);
        when(changeApprovalResponseRepository.countByApprovalRequestIdAndDecision(
            approvalRequest.getId(),
            ChangeApprovalResponse.ApprovalDecision.REJECT
        )).thenReturn(0L);
        when(changeApprovalResponseRepository.findByApprovalRequestId(approvalRequest.getId())).thenReturn(List.of(actorResponse));
        when(meetingMemberRepository.countByMeetingId(meetingId)).thenReturn(1L);

        service.decide(changeId, actor, ChangeDecisionRequest.builder().decision("APPROVE").build());

        ArgumentCaptor<ChangeAuditEntry> auditCaptor = ArgumentCaptor.forClass(ChangeAuditEntry.class);
        verify(changeAuditEntryRepository).save(auditCaptor.capture());
        assertEquals(ChangeAuditEntry.AuditAction.APPROVED, auditCaptor.getValue().getAction());
    }
}
