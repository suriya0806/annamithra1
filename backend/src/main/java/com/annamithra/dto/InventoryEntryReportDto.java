package com.annamithra.dto;

import java.time.LocalDateTime;

public class InventoryEntryReportDto {
    public Long id;
    public LocalDateTime receiptDate;
    public String orderNumber;
    public String itemName;
    public String category;
    public String unit;
    public double quantityReceived;
    public Double updatedStockBalance;
    public String receivedBy;
    public Long createdByAdminId;
    public String referenceType;

    public InventoryEntryReportDto() {}

    public InventoryEntryReportDto(Long id, LocalDateTime receiptDate, String orderNumber, String itemName, String unit, double quantityReceived, Double updatedStockBalance, String receivedBy, String referenceType) {
        this.id = id;
        this.receiptDate = receiptDate;
        this.orderNumber = orderNumber;
        this.itemName = itemName;
        this.unit = unit;
        this.quantityReceived = quantityReceived;
        this.updatedStockBalance = updatedStockBalance;
        this.receivedBy = receivedBy;
        this.referenceType = referenceType;
    }

    public InventoryEntryReportDto(Long id, LocalDateTime receiptDate, String orderNumber, String itemName, String category, String unit, double quantityReceived, Double updatedStockBalance, String receivedBy, Long createdByAdminId, String referenceType) {
        this.id = id;
        this.receiptDate = receiptDate;
        this.orderNumber = orderNumber;
        this.itemName = itemName;
        this.category = category;
        this.unit = unit;
        this.quantityReceived = quantityReceived;
        this.updatedStockBalance = updatedStockBalance;
        this.receivedBy = receivedBy;
        this.createdByAdminId = createdByAdminId;
        this.referenceType = referenceType;
    }
}
