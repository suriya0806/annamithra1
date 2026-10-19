package com.annamithra.dto;

import java.time.LocalDateTime;

public class OrganisationSummaryDto {
    public Long id;
    public String name;
    public String code;
    public String status;
    public String adminName;
    public String adminEmail;
    public String contactPhone;
    public String address;
    public LocalDateTime createdAt;
    public int branchCount;
    public int userCount;
    public int itemCount;
    public int orderCount;

    public OrganisationSummaryDto() {}

    public OrganisationSummaryDto(Long id, String name, String code, String status, String adminName,
                                  String adminEmail, String contactPhone, String address, LocalDateTime createdAt,
                                  int branchCount, int userCount, int itemCount, int orderCount) {
        this.id = id;
        this.name = name;
        this.code = code;
        this.status = status;
        this.adminName = adminName;
        this.adminEmail = adminEmail;
        this.contactPhone = contactPhone;
        this.address = address;
        this.createdAt = createdAt;
        this.branchCount = branchCount;
        this.userCount = userCount;
        this.itemCount = itemCount;
        this.orderCount = orderCount;
    }
}
