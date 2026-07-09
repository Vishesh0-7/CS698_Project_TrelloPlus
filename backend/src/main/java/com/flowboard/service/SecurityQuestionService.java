package com.flowboard.service;

import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@Service
public class SecurityQuestionService {
    private static final List<String> SYSTEM_QUESTIONS = Arrays.asList(
        "Name a teacher or mentor who inspired you",
        "What's the name of your favorite book character?",
        "First place you traveled outside your home country?",
        "Name a company you've always wanted to work for",
        "What's a skill you wish you had?",
        "Name a movie that made you cry or deeply moved you",
        "What's the name of your childhood best friend?",
        "Name a book that changed your perspective",
        "What was your first job?",
        "Name a person who changed your life",
        "What's your favorite sport to play or watch?",
        "Name a place that makes you feel at peace"
    );

    private static final int MAX_FAILED_ATTEMPTS = 3;
    private static final long RATE_LIMIT_MINUTES = 15;

    public List<String> getSystemQuestions() {
        return SYSTEM_QUESTIONS;
    }

    public String getSystemQuestion(int index) {
        if (index < 0 || index >= SYSTEM_QUESTIONS.size()) {
            throw new IllegalArgumentException("Invalid question index");
        }
        return SYSTEM_QUESTIONS.get(index);
    }

    public boolean fuzzyMatch(String userAnswer, String storedHash, String passwordEncoder) {
        if (userAnswer == null || userAnswer.isBlank() || storedHash == null) {
            return false;
        }

        String normalizedAnswer = normalizeAnswer(userAnswer);
        return normalizedAnswer.equalsIgnoreCase(storedHash);
    }

    public String normalizeAnswer(String answer) {
        if (answer == null) {
            return "";
        }

        return answer.trim()
            .toLowerCase()
            .replaceAll("\\s+", " ")
            .replaceAll("[^a-z0-9 ]", "");
    }

    public boolean isRateLimited(Integer failedAttempts, LocalDateTime lastAttemptTime) {
        if (failedAttempts == null || failedAttempts < MAX_FAILED_ATTEMPTS) {
            return false;
        }

        if (lastAttemptTime == null) {
            return true;
        }

        LocalDateTime rateLimitExpiry = lastAttemptTime.plusMinutes(RATE_LIMIT_MINUTES);
        return LocalDateTime.now().isBefore(rateLimitExpiry);
    }

    public LocalDateTime getRateLimitResetTime(LocalDateTime lastAttemptTime) {
        if (lastAttemptTime == null) {
            return null;
        }
        return lastAttemptTime.plusMinutes(RATE_LIMIT_MINUTES);
    }

    public int getMaxFailedAttempts() {
        return MAX_FAILED_ATTEMPTS;
    }

    public long getRateLimitMinutes() {
        return RATE_LIMIT_MINUTES;
    }
}
