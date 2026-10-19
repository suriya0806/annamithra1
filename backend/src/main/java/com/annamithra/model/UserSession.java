package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_sessions")
public class UserSession {
    @Id
    public String token;

    public Long userId;
    public String username;
    public String role;
    public Long organisationId;
    public Long branchId;
    public String branchName;
    public LocalDateTime createdAt = LocalDateTime.now();
    public LocalDateTime expiresAt;

    public UserSession() {}

    public UserSession(String token, Long userId, String username, String role, Long branchId, String branchName, LocalDateTime expiresAt) {
        this.token = token;
        this.userId = userId;
        this.username = username;
        this.role = role;
        this.branchId = branchId;
        this.branchName = branchName;
        this.expiresAt = expiresAt;
    }

    public UserSession(String token, Long userId, String username, String role, Long organisationId, Long branchId, String branchName, LocalDateTime expiresAt) {
        this.token = token;
        this.userId = userId;
        this.username = username;
        this.role = role;
        this.organisationId = organisationId;
        this.branchId = branchId;
        this.branchName = branchName;
        this.expiresAt = expiresAt;
    }
}
