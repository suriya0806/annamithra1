package com.annamithra.dto;

import java.time.LocalDateTime;

public class OrganisationAccountDto {
    public Long userId;
    public String username;
    public String fullName;
    public String role;
    public Long branchId;
    public String branchName;
    public String branchLocation;
    public String contact;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
    public String updatedBy;
    public String assignedStoreManager;
    public String assignedBranchManager;

    public OrganisationAccountDto() {}

    public OrganisationAccountDto(
            Long userId,
            String username,
            String fullName,
            String role,
            Long branchId,
            String branchName,
            String branchLocation,
            String contact,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String updatedBy,
            String assignedStoreManager,
            String assignedBranchManager) {
        this.userId = userId;
        this.username = username;
        this.fullName = fullName;
        this.role = role;
        this.branchId = branchId;
        this.branchName = branchName;
        this.branchLocation = branchLocation;
        this.contact = contact;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
        this.updatedBy = updatedBy;
        this.assignedStoreManager = assignedStoreManager;
        this.assignedBranchManager = assignedBranchManager;
    }
}
