package com.annamithra.dto;

import java.time.LocalDate;

public class DirectReceiptRequest {
    public String itemName;
    public Double receivedQty;
    public LocalDate receiptDate;
    public String remarks;

    public DirectReceiptRequest() {}

    public DirectReceiptRequest(String itemName, Double receivedQty, LocalDate receiptDate, String remarks) {
        this.itemName = itemName;
        this.receivedQty = receivedQty;
        this.receiptDate = receiptDate;
        this.remarks = remarks;
    }
}
