package com.annamithra.dto;

public class GoodsReceiptResponseDto {
    public String itemName;
    public String unit;
    public int receivedQty;
    public int currentStock;
    public String receiptType; // "LINKED_PO" or "DIRECT_ENTRY"
    public String poNumber;
    public String status;

    public GoodsReceiptResponseDto() {}

    public GoodsReceiptResponseDto(String itemName, String unit, int receivedQty, int currentStock, String receiptType, String poNumber, String status) {
        this.itemName = itemName;
        this.unit = unit;
        this.receivedQty = receivedQty;
        this.currentStock = currentStock;
        this.receiptType = receiptType;
        this.poNumber = poNumber;
        this.status = status;
    }
}
