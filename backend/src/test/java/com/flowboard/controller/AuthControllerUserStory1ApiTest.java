package com.flowboard.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowboard.dto.AuthResponse;
import com.flowboard.dto.LoginRequest;
import com.flowboard.dto.RegisterRequest;
import com.flowboard.dto.UserDTO;
import com.flowboard.service.AuthService;
import com.flowboard.service.JWTService;
import com.flowboard.service.RateLimitService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.startsWith;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerUserStory1ApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockBean
    private AuthService authService;

    @MockBean
    private JWTService jwtService;

    @MockBean
    private RateLimitService rateLimitService;

    @Test
    void register_returnsCreated_andDelegatesToAuthService() throws Exception {
        RegisterRequest request = RegisterRequest.builder()
            .email("new.user@flowboard.com")
            .password("StrongPass1!")
            .username("new_user")
            .fullName("New User")
            .build();

        UserDTO user = UserDTO.builder()
            .id(UUID.randomUUID())
            .email("new.user@flowboard.com")
            .username("new_user")
            .fullName("New User")
            .role("MEMBER")
            .build();

        AuthResponse response = AuthResponse.builder()
            .token("jwt-token")
            .expiresIn(3600000L)
            .user(user)
            .build();

        when(authService.register(any(RegisterRequest.class))).thenReturn(response);

        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.token").value("jwt-token"))
            .andExpect(jsonPath("$.expires_in").value(3600000L))
            .andExpect(jsonPath("$.user.email").value("new.user@flowboard.com"));

        verify(rateLimitService).check(
            startsWith("register:ip:"),
            eq(5),
            eq(Duration.ofMinutes(15)),
            eq("Too many registration attempts. Please try again later.")
        );
        verify(authService).register(any(RegisterRequest.class));
    }

    @Test
    void login_returnsOk_andDelegatesToAuthService() throws Exception {
        LoginRequest request = LoginRequest.builder()
            .email("admin@flowboard.com")
            .password("AdminPass1!")
            .build();

        UserDTO user = UserDTO.builder()
            .id(UUID.randomUUID())
            .email("admin@flowboard.com")
            .username("admin")
            .fullName("Admin User")
            .role("ADMIN")
            .build();

        AuthResponse response = AuthResponse.builder()
            .token("jwt-login-token")
            .expiresIn(7200000L)
            .user(user)
            .build();

        when(authService.login(any(LoginRequest.class))).thenReturn(response);

        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.token").value("jwt-login-token"))
            .andExpect(jsonPath("$.user.email").value("admin@flowboard.com"));

        verify(rateLimitService).assertNotLimited(
            startsWith("login:ip:"),
            eq(10),
            eq(Duration.ofMinutes(15)),
            eq("Too many failed attempts in a short period. Please try again later.")
        );
        verify(rateLimitService).assertNotLimited(
            eq("login:email:admin@flowboard.com"),
            eq(10),
            eq(Duration.ofMinutes(15)),
            eq("Too many failed attempts for this account. Please try again later.")
        );
        verify(rateLimitService, never()).record(startsWith("login:ip:"));
        verify(rateLimitService, never()).record(eq("login:email:admin@flowboard.com"));
        verify(authService).login(any(LoginRequest.class));
    }

    @Test
    void logout_returnsNoContent_andRevokesTokenThroughService() throws Exception {
        when(jwtService.extractBearerToken("Bearer valid-token")).thenReturn("valid-token");

        mockMvc.perform(post("/auth/logout")
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isNoContent());

        verify(jwtService).extractBearerToken("Bearer valid-token");
        verify(authService).logout("valid-token");
    }

    @Test
    void getMySecurityQuestions_returnsConfiguredQuestionsForAuthenticatedUser() throws Exception {
        UUID userId = UUID.randomUUID();
        when(jwtService.extractUserIdFromAuthHeader("Bearer valid-token")).thenReturn(userId);
        when(authService.getSecurityQuestionsForUserId(userId.toString())).thenReturn(Map.of(
            "question1", "Question one?",
            "question2", "Question two?",
            "customQuestion", "Custom question?"
        ));

        mockMvc.perform(get("/auth/security-questions/me")
                .header("Authorization", "Bearer valid-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.question1").value("Question one?"))
            .andExpect(jsonPath("$.question2").value("Question two?"))
            .andExpect(jsonPath("$.customQuestion").value("Custom question?"));

        verify(jwtService).extractUserIdFromAuthHeader("Bearer valid-token");
        verify(authService).getSecurityQuestionsForUserId(userId.toString());
    }

    @Test
    void getSecurityQuestionsByEmail_appliesIpAndEmailRateLimits() throws Exception {
        when(authService.getSecurityQuestionsForUser("user@example.com")).thenReturn(Map.of(
            "question1", "Question one?",
            "question2", "Question two?",
            "customQuestion", "Custom question?"
        ));

        mockMvc.perform(get("/auth/security-questions/user@example.com"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.question1").value("Question one?"));

        verify(rateLimitService).check(
            startsWith("security-questions:lookup:ip:"),
            eq(10),
            eq(Duration.ofMinutes(15)),
            eq("Too many password recovery lookups. Please wait and try again later.")
        );
        verify(rateLimitService).check(
            eq("security-questions:lookup:email:user@example.com"),
            eq(10),
            eq(Duration.ofMinutes(15)),
            eq("Too many password recovery lookups for this account. Please wait and try again later.")
        );
        verify(authService).getSecurityQuestionsForUser("user@example.com");
    }

    @Test
    void register_withInvalidBody_returnsBadRequest() throws Exception {
        String invalidPayload = "{\"email\":\"not-an-email\",\"password\":\"short\"}";

        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(invalidPayload))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Validation failed"));

        verify(authService, never()).register(any(RegisterRequest.class));
    }
}
