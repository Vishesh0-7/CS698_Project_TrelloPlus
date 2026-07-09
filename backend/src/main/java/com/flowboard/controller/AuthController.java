package com.flowboard.controller;

import com.flowboard.dto.*;
import com.flowboard.service.AuthService;
import com.flowboard.service.JWTService;
import com.flowboard.service.RateLimitService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.UUID;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;
    private final JWTService jwtService;
    private final RateLimitService rateLimitService;

    @Value("${app.rate-limit.auth.register.max-attempts:5}")
    private int registerMaxAttempts;

    @Value("${app.rate-limit.auth.register.window-minutes:15}")
    private int registerWindowMinutes;

    @Value("${app.rate-limit.auth.login.max-failed-attempts:10}")
    private int loginMaxFailedAttempts;

    @Value("${app.rate-limit.auth.login.window-minutes:15}")
    private int loginWindowMinutes;

    @Value("${app.rate-limit.auth.security-questions.setup.max-attempts:5}")
    private int securityQuestionSetupMaxAttempts;

    @Value("${app.rate-limit.auth.security-questions.setup.window-minutes:15}")
    private int securityQuestionSetupWindowMinutes;

    @Value("${app.rate-limit.auth.security-questions.lookup.max-attempts:10}")
    private int securityQuestionLookupMaxAttempts;

    @Value("${app.rate-limit.auth.security-questions.lookup.window-minutes:15}")
    private int securityQuestionLookupWindowMinutes;

    @Value("${app.rate-limit.auth.forgot-password.validate.max-attempts:5}")
    private int forgotPasswordValidateMaxAttempts;

    @Value("${app.rate-limit.auth.forgot-password.validate.window-minutes:15}")
    private int forgotPasswordValidateWindowMinutes;

    @Value("${app.rate-limit.auth.forgot-password.reset.max-attempts:5}")
    private int resetPasswordMaxAttempts;

    @Value("${app.rate-limit.auth.forgot-password.reset.window-minutes:15}")
    private int resetPasswordWindowMinutes;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(
        @Valid @RequestBody RegisterRequest request,
        HttpServletRequest httpRequest
    ) {
        rateLimitService.check(
            "register:ip:" + httpRequest.getRemoteAddr(),
            registerMaxAttempts,
            Duration.ofMinutes(registerWindowMinutes),
            "Too many registration attempts. Please try again later."
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
        @Valid @RequestBody LoginRequest request,
        HttpServletRequest httpRequest
    ) {
        String ipKey = "login:ip:" + httpRequest.getRemoteAddr();
        String emailKey = "login:email:" + request.getEmail().trim().toLowerCase();

        rateLimitService.assertNotLimited(
            ipKey,
            loginMaxFailedAttempts,
            Duration.ofMinutes(loginWindowMinutes),
            "Too many failed attempts in a short period. Please try again later."
        );
        rateLimitService.assertNotLimited(
            emailKey,
            loginMaxFailedAttempts,
            Duration.ofMinutes(loginWindowMinutes),
            "Too many failed attempts for this account. Please try again later."
        );

        try {
            return ResponseEntity.ok(authService.login(request));
        } catch (ResponseStatusException ex) {
            HttpStatusCode status = ex.getStatusCode();
            if (status.value() == HttpStatus.UNAUTHORIZED.value()) {
                rateLimitService.record(ipKey);
                rateLimitService.record(emailKey);
            }
            throw ex;
        }
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String authHeader) {
        String token = jwtService.extractBearerToken(authHeader);
        authService.logout(token);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/profile")
    public ResponseEntity<UserDTO> getProfile(@RequestHeader("Authorization") String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return ResponseEntity.ok(authService.getUserProfile(userId.toString()));
    }

    @PutMapping("/profile")
    public ResponseEntity<UserDTO> updateProfile(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody UpdateUserProfileRequest request) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return ResponseEntity.ok(authService.updateUserProfile(userId.toString(), request));
    }

    @PostMapping("/security-questions")
    public ResponseEntity<Void> setSecurityQuestions(
        @RequestHeader("Authorization") String authHeader,
        @Valid @RequestBody SetSecurityQuestionsRequest request) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        rateLimitService.check(
            "security-questions:setup:user:" + userId,
            securityQuestionSetupMaxAttempts,
            Duration.ofMinutes(securityQuestionSetupWindowMinutes),
            "Too many security question updates. Please wait and try again later."
        );
        authService.setSecurityQuestions(userId.toString(), request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/security-questions/me")
    public ResponseEntity<java.util.Map<String, Object>> getMySecurityQuestions(
        @RequestHeader("Authorization") String authHeader) {
        UUID userId = jwtService.extractUserIdFromAuthHeader(authHeader);
        return ResponseEntity.ok(authService.getSecurityQuestionsForUserId(userId.toString()));
    }

    @GetMapping("/security-questions/{email}")
    public ResponseEntity<java.util.Map<String, Object>> getSecurityQuestions(
        @PathVariable String email,
        HttpServletRequest httpRequest) {
        String normalizedEmail = email.trim().toLowerCase();
        Duration lookupWindow = Duration.ofMinutes(securityQuestionLookupWindowMinutes);
        rateLimitService.check(
            "security-questions:lookup:ip:" + httpRequest.getRemoteAddr(),
            securityQuestionLookupMaxAttempts,
            lookupWindow,
            "Too many password recovery lookups. Please wait and try again later."
        );
        rateLimitService.check(
            "security-questions:lookup:email:" + normalizedEmail,
            securityQuestionLookupMaxAttempts,
            lookupWindow,
            "Too many password recovery lookups for this account. Please wait and try again later."
        );
        return ResponseEntity.ok(authService.getSecurityQuestionsForUser(email));
    }

    @PostMapping("/forgot-password/validate")
    public ResponseEntity<PasswordResetTokenResponse> validateSecurityAnswers(
        @Valid @RequestBody ValidateSecurityAnswersRequest request,
        HttpServletRequest httpRequest) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();
        Duration validationWindow = Duration.ofMinutes(forgotPasswordValidateWindowMinutes);
        rateLimitService.check(
            "forgot-password:ip:" + httpRequest.getRemoteAddr(),
            forgotPasswordValidateMaxAttempts,
            validationWindow,
            "Too many password reset attempts. Please try again later."
        );
        rateLimitService.check(
            "forgot-password:email:" + normalizedEmail,
            forgotPasswordValidateMaxAttempts,
            validationWindow,
            "Too many password reset attempts for this account. Please try again later."
        );
        return ResponseEntity.ok(authService.validateSecurityAnswers(request));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Void> resetPassword(
        @Valid @RequestBody ResetPasswordRequest request,
        HttpServletRequest httpRequest) {
        rateLimitService.check(
            "reset-password:ip:" + httpRequest.getRemoteAddr(),
            resetPasswordMaxAttempts,
            Duration.ofMinutes(resetPasswordWindowMinutes),
            "Too many password reset submissions. Please try again later."
        );
        rateLimitService.check(
            "reset-password:token:" + request.getResetToken(),
            resetPasswordMaxAttempts,
            Duration.ofMinutes(resetPasswordWindowMinutes),
            "Too many password reset submissions for this token. Please try again later."
        );
        authService.resetPasswordWithToken(request);
        return ResponseEntity.noContent().build();
    }
}
