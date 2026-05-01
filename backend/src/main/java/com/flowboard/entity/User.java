package com.flowboard.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(unique = true, nullable = false)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = true)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    @Column(name = "is_deletion_marked")
    private Boolean isDeletionMarked = false;

    private LocalDateTime deletedAt;

    @Column(nullable = true)
    private String securityQuestion1;

    @Column(nullable = true, length = 500)
    private String securityAnswer1Hash;

    @Column(nullable = true)
    private String securityQuestion2;

    @Column(nullable = true, length = 500)
    private String securityAnswer2Hash;

    @Column(nullable = true, length = 500)
    private String customSecurityQuestion;

    @Column(nullable = true, length = 500)
    private String customSecurityAnswerHash;

    @Column(name = "failed_security_attempts", columnDefinition = "int default 0")
    private Integer failedSecurityAttempts = 0;

    @Column(name = "last_security_attempt_time")
    private LocalDateTime lastSecurityAttemptTime;

    @ManyToMany(mappedBy = "members", fetch = FetchType.EAGER)
    private Set<Project> projects = new HashSet<>();

    public enum UserRole {
        ADMIN, MANAGER, MEMBER, VIEWER
    }
}
