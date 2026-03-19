package com.flowboard.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class RateLimitService {
    private final ConcurrentMap<String, Deque<Long>> requestLog = new ConcurrentHashMap<>();

    public void check(String key, int maxRequests, Duration window, String message) {
        long now = System.currentTimeMillis();
        long threshold = now - window.toMillis();

        Deque<Long> bucket = requestLog.computeIfAbsent(key, ignored -> new ArrayDeque<>());
        synchronized (bucket) {
            while (!bucket.isEmpty() && bucket.peekFirst() < threshold) {
                bucket.pollFirst();
            }

            if (bucket.size() >= maxRequests) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, message);
            }

            bucket.addLast(now);
        }
    }
}
