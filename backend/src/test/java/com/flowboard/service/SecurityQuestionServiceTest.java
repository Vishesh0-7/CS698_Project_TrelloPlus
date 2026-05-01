package com.flowboard.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

class SecurityQuestionServiceTest {
    private SecurityQuestionService securityQuestionService;

    @BeforeEach
    void setUp() {
        securityQuestionService = new SecurityQuestionService();
    }

    @Test
    void testGetSystemQuestions() {
        var questions = securityQuestionService.getSystemQuestions();
        assertNotNull(questions);
        assertEquals(12, questions.size());
        assertTrue(questions.contains("Name a teacher or mentor who inspired you"));
    }

    @Test
    void testGetSystemQuestion() {
        String question = securityQuestionService.getSystemQuestion(0);
        assertEquals("Name a teacher or mentor who inspired you", question);
    }

    @Test
    void testGetSystemQuestionInvalidIndex() {
        assertThrows(IllegalArgumentException.class, () -> {
            securityQuestionService.getSystemQuestion(999);
        });
    }

    @Test
    void testNormalizeAnswer() {
        assertEquals("john doe", securityQuestionService.normalizeAnswer("John Doe"));
        assertEquals("john doe", securityQuestionService.normalizeAnswer("  John   Doe  "));
        assertEquals("john doe", securityQuestionService.normalizeAnswer("John, Doe!"));
        assertEquals("", securityQuestionService.normalizeAnswer(null));
        assertEquals("", securityQuestionService.normalizeAnswer(""));
    }

    @Test
    void testFuzzyMatch() {
        String normalized = securityQuestionService.normalizeAnswer("My Pet");
        String hashed = normalized; // In real scenario, this would be hashed
        
        // This tests the normalization; actual hashing would be done by PasswordEncoder
        assertEquals("my pet", normalized);
    }

    @Test
    void testIsRateLimitedNotExceeded() {
        assertFalse(securityQuestionService.isRateLimited(0, LocalDateTime.now()));
        assertFalse(securityQuestionService.isRateLimited(2, LocalDateTime.now()));
        assertFalse(securityQuestionService.isRateLimited(null, LocalDateTime.now()));
    }

    @Test
    void testIsRateLimitedExceededButExpired() {
        LocalDateTime pastTime = LocalDateTime.now().minusMinutes(20);
        assertFalse(securityQuestionService.isRateLimited(3, pastTime));
    }

    @Test
    void testIsRateLimitedExceededAndActive() {
        LocalDateTime recentTime = LocalDateTime.now().minusMinutes(5);
        assertTrue(securityQuestionService.isRateLimited(3, recentTime));
    }

    @Test
    void testGetRateLimitResetTime() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime resetTime = securityQuestionService.getRateLimitResetTime(now);
        assertNotNull(resetTime);
        assertEquals(resetTime, now.plusMinutes(15));
    }

    @Test
    void testGetRateLimitResetTimeNull() {
        LocalDateTime resetTime = securityQuestionService.getRateLimitResetTime(null);
        assertNull(resetTime);
    }

    @Test
    void testGetMaxFailedAttempts() {
        assertEquals(3, securityQuestionService.getMaxFailedAttempts());
    }

    @Test
    void testGetRateLimitMinutes() {
        assertEquals(15, securityQuestionService.getRateLimitMinutes());
    }
}
