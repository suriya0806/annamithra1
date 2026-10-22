package com.annamithra.dto;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class BranchRequestReportDto {
    public Long id;
    public LocalDate date;
    public LocalDateTime createdAt;
    public String branchName;
    public String itemName;
    public String unit;
    public String category;
    public int requestedQuantity;
    public int dispatchedQuantity;
    public int acknowledgedReceivedQuantity;
    public int remainingQuantity;
    public String status;

    public BranchRequestReportDto() {}

    public BranchRequestReportDto(Long id, LocalDate date, LocalDateTime createdAt, String branchName, String itemName, String unit, int requestedQuantity, int dispatchedQuantity, int acknowledgedReceivedQuantity, int remainingQuantity, String status) {
        this(id, date, createdAt, branchName, itemName, unit, null, requestedQuantity, dispatchedQuantity, acknowledgedReceivedQuantity, remainingQuantity, status);
    }

    public BranchRequestReportDto(Long id, LocalDate date, LocalDateTime createdAt, String branchName, String itemName, String unit, String category, int requestedQuantity, int dispatchedQuantity, int acknowledgedReceivedQuantity, int remainingQuantity, String status) {
        this.id = id;
        this.date = date;
        this.createdAt = createdAt;
        this.branchName = branchName;
        this.itemName = itemName;
        this.unit = unit;
        this.category = category;
        this.requestedQuantity = requestedQuantity;
        this.dispatchedQuantity = dispatchedQuantity;
        this.acknowledgedReceivedQuantity = acknowledgedReceivedQuantity;
        this.remainingQuantity = remainingQuantity;
        this.status = status;
    }
}
