package com.flowboard.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

/**
 * WebSocket configuration for real-time board updates using STOMP protocol.
 * Enables bi-directional communication between frontend and backend for:
 * - Board stage changes
 * - Card operations (create, update, move, delete)
 * - Real-time synchronization across multiple users
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Value("${app.cors.allowed-origins:http://localhost:*,http://127.0.0.1:*}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable a simple in-memory message broker for /topic destinations
        // In production, consider using RabbitMQ or other external broker for scalability
        config.enableSimpleBroker("/topic");
        
        // Set the prefix for client-to-server messages (/app)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register WebSocket endpoint that clients connect to
        // Supports both WebSocket and SockJS fallback transports
        registry.addEndpoint("/ws/board")
                .setAllowedOriginPatterns(Arrays.stream(allowedOrigins.split(","))
                        .map(String::trim)
                        .toArray(String[]::new))
                .withSockJS();  // Fallback for browsers without WebSocket support
    }
}
