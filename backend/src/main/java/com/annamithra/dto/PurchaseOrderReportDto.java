package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class PurchaseOrderReportDto {
    public Long id;
    public Long headerId;
    public String orderNumber;
    public String itemName;
    public String unit;
    public double quantityOrdered;
    public double actualReceived;
    public double remainingToReceive;
    public String status;
    public LocalDate orderDate;
    public LocalDateTime createdAt;

    public PurchaseOrderReportDto() {}

    public PurchaseOrderReportDto(Long id, Long headerId, String orderNumber, String itemName, String unit, double quantityOrdered, double actualReceived, double remainingToReceive, String status, LocalDate orderDate, LocalDateTime createdAt) {
        this.id = id;
        this.headerId = headerId;
        this.orderNumber = orderNumber;
        this.itemName = itemName;
        this.unit = unit;
        this.quantityOrdered = quantityOrdered;
        this.actualReceived = actualReceived;
        this.remainingToReceive = remainingToReceive;
        this.status = status;
        this.orderDate = orderDate;
        this.createdAt = createdAt;
    }
}
