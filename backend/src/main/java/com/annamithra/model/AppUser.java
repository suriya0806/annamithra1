package com.annamithra.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "app_users")
public class AppUser {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    public Long id;

    @Column(unique = true, nullable = false)
    public String username;

    @Column(nullable = false)
    public String passwordHash;

    @Column(nullable = false)
    public String role; // "Master Admin", "Organisation Admin", "Store Manager", "Branch Manager"

    public Long organisationId;
    public Long branchId;
    public String branchName;
    public String fullName;
    public LocalDateTime createdAt = LocalDateTime.now();
    public LocalDateTime updatedAt = LocalDateTime.now();
    public String updatedBy;

    public AppUser() {}

    public AppUser(String username, String passwordHash, String role, Long branchId, String branchName, String fullName) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.branchId = branchId;
        this.branchName = branchName;
        this.fullName = fullName;
    }

    public AppUser(String username, String passwordHash, String role, Long organisationId, Long branchId, String branchName, String fullName) {
        this.username = username;
        this.passwordHash = passwordHash;
        this.role = role;
        this.organisationId = organisationId;
        this.branchId = branchId;
        this.branchName = branchName;
        this.fullName = fullName;
    }
}
