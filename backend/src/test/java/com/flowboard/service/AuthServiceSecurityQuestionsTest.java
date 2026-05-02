package com.flowboard.service;

import com.flowboard.dto.SetSecurityQuestionsRequest;
import com.flowboard.dto.ValidateSecurityAnswersRequest;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceSecurityQuestionsTest {
    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JWTService jwtService;

    private AuthService authService;
    private UUID userId;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
            userRepository,
            passwordEncoder,
            jwtService,
            new SecurityQuestionService()
        );
        userId = UUID.randomUUID();
    }

    @Test
    void setSecurityQuestions_firstSetupDoesNotRequireCurrentPassword() {
        User user = baseUser();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(any(String.class))).thenAnswer(invocation -> "hash:" + invocation.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.setSecurityQuestions(userId.toString(), request(null));

        verify(passwordEncoder, never()).matches(any(String.class), any(String.class));
        verify(userRepository).save(user);
        assertEquals("Name a teacher or mentor who inspired you", user.getSecurityQuestion1());
        assertEquals("hash:ada", user.getSecurityAnswer1Hash());
    }

    @Test
    void setSecurityQuestions_existingSetupRequiresCurrentPassword() {
        User user = configuredUser();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        ResponseStatusException ex = assertThrows(
            ResponseStatusException.class,
            () -> authService.setSecurityQuestions(userId.toString(), request(null))
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Current password is required to update security questions", ex.getReason());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void setSecurityQuestions_rejectsWrongCurrentPassword() {
        User user = configuredUser();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPass1!", user.getPasswordHash())).thenReturn(false);

        ResponseStatusException ex = assertThrows(
            ResponseStatusException.class,
            () -> authService.setSecurityQuestions(userId.toString(), request("WrongPass1!"))
        );

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        assertEquals("Current password is incorrect", ex.getReason());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void setSecurityQuestions_acceptsCorrectCurrentPassword() {
        User user = configuredUser();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("StrongPass1!", user.getPasswordHash())).thenReturn(true);
        when(passwordEncoder.encode(any(String.class))).thenAnswer(invocation -> "hash:" + invocation.getArgument(0));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.setSecurityQuestions(userId.toString(), request("StrongPass1!"));

        verify(passwordEncoder).matches("StrongPass1!", user.getPasswordHash());
        verify(userRepository).save(user);
        assertEquals("hash:blue", user.getCustomSecurityAnswerHash());
    }

    @Test
    void getSecurityQuestionsForUserId_returnsQuestionTextOnly() {
        User user = configuredUser();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        Map<String, Object> questions = authService.getSecurityQuestionsForUserId(userId.toString());

        assertEquals("Name a teacher or mentor who inspired you", questions.get("question1"));
        assertEquals("What was your first job?", questions.get("question2"));
        assertEquals("What color is my test notebook?", questions.get("customQuestion"));
    }

    @Test
    void validateSecurityAnswers_unconfiguredAccountReturnsFriendlyBadRequest() {
        User user = baseUser();
        when(userRepository.findFirstByEmailOrderByCreatedAtDesc("user@example.com")).thenReturn(Optional.of(user));

        ValidateSecurityAnswersRequest request = ValidateSecurityAnswersRequest.builder()
            .email("user@example.com")
            .answers(Map.of("answer1", "Ada", "answer2", "Intern", "customAnswer", "Blue"))
            .build();

        ResponseStatusException ex = assertThrows(
            ResponseStatusException.class,
            () -> authService.validateSecurityAnswers(request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals(
            "Security questions are not configured. Please contact support or log in to configure them.",
            ex.getReason()
        );
    }

    private SetSecurityQuestionsRequest request(String currentPassword) {
        return SetSecurityQuestionsRequest.builder()
            .currentPassword(currentPassword)
            .securityQuestion1("Name a teacher or mentor who inspired you")
            .securityAnswer1("Ada")
            .securityQuestion2("What was your first job?")
            .securityAnswer2("Intern")
            .customSecurityQuestion("What color is my test notebook?")
            .customSecurityAnswer("Blue")
            .build();
    }

    private User baseUser() {
        return User.builder()
            .id(userId)
            .email("user@example.com")
            .username("user")
            .fullName("User")
            .passwordHash("stored-password-hash")
            .role(User.UserRole.MEMBER)
            .failedSecurityAttempts(0)
            .build();
    }

    private User configuredUser() {
        User user = baseUser();
        user.setSecurityQuestion1("Name a teacher or mentor who inspired you");
        user.setSecurityAnswer1Hash("hash:ada");
        user.setSecurityQuestion2("What was your first job?");
        user.setSecurityAnswer2Hash("hash:intern");
        user.setCustomSecurityQuestion("What color is my test notebook?");
        user.setCustomSecurityAnswerHash("hash:blue");
        return user;
    }
}
