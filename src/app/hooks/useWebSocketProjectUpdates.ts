import { useEffect, useRef } from 'react';
import SockJS from 'sockjs-client';
import { Client, StompSubscription } from '@stomp/stompjs';
import { ENABLE_REALTIME, WS_ENDPOINT } from '../services/runtimeConfig';

/**
 * Hook for real-time project list updates via WebSocket
 * Subscribes to project creation, update, and deletion events
 * Triggers a refresh callback when changes occur
 * Dynamically subscribes to individual project updates
 */
export const useWebSocketProjectUpdates = (onProjectsChanged: () => void, projectIds?: string[]) => {
  const stompClientRef = useRef<Client | null>(null);
  const subscriptionsRef = useRef<StompSubscription[]>([]);
  const projectSubscriptionsRef = useRef<Map<string, StompSubscription>>(new Map());
  const isConnectedRef = useRef(false);
  const projectIdsRef = useRef<string[] | undefined>(projectIds);

  const shouldSkipRealtime = () => {
    if (!ENABLE_REALTIME) {
      return true;
    }

    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && WS_ENDPOINT.startsWith('http://')) {
      return true;
    }

    return false;
  };

  // Update projectIds ref whenever it changes
  useEffect(() => {
    projectIdsRef.current = projectIds;
  }, [projectIds]);

  // Subscribe to project-specific updates
  const subscribeToProjects = (projects?: string[]) => {
    if (!stompClientRef.current || !isConnectedRef.current || !projects) {
      return;
    }

    console.log('[WS-Projects] Updating individual project subscriptions for', projects.length, 'projects');

    // Unsubscribe from projects that are no longer in the list
    projectSubscriptionsRef.current.forEach((sub, projectId) => {
      if (!projects.includes(projectId)) {
        console.log('[WS-Projects] Unsubscribing from project', projectId);
        sub.unsubscribe();
        projectSubscriptionsRef.current.delete(projectId);
      }
    });

    // Subscribe to new projects
    projects.forEach((projectId) => {
      if (!projectSubscriptionsRef.current.has(projectId)) {
        try {
          const destination = `/topic/project/${projectId}/project-updated`;
          console.log('[WS-Projects] Subscribing to project update:', destination);
          const sub = stompClientRef.current!.subscribe(destination, () => {
            console.log('[WS-Projects] Project update received for', projectId);
            onProjectsChanged();
          });
          projectSubscriptionsRef.current.set(projectId, sub);
        } catch (error) {
          console.error('[WS-Projects] Failed to subscribe to project', projectId, error);
        }
      }
    });

    console.log('[WS-Projects] Individual project subscriptions updated');
  };

  useEffect(() => {
    if (shouldSkipRealtime()) {
      console.warn('[WS-Projects] Realtime disabled for current runtime configuration.');
      return;
    }

    const connectWebSocket = () => {
      try {
        console.log('[WS-Projects] Attempting to connect to', WS_ENDPOINT);
        const token = localStorage.getItem('authToken');
        
        const stompClient = new Client({
          webSocketFactory: () => {
            console.log('[WS-Projects] Creating SockJS connection');
            return new SockJS(WS_ENDPOINT);
          },
          connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
          reconnectDelay: 3000,
          debug: (msg) => {
            console.log('[WS-Projects-DEBUG]', msg);
          },
          onConnect: (frame) => {
            console.log('[WS-Projects] Connected successfully', frame);
            isConnectedRef.current = true;

            const subscribe = (destination: string) => {
              console.log('[WS-Projects] Subscribing to', destination);
              const sub = stompClient.subscribe(destination, () => {
                console.log('[WS-Projects] Message received on', destination);
                onProjectsChanged();
              });
              subscriptionsRef.current.push(sub);
            };

            // Subscribe to workspace-level project lifecycle events
            subscribe(`/topic/workspace/project-created`);
            subscribe(`/topic/workspace/project-deleted`);

            console.log('[WS-Projects] Workspace-level subscriptions created');

            // Subscribe to any projects that were provided before connection
            subscribeToProjects(projectIdsRef.current);
          },
          onWebSocketError: (error) => {
            console.error('[WS-Projects] WebSocket error:', error);
          },
          onDisconnect: (frame) => {
            console.log('[WS-Projects] Disconnected:', frame);
            isConnectedRef.current = false;
          },
        });

        stompClient.activate();
        stompClientRef.current = stompClient;
      } catch (error) {
        console.error('[WS-Projects] Setup error:', error);
      }
    };

    connectWebSocket();

    return () => {
      console.log('[WS-Projects] Cleanup: unsubscribing from', subscriptionsRef.current.length, 'subscriptions');
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];

      projectSubscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      projectSubscriptionsRef.current.clear();

      if (stompClientRef.current) {
        console.log('[WS-Projects] Cleanup: deactivating client');
        void stompClientRef.current.deactivate();
      }
    };
  }, [onProjectsChanged]);

  // Subscribe to individual project updates whenever projectIds change
  useEffect(() => {
    subscribeToProjects(projectIds);
  }, [projectIds]);
};
