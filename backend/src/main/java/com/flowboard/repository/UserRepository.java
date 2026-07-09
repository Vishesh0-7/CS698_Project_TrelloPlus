package com.flowboard.repository;

import com.flowboard.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findFirstByEmailOrderByCreatedAtDesc(String email);
    Optional<User> findFirstByEmailIgnoreCaseOrderByCreatedAtDesc(String email);
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByEmailAndIdNot(String email, UUID id);
}
