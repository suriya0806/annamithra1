package com.annamithra.dto;

import java.time.LocalDateTime;

public class InventoryActivityDto {
    public Long id;
    public LocalDateTime transactionDate;
    public String type; // "RECEIPT", "DISPATCH"
    public int quantity;
    public int balanceAfter;
    public String referenceType;
    public String performedBy;

    public InventoryActivityDto() {}

    public InventoryActivityDto(Long id, LocalDateTime transactionDate, String type, int quantity, int balanceAfter, String referenceType, String performedBy) {
        this.id = id;
        this.transactionDate = transactionDate;
        this.type = type;
        this.quantity = quantity;
        this.balanceAfter = balanceAfter;
        this.referenceType = referenceType;
        this.performedBy = performedBy;
    }
}
