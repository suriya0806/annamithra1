package com.annamithra.dto;

import java.time.LocalDateTime;

public class StoreManagerAccountDto {
    public Long id;
    public String username;
    public String fullName;
    public Long organisationId;
    public LocalDateTime createdAt;

    public StoreManagerAccountDto() {}

    public StoreManagerAccountDto(Long id, String username, String fullName, Long organisationId, LocalDateTime createdAt) {
        this.id = id;
        this.username = username;
        this.fullName = fullName;
        this.organisationId = organisationId;
        this.createdAt = createdAt;
    }
}
