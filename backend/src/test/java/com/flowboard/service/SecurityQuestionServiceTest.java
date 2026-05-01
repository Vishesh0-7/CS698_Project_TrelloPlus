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

    // Edge Cases

    @Test
    void testNormalizeAnswerWithSpecialCharacters() {
        assertEquals("john doe", securityQuestionService.normalizeAnswer("John, Doe!"));
        assertEquals("pt", securityQuestionService.normalizeAnswer("P@t"));
        assertEquals("helloworld", securityQuestionService.normalizeAnswer("Hello@#$World!!!"));
    }

    @Test
    void testNormalizeAnswerWithMultipleSpaces() {
        assertEquals("a b c", securityQuestionService.normalizeAnswer("a    b    c"));
        assertEquals("", securityQuestionService.normalizeAnswer("   "));
    }

    @Test
    void testNormalizeAnswerVeryLong() {
        String longAnswer = "a".repeat(500);
        String result = securityQuestionService.normalizeAnswer(longAnswer);
        assertEquals(longAnswer, result);
    }

    @Test
    void testNormalizeAnswerWithNumbers() {
        assertEquals("born 1990", securityQuestionService.normalizeAnswer("Born 1990"));
        assertEquals("123", securityQuestionService.normalizeAnswer("123"));
    }

    @Test
    void testRateLimitAtExactBoundary() {
        // Exactly at 3 attempts (should be rate limited)
        assertTrue(securityQuestionService.isRateLimited(3, LocalDateTime.now()));
    }

    @Test
    void testRateLimitBoundaryTime() {
        LocalDateTime now = LocalDateTime.now();
        
        // 1 second before 15 minute mark (should still be limited)
        LocalDateTime before15Minutes = now.minusMinutes(15).plusSeconds(1);
        assertTrue(securityQuestionService.isRateLimited(3, before15Minutes));
        
        // More than 15 minutes have passed (should be unlocked)
        LocalDateTime after15Minutes = now.minusMinutes(15).minusSeconds(2);
        assertFalse(securityQuestionService.isRateLimited(3, after15Minutes));
    }

    @Test
    void testNormalizeAnswerEmptyAndNull() {
        assertEquals("", securityQuestionService.normalizeAnswer(null));
        assertEquals("", securityQuestionService.normalizeAnswer(""));
        assertEquals("", securityQuestionService.normalizeAnswer("   "));
        assertEquals("", securityQuestionService.normalizeAnswer("\t\n"));
    }

    @Test
    void testGetSystemQuestionBoundaries() {
        // First question
        String first = securityQuestionService.getSystemQuestion(0);
        assertNotNull(first);
        
        // Last question
        String last = securityQuestionService.getSystemQuestion(11);
        assertNotNull(last);
        
        // Should throw for out of bounds
        assertThrows(IllegalArgumentException.class, () -> securityQuestionService.getSystemQuestion(-1));
        assertThrows(IllegalArgumentException.class, () -> securityQuestionService.getSystemQuestion(12));
    }

    @Test
    void testRateLimitWithNullAttempts() {
        // Null attempts should not be rate limited
        assertFalse(securityQuestionService.isRateLimited(null, LocalDateTime.now()));
        assertFalse(securityQuestionService.isRateLimited(null, null));
    }

    @Test
    void testRateLimitResetTimeCalculation() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime resetTime = securityQuestionService.getRateLimitResetTime(now);
        
        // Should be exactly 15 minutes in the future
        long minutesDiff = java.time.temporal.ChronoUnit.MINUTES.between(now, resetTime);
        assertEquals(15, minutesDiff);
    }

    @Test
    void testConcurrentRateLimitChecks() throws InterruptedException {
        LocalDateTime recentTime = LocalDateTime.now().minusMinutes(5);
        
        // Simulate concurrent checks
        java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(10);
        java.util.List<Boolean> results = new java.util.concurrent.CopyOnWriteArrayList<>();
        
        for (int i = 0; i < 10; i++) {
            new Thread(() -> {
                results.add(securityQuestionService.isRateLimited(3, recentTime));
                latch.countDown();
            }).start();
        }
        
        latch.await();
        
        // All should return true (rate limited)
        assertTrue(results.stream().allMatch(r -> r));
    }

    @Test
    void testNormalizeAnswerConsistency() {
        String original = "My Answer123!";
        String normalized1 = securityQuestionService.normalizeAnswer(original);
        String normalized2 = securityQuestionService.normalizeAnswer(original);
        
        // Should normalize consistently
        assertEquals(normalized1, normalized2);
    }

    @Test
    void testAnswerNormalizationPreservesOrder() {
        // Character order should be preserved, but spaces are kept between words
        assertEquals("a b c", securityQuestionService.normalizeAnswer("A B C"));
        assertEquals("abc", securityQuestionService.normalizeAnswer("ABC"));
        assertNotEquals("cba", securityQuestionService.normalizeAnswer("A B C"));
    }

    @Test
    void testMaxFailedAttemptsConstant() {
        int maxAttempts = securityQuestionService.getMaxFailedAttempts();
        assertEquals(3, maxAttempts);
        
        // After max attempts, should be rate limited
        assertTrue(securityQuestionService.isRateLimited(maxAttempts, LocalDateTime.now()));
        
        // Before max attempts, should not be rate limited
        assertFalse(securityQuestionService.isRateLimited(maxAttempts - 1, LocalDateTime.now()));
    }
}
