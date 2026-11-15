package com.annamithra.dto;

import java.time.LocalDateTime;

public class VendorEntryItemDto {
    public Long id;
    public Long entryId;
    public Long itemId;
    public String itemName;
    public String unit;
    public Double quantity;
    public Double stockBefore;
    public Double stockAfter;
    public Double unitRate;
    public Double totalRate;
    public Long transactionId;
    public LocalDateTime createdAt;

    public VendorEntryItemDto() {}

    public VendorEntryItemDto(Long id, Long entryId, Long itemId, String itemName, String unit,
                              Double quantity, Double stockBefore, Double stockAfter,
                              Double unitRate, Double totalRate,
                              Long transactionId, LocalDateTime createdAt) {
        this.id = id;
        this.entryId = entryId;
        this.itemId = itemId;
        this.itemName = itemName;
        this.unit = unit;
        this.quantity = quantity;
        this.stockBefore = stockBefore;
        this.stockAfter = stockAfter;
        this.unitRate = unitRate;
        this.totalRate = totalRate;
        this.transactionId = transactionId;
        this.createdAt = createdAt;
    }

    public VendorEntryItemDto(Long id, Long entryId, Long itemId, String itemName, String unit,
                              Double quantity, Double stockBefore, Double stockAfter,
                              Long transactionId, LocalDateTime createdAt) {
        this(id, entryId, itemId, itemName, unit, quantity, stockBefore, stockAfter, 0.0, 0.0, transactionId, createdAt);
    }
}

