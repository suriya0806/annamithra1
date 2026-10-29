package com.annamithra.dto;

import java.time.LocalDate;

public class DirectStockRequest {
    public String itemName;
    public String name;
    public String category;
    public String unit;
    public Integer quantity;
    public LocalDate entryDate;
    public LocalDate purchaseDate;
    public Long organisationId;
    public Long adminId;

    public DirectStockRequest() {}

    public DirectStockRequest(String itemName, String unit, Integer quantity) {
        this.itemName = itemName;
        this.name = itemName;
        this.unit = unit;
        this.quantity = quantity;
    }

    public DirectStockRequest(String itemName, String category, String unit, Integer quantity, LocalDate entryDate) {
        this.itemName = itemName;
        this.name = itemName;
        this.category = category;
        this.unit = unit;
        this.quantity = quantity;
        this.entryDate = entryDate;
    }

    public String getItemName() {
        if (itemName != null && !itemName.trim().isEmpty()) {
            return itemName;
        }
        return name;
    }

    public LocalDate getEffectiveDate() {
        if (entryDate != null) {
            return entryDate;
        }
        return purchaseDate;
    }
}
