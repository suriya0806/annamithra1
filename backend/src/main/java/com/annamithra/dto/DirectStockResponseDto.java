package com.annamithra.dto;

import java.time.LocalDateTime;

public class DirectStockResponseDto {
    public Long id;
    public Long itemId;
    public String itemName;
    public String category;
    public String unit;
    public double quantityAdded;
    public double newStock;
    public double currentStock;
    public boolean isNewItem;
    public LocalDateTime entryDate;
    public Long createdByAdminId;
    public Long organisationId;
    public String performedBy;
    public String status = "SUCCESS";

    public DirectStockResponseDto() {}

    public DirectStockResponseDto(String itemName, String unit, double quantityAdded, double newStock, boolean isNewItem) {
        this.itemName = itemName;
        this.unit = unit;
        this.quantityAdded = quantityAdded;
        this.newStock = newStock;
        this.currentStock = newStock;
        this.isNewItem = isNewItem;
        this.status = "SUCCESS";
    }

    public DirectStockResponseDto(Long id, Long itemId, String itemName, String category, String unit,
                                 double quantityAdded, double newStock, boolean isNewItem, LocalDateTime entryDate,
                                 Long createdByAdminId, Long organisationId, String performedBy) {
        this.id = id;
        this.itemId = itemId;
        this.itemName = itemName;
        this.category = category;
        this.unit = unit;
        this.quantityAdded = quantityAdded;
        this.newStock = newStock;
        this.currentStock = newStock;
        this.isNewItem = isNewItem;
        this.entryDate = entryDate;
        this.createdByAdminId = createdByAdminId;
        this.organisationId = organisationId;
        this.performedBy = performedBy;
        this.status = "SUCCESS";
    }
}
