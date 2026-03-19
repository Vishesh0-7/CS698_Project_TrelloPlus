package com.flowboard.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class IdempotencyService {
    private final ConcurrentMap<String, Long> keys = new ConcurrentHashMap<>();

    public void ensureUnique(String scopeKey, Duration ttl, String conflictMessage) {
        long now = System.currentTimeMillis();
        long expiry = now + ttl.toMillis();

        keys.entrySet().removeIf(entry -> entry.getValue() < now);
        Long existing = keys.putIfAbsent(scopeKey, expiry);
        if (existing != null && existing >= now) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, conflictMessage);
        }
    }
}
