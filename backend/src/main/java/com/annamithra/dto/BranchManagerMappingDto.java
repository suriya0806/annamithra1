package com.annamithra.dto;

import java.time.LocalDateTime;

public class BranchManagerMappingDto {
    public Long branchId;
    public String branchName;
    public String location;
    public String managerUsername;
    public String contact;
    public LocalDateTime createdAt;

    public BranchManagerMappingDto(Long branchId, String branchName, String location, String managerUsername, String contact, LocalDateTime createdAt) {
        this.branchId = branchId;
        this.branchName = branchName;
        this.location = location;
        this.managerUsername = managerUsername;
        this.contact = contact;
        this.createdAt = createdAt;
    }
}
