import { useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { useProjectStore } from '../store/projectStore';
import { WS_ENDPOINT } from '../services/runtimeConfig';

interface CardDTO {
  id: string;
  title: string;
  description?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  stageId: string;
  assigneeId?: string;
  assigneeName?: string;
  createdDate?: string;
}

interface StageDTO {
  id: string;
  title: string;
  color?: string;
}

interface CardDeleteEvent {
  cardId: string;
  stageId: string;
}

interface CardMoveEvent {
  cardData: CardDTO;
}

interface StageDeleteEvent {
  stageId: string;
}

interface TeamMemberRemovedEvent {
  memberId: string;
}

interface TeamMemberRoleChangedEvent {
  memberId: string;
  newRole: string;
}

export const useWebSocketBoardUpdates = (boardId: string | null, projectId: string | null = null) => {
  const stompClientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);

  const {
    updateCardFromRealTime,
    deleteCardFromRealTime,
    addCardToBoard,
    deleteStageFromBoard,
    updateStageFromRealTime,
    addStageToBoard,
    addTeamMemberToProject,
    removeTeamMemberFromProject,
    updateTeamMemberRole,
  } = useProjectStore();

  useEffect(() => {
    if (!boardId) {
      console.log('[WS] No boardId, skipping websocket connection');
      return;
    }

    console.log('[WS] useEffect triggered with boardId:', boardId, 'projectId:', projectId);

    const connectWebSocket = () => {
      try {
        console.log('[WS] Attempting to connect to', WS_ENDPOINT);
        const stompClient = new Client({
          webSocketFactory: () => {
            console.log('[WS] Creating SockJS connection');
            return new SockJS(WS_ENDPOINT);
          },
          reconnectDelay: 3000,
          debug: (msg) => {
            console.log('[WS-DEBUG]', msg);
          },
          onConnect: (frame) => {
            console.log('[WS] Connected successfully', frame);
            const subscribe = (destination: string, onMessage: (message: IMessage) => void) => {
              console.log('[WS] Subscribing to', destination);
              const sub = stompClient.subscribe(destination, (msg) => {
                console.log('[WS] Message received on', destination, msg.body);
                onMessage(msg);
              });
              subscriptionsRef.current.push(sub);
            };

            subscribe(`/topic/board/${boardId}/stage/+/card-created`, (message) => {
              console.log('[WS] card-created handler called');
              const cardData: CardDTO = JSON.parse(message.body);
              console.log('[WS] parsed cardData:', cardData);
              addCardToBoard(cardData);
              console.log('[WS] addCardToBoard called');
            });

            subscribe(`/topic/board/${boardId}/stage/+/card-updated`, (message) => {
              console.log('[WS] card-updated handler called');
              const cardData: CardDTO = JSON.parse(message.body);
              console.log('[WS] parsed cardData:', cardData);
              updateCardFromRealTime(cardData);
              console.log('[WS] updateCardFromRealTime called');
            });

            subscribe(`/topic/board/${boardId}/card-moved`, (message) => {
              console.log('[WS] card-moved handler called');
              const moveEvent: CardMoveEvent = JSON.parse(message.body);
              console.log('[WS] parsed moveEvent:', moveEvent);
              // Use cardData but set the stageId from toStageId
              const cardWithStage = {
                ...moveEvent.cardData,
                stageId: moveEvent.toStageId,
              };
              console.log('[WS] cardWithStage:', cardWithStage);
              updateCardFromRealTime(cardWithStage);
              console.log('[WS] updateCardFromRealTime called for moved card');
            });

            subscribe(`/topic/board/${boardId}/stage/+/card-deleted`, (message) => {
              console.log('[WS] card-deleted handler called');
              const deleteEvent: CardDeleteEvent = JSON.parse(message.body);
              console.log('[WS] parsed deleteEvent:', deleteEvent);
              deleteCardFromRealTime(deleteEvent.stageId, deleteEvent.cardId);
              console.log('[WS] deleteCardFromRealTime called');
            });

            subscribe(`/topic/board/${boardId}/stage-created`, (message) => {
              console.log('[WS] stage-created handler called');
              const stageData: StageDTO = JSON.parse(message.body);
              console.log('[WS] parsed stageData:', stageData);
              addStageToBoard(stageData);
              console.log('[WS] addStageToBoard called');
            });

            subscribe(`/topic/board/${boardId}/stage-updated`, (message) => {
              console.log('[WS] stage-updated handler called');
              const stageData: StageDTO = JSON.parse(message.body);
              console.log('[WS] parsed stageData:', stageData);
              updateStageFromRealTime(stageData);
              console.log('[WS] updateStageFromRealTime called');
            });

            subscribe(`/topic/board/${boardId}/stage-deleted`, (message) => {
              console.log('[WS] stage-deleted handler called');
              const deleteEvent: StageDeleteEvent = JSON.parse(message.body);
              console.log('[WS] parsed deleteEvent:', deleteEvent);
              deleteStageFromBoard(deleteEvent.stageId);
              console.log('[WS] deleteStageFromBoard called');
            });

            if (projectId) {
              subscribe(`/topic/project/${projectId}/meeting-created`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'meetings' } }));
              });

              subscribe(`/topic/project/${projectId}/meeting-updated`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'meetings' } }));
              });

              subscribe(`/topic/project/${projectId}/meeting-deleted`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'meetings' } }));
              });

              subscribe(`/topic/project/${projectId}/summary-generated`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'summary' } }));
              });

              subscribe(`/topic/project/${projectId}/change-created`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'changes' } }));
              });

              subscribe(`/topic/project/${projectId}/change-status-changed`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'changes' } }));
              });

              subscribe(`/topic/project/${projectId}/change-approval-changed`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'changes' } }));
              });

              subscribe(`/topic/project/${projectId}/change-applied`, () => {
                window.dispatchEvent(new CustomEvent('project-realtime-refresh', { detail: { projectId, scope: 'changes' } }));
              });

              subscribe(`/topic/project/${projectId}/member-added`, (message) => {
                const member = JSON.parse(message.body);
                const memberId = member.id || member.userId;
                if (memberId) {
                  addTeamMemberToProject(projectId, memberId, member);
                }
              });

              subscribe(`/topic/project/${projectId}/member-removed`, (message) => {
                const event: TeamMemberRemovedEvent = JSON.parse(message.body);
                removeTeamMemberFromProject(projectId, event.memberId);
              });

              subscribe(`/topic/project/${projectId}/member-role-changed`, (message) => {
                const event: TeamMemberRoleChangedEvent = JSON.parse(message.body);
                updateTeamMemberRole(projectId, event.memberId, event.newRole);
              });
            }

            console.log('[WS] All subscriptions created');
          },
          onWebSocketError: (error) => {
            console.error('[WS] WebSocket error:', error);
          },
          onDisconnect: (frame) => {
            console.log('[WS] Disconnected:', frame);
          },
        });

        stompClient.activate();
        stompClientRef.current = stompClient;
      } catch (error) {
        console.error('[WS] Setup error:', error);
      }
    };

    connectWebSocket();

    return () => {
      console.log('[WS] Cleanup: unsubscribing from', subscriptionsRef.current.length, 'subscriptions');
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];

      if (stompClientRef.current) {
        console.log('[WS] Cleanup: deactivating client');
        void stompClientRef.current.deactivate();
      }
    };
  }, [
    boardId,
    projectId,
    updateCardFromRealTime,
    deleteCardFromRealTime,
    addCardToBoard,
    deleteStageFromBoard,
    updateStageFromRealTime,
    addStageToBoard,
    addTeamMemberToProject,
    removeTeamMemberFromProject,
    updateTeamMemberRole,
  ]);
};
