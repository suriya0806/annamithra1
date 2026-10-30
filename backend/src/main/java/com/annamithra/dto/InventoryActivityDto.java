package com.annamithra.dto;

import java.time.LocalDateTime;

public class InventoryActivityDto {
    public Long id;
    public LocalDateTime transactionDate;
    public String type; // "RECEIPT", "DISPATCH"
    public double quantity;
    public double balanceAfter;
    public String referenceType;
    public String performedBy;

    public InventoryActivityDto() {}

    public InventoryActivityDto(Long id, LocalDateTime transactionDate, String type, double quantity, double balanceAfter, String referenceType, String performedBy) {
        this.id = id;
        this.transactionDate = transactionDate;
        this.type = type;
        this.quantity = quantity;
        this.balanceAfter = balanceAfter;
        this.referenceType = referenceType;
        this.performedBy = performedBy;
    }
}
