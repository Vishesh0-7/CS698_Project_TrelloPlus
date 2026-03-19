package com.flowboard.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
public class JWTService {
    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.expiration}")
    private long expiration;

    private final ConcurrentMap<String, Long> revokedTokens = new ConcurrentHashMap<>();

    public String generateToken(UUID userId, String email, String role) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", role);
        claims.put("userId", userId.toString());

        return Jwts.builder()
            .setClaims(claims)
            .setSubject(email)
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + expiration))
            .signWith(Keys.hmacShaKeyFor(secret.getBytes()), SignatureAlgorithm.HS256)
            .compact();
    }

    public String extractEmail(String token) {
        return getAllClaims(token).getSubject();
    }

    public UUID extractUserId(String token) {
        String userIdStr = getAllClaims(token).get("userId", String.class);
        return UUID.fromString(userIdStr);
    }

    public String extractRole(String token) {
        return getAllClaims(token).get("role", String.class);
    }

    public Boolean isTokenValid(String token) {
        try {
            if (isTokenRevoked(token)) {
                return false;
            }
            Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
                .build()
                .parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public Long getExpirationTime(String token) {
        Date expirationDate = getAllClaims(token).getExpiration();
        return Math.max(0, expirationDate.getTime() - System.currentTimeMillis());
    }

    public String extractBearerToken(String authHeader) {
        if (authHeader == null || authHeader.isBlank() || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }

        String token = authHeader.substring(7).trim();
        if (token.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Bearer token is missing");
        }

        return token;
    }

    public UUID extractUserIdFromAuthHeader(String authHeader) {
        String token = extractBearerToken(authHeader);
        if (!isTokenValid(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Token is invalid or expired");
        }
        return extractUserId(token);
    }

    public void revokeToken(String token) {
        long ttlMs = getExpirationTime(token);
        revokedTokens.put(token, System.currentTimeMillis() + ttlMs);
    }

    public boolean isTokenRevoked(String token) {
        Long expiry = revokedTokens.get(token);
        if (expiry == null) {
            return false;
        }

        if (expiry < System.currentTimeMillis()) {
            revokedTokens.remove(token);
            return false;
        }

        return true;
    }

    private Claims getAllClaims(String token) {
        return Jwts.parser()
            .verifyWith(Keys.hmacShaKeyFor(secret.getBytes()))
            .build()
            .parseSignedClaims(token)
            .getPayload();
    }
}
