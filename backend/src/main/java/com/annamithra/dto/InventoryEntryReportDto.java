package com.annamithra.dto;

import java.time.LocalDateTime;

public class InventoryEntryReportDto {
    public Long id;
    public LocalDateTime receiptDate;
    public String orderNumber;
    public String itemName;
    public String unit;
    public int quantityReceived;
    public Integer updatedStockBalance;
    public String receivedBy;
    public String referenceType;

    public InventoryEntryReportDto() {}

    public InventoryEntryReportDto(Long id, LocalDateTime receiptDate, String orderNumber, String itemName, String unit, int quantityReceived, Integer updatedStockBalance, String receivedBy, String referenceType) {
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
}
