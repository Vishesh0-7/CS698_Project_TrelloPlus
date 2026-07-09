package com.flowboard.service;

import com.flowboard.dto.*;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JWTService jwtService;
    private final SecurityQuestionService securityQuestionService;
    private final ConcurrentHashMap<String, PasswordResetSession> resetSessions = new ConcurrentHashMap<>();

    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.getEmail());
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
        }

        validatePasswordBusinessRules(request.getPassword(), email, request.getFullName());

        String username = resolveUsername(request);

        User user = User.builder()
            .email(email)
            .username(username)
            .fullName(request.getFullName().trim())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .role(User.UserRole.MEMBER)
            .build();

        user = userRepository.save(user);
        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().toString());

        return AuthResponse.builder()
            .token(token)
            .expiresIn(jwtService.getExpirationTime(token))
            .user(toUserDTO(user))
            .build();
    }

    private String resolveUsername(RegisterRequest request) {
        String rawUsername = request.getUsername();

        if (rawUsername == null || rawUsername.isBlank()) {
            rawUsername = request.getFullName();
        }

        if (rawUsername == null || rawUsername.isBlank()) {
            rawUsername = request.getEmail() != null ? normalizeEmail(request.getEmail()).split("@")[0] : "user";
        }

        String base = rawUsername
            .trim()
            .toLowerCase()
            .replaceAll("[^a-z0-9]+", "_")
            .replaceAll("^_+|_+$", "");

        if (base.isBlank()) {
            base = "user";
        }

        String candidate = base;
        int suffix = 1;
        while (userRepository.findByUsername(candidate).isPresent()) {
            candidate = base + "_" + suffix;
            suffix++;
        }

        return candidate;
    }

    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.getEmail());
        User user = userRepository.findFirstByEmailOrderByCreatedAtDesc(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        String token = jwtService.generateToken(user.getId(), user.getEmail(), user.getRole().toString());

        return AuthResponse.builder()
            .token(token)
            .expiresIn(jwtService.getExpirationTime(token))
            .user(toUserDTO(user))
            .build();
    }

    public User getUserById(String userId) {
        return userRepository.findById(java.util.UUID.fromString(userId))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    public UserDTO getUserProfile(String userId) {
        User user = getUserById(userId);
        return toUserDTO(user);
    }

    public UserDTO updateUserProfile(String userId, UpdateUserProfileRequest request) {
        User user = getUserById(userId);
        
        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }
        
        user = userRepository.save(user);
        return toUserDTO(user);
    }

    private UserDTO toUserDTO(User user) {
        return UserDTO.builder()
            .id(user.getId())
            .email(user.getEmail())
            .username(user.getUsername())
            .fullName(user.getFullName())
            .role(user.getRole().toString())
            .createdAt(user.getCreatedAt())
            .build();
    }

    public void logout(String token) {
        jwtService.revokeToken(token);
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private void validatePasswordBusinessRules(String password, String email, String fullName) {
        String passwordLower = password.toLowerCase();
        if (email != null && passwordLower.contains(email.toLowerCase())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must not contain email");
        }

        if (fullName != null) {
            String nameToken = fullName.trim().toLowerCase().replace(" ", "");
            if (!nameToken.isEmpty() && passwordLower.contains(nameToken)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must not contain full name");
            }
        }
    }

    public void setSecurityQuestions(String userId, SetSecurityQuestionsRequest request) {
        User user = getUserById(userId);

        if (hasConfiguredSecurityQuestions(user)) {
            if (request.getCurrentPassword() == null || request.getCurrentPassword().isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Current password is required to update security questions");
            }

            if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Current password is incorrect");
            }
        }

        user.setSecurityQuestion1(request.getSecurityQuestion1());
        user.setSecurityAnswer1Hash(passwordEncoder.encode(securityQuestionService.normalizeAnswer(request.getSecurityAnswer1())));

        user.setSecurityQuestion2(request.getSecurityQuestion2());
        user.setSecurityAnswer2Hash(passwordEncoder.encode(securityQuestionService.normalizeAnswer(request.getSecurityAnswer2())));

        user.setCustomSecurityQuestion(request.getCustomSecurityQuestion());
        user.setCustomSecurityAnswerHash(passwordEncoder.encode(securityQuestionService.normalizeAnswer(request.getCustomSecurityAnswer())));

        user.setFailedSecurityAttempts(0);
        user.setLastSecurityAttemptTime(null);

        userRepository.save(user);
    }

    private boolean hasConfiguredSecurityQuestions(User user) {
        return user.getSecurityQuestion1() != null
            && user.getSecurityAnswer1Hash() != null
            && user.getSecurityQuestion2() != null
            && user.getSecurityAnswer2Hash() != null
            && user.getCustomSecurityQuestion() != null
            && user.getCustomSecurityAnswerHash() != null;
    }

    public Map<String, Object> getSecurityQuestionsForUserId(String userId) {
        User user = getUserById(userId);

        if (!hasConfiguredSecurityQuestions(user)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Security questions are not configured. Please contact support or log in to configure them.");
        }

        return toSecurityQuestionsResponse(user);
    }

    public Map<String, Object> getSecurityQuestionsForUser(String email) {
        String normalizedEmail = normalizeEmail(email);
        User user = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (!hasConfiguredSecurityQuestions(user)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Security questions are not configured. Please contact support or log in to configure them.");
        }

        return toSecurityQuestionsResponse(user);
    }

    private Map<String, Object> toSecurityQuestionsResponse(User user) {
        Map<String, Object> response = new HashMap<>();
        response.put("question1", user.getSecurityQuestion1());
        response.put("question2", user.getSecurityQuestion2());
        response.put("customQuestion", user.getCustomSecurityQuestion());

        return response;
    }

    public PasswordResetTokenResponse validateSecurityAnswers(ValidateSecurityAnswersRequest request) {
        String normalizedEmail = normalizeEmail(request.getEmail());
        User user = userRepository.findFirstByEmailOrderByCreatedAtDesc(normalizedEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (user.getSecurityAnswer1Hash() == null
            || user.getSecurityAnswer2Hash() == null
            || user.getCustomSecurityAnswerHash() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Security questions are not configured. Please contact support or log in to configure them.");
        }

        if (securityQuestionService.isRateLimited(user.getFailedSecurityAttempts(), user.getLastSecurityAttemptTime())) {
            LocalDateTime resetTime = securityQuestionService.getRateLimitResetTime(user.getLastSecurityAttemptTime());
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, 
                "Too many failed attempts. Please try again after " + resetTime);
        }

        Map<String, String> answers = request.getAnswers();
        if (answers == null || answers.size() != 3) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All three answers are required");
        }

        String answer1 = answers.get("answer1");
        String answer2 = answers.get("answer2");
        String customAnswer = answers.get("customAnswer");

        if (answer1 == null || answer2 == null || customAnswer == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All three answers are required");
        }

        String normalizedAnswer1 = securityQuestionService.normalizeAnswer(answer1);
        String normalizedAnswer2 = securityQuestionService.normalizeAnswer(answer2);
        String normalizedCustomAnswer = securityQuestionService.normalizeAnswer(customAnswer);

        boolean isAnswer1Correct = passwordEncoder.matches(normalizedAnswer1, user.getSecurityAnswer1Hash());
        boolean isAnswer2Correct = passwordEncoder.matches(normalizedAnswer2, user.getSecurityAnswer2Hash());
        boolean isCustomAnswerCorrect = passwordEncoder.matches(normalizedCustomAnswer, user.getCustomSecurityAnswerHash());

        if (!isAnswer1Correct || !isAnswer2Correct || !isCustomAnswerCorrect) {
            int failedAttempts = user.getFailedSecurityAttempts() == null ? 0 : user.getFailedSecurityAttempts();
            user.setFailedSecurityAttempts(failedAttempts + 1);
            user.setLastSecurityAttemptTime(LocalDateTime.now());
            userRepository.save(user);

            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "One or more answers are incorrect");
        }

        user.setFailedSecurityAttempts(0);
        user.setLastSecurityAttemptTime(null);
        userRepository.save(user);

        String resetToken = generateResetToken(user.getId().toString());
        return PasswordResetTokenResponse.builder()
            .resetToken(resetToken)
            .message("Security questions verified. You can now reset your password.")
            .build();
    }

    public void resetPasswordWithToken(ResetPasswordRequest request) {
        String userId = validateResetToken(request.getResetToken());
        User user = getUserById(userId);

        validatePasswordBusinessRules(request.getNewPassword(), user.getEmail(), user.getFullName());

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        invalidateResetToken(request.getResetToken());
    }

    private String generateResetToken(String userId) {
        String token = java.util.UUID.randomUUID().toString();
        PasswordResetSession session = new PasswordResetSession(userId, LocalDateTime.now().plusHours(1));
        resetSessions.put(token, session);
        return token;
    }

    private String validateResetToken(String token) {
        PasswordResetSession session = resetSessions.get(token);
        if (session == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired reset token");
        }

        if (LocalDateTime.now().isAfter(session.expiresAt)) {
            resetSessions.remove(token);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Reset token has expired");
        }

        return session.userId;
    }

    private void invalidateResetToken(String token) {
        resetSessions.remove(token);
    }

    private static class PasswordResetSession {
        String userId;
        LocalDateTime expiresAt;

        PasswordResetSession(String userId, LocalDateTime expiresAt) {
            this.userId = userId;
            this.expiresAt = expiresAt;
        }
    }
}
