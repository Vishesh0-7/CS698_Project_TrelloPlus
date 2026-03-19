package com.flowboard.service;

import com.flowboard.dto.*;
import com.flowboard.entity.User;
import com.flowboard.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JWTService jwtService;

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
        User user = userRepository.findByEmail(email)
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
        
        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String normalizedEmail = normalizeEmail(request.getEmail());
            // Check if email is already taken by another user
            if (userRepository.existsByEmailAndIdNot(normalizedEmail, user.getId())) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already exists");
            }
            user.setEmail(normalizedEmail);
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
}
