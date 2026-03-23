package com.flowboard.service;

import com.flowboard.dto.CardDTO;
import com.flowboard.dto.StageDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * Service for broadcasting real-time updates across all features to connected WebSocket clients.
 * Enables real-time synchronization for:
 * - Board operations (cards, stages)
 * - Meeting lifecycle and members
 * - Summaries, decisions, and action items
 * - Approval workflows
 * - Change requests and applications
 * - Project and team management
 * 
 * This enables real-time synchronization across multiple users viewing the same board.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BoardBroadcastService {

    private final SimpMessagingTemplate messagingTemplate;

    /**
     * Broadcast a new card creation to all users viewing the board
     */
    public void broadcastCardCreated(UUID boardId, UUID stageId, CardDTO card) {
        String topic = "/topic/board/" + boardId + "/stage/" + stageId + "/card-created";
        log.info("Broadcasting card creation to {}: {}", topic, card.getId());
        messagingTemplate.convertAndSend(topic, card);
    }

    /**
     * Broadcast a card update to all users viewing the board
     */
    public void broadcastCardUpdated(UUID boardId, UUID stageId, CardDTO card) {
        String topic = "/topic/board/" + boardId + "/stage/" + stageId + "/card-updated";
        log.info("Broadcasting card update to {}: {}", topic, card.getId());
        messagingTemplate.convertAndSend(topic, card);
    }

    /**
     * Broadcast a card move (change of stage) to all users viewing the board
     */
    public void broadcastCardMoved(UUID boardId, UUID fromStageId, UUID toStageId, CardDTO card, Integer newPosition) {
        String topic = "/topic/board/" + boardId + "/card-moved";
        CardMoveEvent event = new CardMoveEvent(card, fromStageId, toStageId, newPosition);
        log.info("Broadcasting card move to {}: {} from stage {} to {}", topic, card.getId(), fromStageId, toStageId);
        messagingTemplate.convertAndSend(topic, event);
    }

    /**
     * Broadcast a card deletion to all users viewing the board
     */
    public void broadcastCardDeleted(UUID boardId, UUID stageId, UUID cardId) {
        String topic = "/topic/board/" + boardId + "/stage/" + stageId + "/card-deleted";
        CardDeleteEvent event = new CardDeleteEvent(cardId, stageId);
        log.info("Broadcasting card deletion to {}: {}", topic, cardId);
        messagingTemplate.convertAndSend(topic, event);
    }

    /**
     * Broadcast a stage creation to all users viewing the board
     */
    public void broadcastStageCreated(UUID boardId, StageDTO stage) {
        String topic = "/topic/board/" + boardId + "/stage-created";
        log.info("Broadcasting stage creation to {}: {}", topic, stage.getId());
        messagingTemplate.convertAndSend(topic, stage);
    }

    /**
     * Broadcast a stage update to all users viewing the board
     */
    public void broadcastStageUpdated(UUID boardId, StageDTO stage) {
        String topic = "/topic/board/" + boardId + "/stage-updated";
        log.info("Broadcasting stage update to {}: {}", topic, stage.getId());
        messagingTemplate.convertAndSend(topic, stage);
    }

    /**
     * Broadcast a stage deletion to all users viewing the board
     */
    public void broadcastStageDeleted(UUID boardId, UUID stageId) {
        String topic = "/topic/board/" + boardId + "/stage-deleted";
        StageDeleteEvent event = new StageDeleteEvent(stageId);
        log.info("Broadcasting stage deletion to {}: {}", topic, stageId);
        messagingTemplate.convertAndSend(topic, event);
    }

    /**
     * Event class for card moves
     */
    public static class CardMoveEvent {
        public UUID cardId;
        public UUID fromStageId;
        public UUID toStageId;
        public Integer newPosition;
        public CardDTO cardData;

        public CardMoveEvent(CardDTO cardData, UUID fromStageId, UUID toStageId, Integer newPosition) {
            this.cardId = cardData.getId();
            this.cardData = cardData;
            this.fromStageId = fromStageId;
            this.toStageId = toStageId;
            this.newPosition = newPosition;
        }
    }

    /**
     * Event class for card deletions
     */
    public static class CardDeleteEvent {
        public UUID cardId;
        public UUID stageId;

        public CardDeleteEvent(UUID cardId, UUID stageId) {
            this.cardId = cardId;
            this.stageId = stageId;
        }
    }

    /**
     * Event class for stage deletions
     */
    public static class StageDeleteEvent {
        public UUID stageId;

        public StageDeleteEvent(UUID stageId) {
            this.stageId = stageId;
        }
    }
    
    // ==================== MEETING OPERATIONS ====================
    
    public void broadcastMeetingCreated(UUID projectId, Object meeting) {
        String topic = "/topic/project/" + projectId + "/meeting-created";
        log.info("Broadcasting meeting creation to {}", topic);
        messagingTemplate.convertAndSend(topic, meeting);
    }
    
    public void broadcastMeetingUpdated(UUID projectId, Object meeting) {
        String topic = "/topic/project/" + projectId + "/meeting-updated";
        log.info("Broadcasting meeting update to {}", topic);
        messagingTemplate.convertAndSend(topic, meeting);
    }
    
    public void broadcastMeetingDeleted(UUID projectId, UUID meetingId) {
        String topic = "/topic/project/" + projectId + "/meeting-deleted";
        EntityDeleteEvent event = new EntityDeleteEvent(meetingId);
        log.info("Broadcasting meeting deletion to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastMeetingMemberAdded(UUID projectId, UUID meetingId, String memberName) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/member-added";
        MeetingMemberEvent event = new MeetingMemberEvent(meetingId, memberName);
        log.info("Broadcasting member addition to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastMeetingMemberRemoved(UUID projectId, UUID meetingId, String memberName) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/member-removed";
        MeetingMemberEvent event = new MeetingMemberEvent(meetingId, memberName);
        log.info("Broadcasting member removal to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    // ==================== SUMMARY & DECISIONS OPERATIONS ====================
    
    public void broadcastSummaryGenerated(UUID projectId, UUID meetingId, Object summary) {
        String topic = "/topic/project/" + projectId + "/summary-generated";
        log.info("Broadcasting summary generation to {}", topic);
        messagingTemplate.convertAndSend(topic, summary);
    }
    
    public void broadcastDecisionCreated(UUID projectId, UUID meetingId, Object decision) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/decision-created";
        log.info("Broadcasting decision creation to {}", topic);
        messagingTemplate.convertAndSend(topic, decision);
    }
    
    public void broadcastDecisionUpdated(UUID projectId, UUID meetingId, Object decision) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/decision-updated";
        log.info("Broadcasting decision update to {}", topic);
        messagingTemplate.convertAndSend(topic, decision);
    }
    
    public void broadcastDecisionDeleted(UUID projectId, UUID meetingId, UUID decisionId) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/decision-deleted";
        EntityDeleteEvent event = new EntityDeleteEvent(decisionId);
        log.info("Broadcasting decision deletion to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastActionItemCreated(UUID projectId, UUID meetingId, Object actionItem) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/action-item-created";
        log.info("Broadcasting action item creation to {}", topic);
        messagingTemplate.convertAndSend(topic, actionItem);
    }
    
    public void broadcastActionItemUpdated(UUID projectId, UUID meetingId, Object actionItem) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/action-item-updated";
        log.info("Broadcasting action item update to {}", topic);
        messagingTemplate.convertAndSend(topic, actionItem);
    }
    
    public void broadcastActionItemDeleted(UUID projectId, UUID meetingId, UUID actionItemId) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/action-item-deleted";
        EntityDeleteEvent event = new EntityDeleteEvent(actionItemId);
        log.info("Broadcasting action item deletion to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    // ==================== APPROVAL OPERATIONS ====================
    
    public void broadcastApprovalStatusChanged(UUID projectId, UUID meetingId, Object status) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/approval-status-changed";
        log.info("Broadcasting approval status change to {}", topic);
        messagingTemplate.convertAndSend(topic, status);
    }
    
    public void broadcastActionItemApprovalChanged(UUID projectId, UUID meetingId, UUID actionItemId, String approvalStatus) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/action-item-approval-changed";
        ApprovalChangeEvent event = new ApprovalChangeEvent(actionItemId, approvalStatus);
        log.info("Broadcasting action item approval change to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastDecisionApprovalChanged(UUID projectId, UUID meetingId, UUID decisionId, String approvalStatus) {
        String topic = "/topic/project/" + projectId + "/meeting/" + meetingId + "/decision-approval-changed";
        ApprovalChangeEvent event = new ApprovalChangeEvent(decisionId, approvalStatus);
        log.info("Broadcasting decision approval change to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    // ==================== CHANGE REQUEST OPERATIONS ====================
    
    public void broadcastChangeCreated(UUID projectId, Object change) {
        String topic = "/topic/project/" + projectId + "/change-created";
        log.info("Broadcasting change creation to {}", topic);
        messagingTemplate.convertAndSend(topic, change);
    }
    
    public void broadcastChangeStatusChanged(UUID projectId, UUID changeId, String newStatus) {
        String topic = "/topic/project/" + projectId + "/change-status-changed";
        ChangeStatusEvent event = new ChangeStatusEvent(changeId, newStatus);
        log.info("Broadcasting change status change to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastChangeApprovalChanged(UUID projectId, UUID changeId, String decision, String feedback) {
        String topic = "/topic/project/" + projectId + "/change-approval-changed";
        ChangeApprovalEvent event = new ChangeApprovalEvent(changeId, decision, feedback);
        log.info("Broadcasting change approval change to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastChangeApplied(UUID projectId, UUID changeId) {
        String topic = "/topic/project/" + projectId + "/change-applied";
        ChangeAppliedEvent event = new ChangeAppliedEvent(changeId);
        log.info("Broadcasting change applied to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    // ==================== PROJECT & TEAM OPERATIONS ====================
    
    public void broadcastProjectCreated(Object project) {
        String topic = "/topic/workspace/project-created";
        log.info("Broadcasting project creation to {}", topic);
        messagingTemplate.convertAndSend(topic, project);
    }
    
    public void broadcastProjectUpdated(UUID projectId, Object project) {
        String topic = "/topic/project/" + projectId + "/project-updated";
        log.info("Broadcasting project update to {}", topic);
        messagingTemplate.convertAndSend(topic, project);
    }
    
    public void broadcastProjectDeleted(UUID projectId) {
        String topic = "/topic/workspace/project-deleted";
        EntityDeleteEvent event = new EntityDeleteEvent(projectId);
        log.info("Broadcasting project deletion to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastTeamMemberAdded(UUID projectId, Object member) {
        String topic = "/topic/project/" + projectId + "/member-added";
        log.info("Broadcasting team member addition to {}", topic);
        messagingTemplate.convertAndSend(topic, member);
    }
    
    public void broadcastTeamMemberRemoved(UUID projectId, UUID memberId) {
        String topic = "/topic/project/" + projectId + "/member-removed";
        EntityDeleteEvent event = new EntityDeleteEvent(memberId);
        log.info("Broadcasting team member removal to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    public void broadcastTeamMemberRoleChanged(UUID projectId, UUID memberId, String newRole) {
        String topic = "/topic/project/" + projectId + "/member-role-changed";
        MemberRoleChangeEvent event = new MemberRoleChangeEvent(memberId, newRole);
        log.info("Broadcasting team member role change to {}", topic);
        messagingTemplate.convertAndSend(topic, event);
    }
    
    // ==================== EVENT CLASSES ====================
    
    public static class MeetingMemberEvent {
        public UUID meetingId;
        public String memberName;
    
        public MeetingMemberEvent(UUID meetingId, String memberName) {
            this.meetingId = meetingId;
            this.memberName = memberName;
        }
    }
    
    public static class EntityDeleteEvent {
        public UUID entityId;
    
        public EntityDeleteEvent(UUID entityId) {
            this.entityId = entityId;
        }
    }
    
    public static class ApprovalChangeEvent {
        public UUID entityId;
        public String status;
    
        public ApprovalChangeEvent(UUID entityId, String status) {
            this.entityId = entityId;
            this.status = status;
        }
    }
    
    public static class ChangeStatusEvent {
        public UUID changeId;
        public String newStatus;
    
        public ChangeStatusEvent(UUID changeId, String newStatus) {
            this.changeId = changeId;
            this.newStatus = newStatus;
        }
    }
    
    public static class ChangeApprovalEvent {
        public UUID changeId;
        public String decision;
        public String feedback;
    
        public ChangeApprovalEvent(UUID changeId, String decision, String feedback) {
            this.changeId = changeId;
            this.decision = decision;
            this.feedback = feedback;
        }
    }
    
    public static class ChangeAppliedEvent {
        public UUID changeId;
    
        public ChangeAppliedEvent(UUID changeId) {
            this.changeId = changeId;
        }
    }
    
    public static class MemberRoleChangeEvent {
        public UUID memberId;
        public String newRole;
    
        public MemberRoleChangeEvent(UUID memberId, String newRole) {
            this.memberId = memberId;
            this.newRole = newRole;
        }
    }
}
